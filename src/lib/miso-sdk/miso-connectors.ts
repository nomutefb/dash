import { useCallback, useEffect, useRef, useState } from "react";

import { getApiBase } from "./site-client";

export type MisoConnectorStatus =
  | "connected"
  | "expired"
  | "not_connected"
  | "error";

export interface MisoConnectorPermission {
  key: string;
  label?: Record<string, string> | string;
}

export interface MisoConnectorItem {
  connectorId: string;
  name: string;
  status: MisoConnectorStatus;
  permissions: MisoConnectorPermission[];
  permissionKeys: string[];
}

interface ConnectorStatusResponse {
  connectors?: unknown[];
}

interface ConnectorAuthorizeResponse {
  authUrl?: unknown;
  auth_url?: unknown;
}

export interface MisoConnectorGrantRequest {
  scope?: string;
  audience?: "browser" | "pocketbase" | string;
}

export interface MisoConnectorGrantResponse {
  connector: string;
  grant: string;
  expires_in: number;
}

export interface MisoConnectorTokenResponse {
  connector: string;
  access_token: string;
  token_type: "Bearer" | string;
  expires_at?: string | null;
  granted_scopes: string[];
}

function normalizeString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function normalizePermission(value: unknown): MisoConnectorPermission | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const key = normalizeString(record.key);
  if (!key) return null;

  const permission: MisoConnectorPermission = { key };
  if (typeof record.label === "string") {
    permission.label = record.label;
  } else if (record.label && typeof record.label === "object" && !Array.isArray(record.label)) {
    const labels = record.label as Record<string, unknown>;
    permission.label = Object.fromEntries(
      Object.entries(labels).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
  }
  return permission;
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeString).filter(Boolean) as string[];
}

function normalizeConnector(value: unknown): MisoConnectorItem | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const connectorId = normalizeString(record.connectorId) ?? normalizeString(record.connector_id);
  const name = normalizeString(record.name) ?? connectorId;
  const status = normalizeString(record.status) as MisoConnectorStatus | null;
  const permissions = Array.isArray(record.permissions)
    ? record.permissions.map(normalizePermission).filter(Boolean) as MisoConnectorPermission[]
    : [];
  const explicitPermissionKeys =
    normalizeStringList(record.permissionKeys).length > 0
      ? normalizeStringList(record.permissionKeys)
      : normalizeStringList(record.permission_keys);
  const permissionKeys = Array.from(
    new Set(explicitPermissionKeys.length > 0 ? explicitPermissionKeys : permissions.map((item) => item.key)),
  );

  if (!connectorId || !name || !status) return null;
  if (!["connected", "expired", "not_connected", "error"].includes(status)) return null;

  return { connectorId, name, status, permissions, permissionKeys };
}

async function readJson<T>(response: Response, context: string): Promise<T> {
  const text = await response.text();
  let parsed: unknown = {};
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { message: text };
    }
  }

  if (!response.ok) {
    const message =
      parsed && typeof parsed === "object" && "message" in parsed
        ? String((parsed as Record<string, unknown>).message)
        : text;
    throw new Error(`${context} failed (${response.status}): ${message}`);
  }

  return parsed as T;
}

export function getMisoConnectorApiOrigin(): string {
  if (typeof window === "undefined") return "";

  const { protocol, hostname, port, origin } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".localhost")) {
    return origin;
  }

  const parts = hostname.split(".");
  if (parts[0] === "api") {
    return origin;
  }
  if (parts[0] === "admin" || parts[0] === "admin-v2") {
    parts[0] = "api";
  } else {
    parts.unshift("api");
  }

  const portPart = port ? `:${port}` : "";
  return `${protocol}//${parts.join(".")}${portPart}`;
}

export function getMisoConnectorTrustedMessageOrigins(): string[] {
  if (typeof window === "undefined") return [];
  const origins = new Set<string>([window.location.origin]);
  const apiOrigin = getMisoConnectorApiOrigin();
  if (apiOrigin) origins.add(apiOrigin);
  try {
    origins.add(new URL(getApiBase(), window.location.origin).origin);
  } catch {
    // Keep the known origins above.
  }
  return [...origins];
}

export async function fetchMisoConnectorStatus(): Promise<MisoConnectorItem[]> {
  const response = await fetch(`${getApiBase()}/auth/connectors/status`, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "include",
  });
  const payload = await readJson<ConnectorStatusResponse>(response, "MISO connector status");
  return (payload.connectors ?? []).map(normalizeConnector).filter(Boolean) as MisoConnectorItem[];
}

export async function getMisoConnectorAuthorizeUrl(
  connectorName: string,
  options: { redirect?: string } = {},
): Promise<string> {
  const params = new URLSearchParams();
  if (options.redirect) params.set("redirect", options.redirect);
  const suffix = params.toString() ? `?${params.toString()}` : "";

  const response = await fetch(
    `${getApiBase()}/auth/connectors/${encodeURIComponent(connectorName)}/authorize${suffix}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "include",
    },
  );
  const payload = await readJson<ConnectorAuthorizeResponse>(
    response,
    `MISO connector ${connectorName} authorize`,
  );
  const authUrl = normalizeString(payload.authUrl) ?? normalizeString(payload.auth_url);
  if (!authUrl) throw new Error("MISO connector authorize response did not include authUrl.");
  return authUrl;
}

export async function createMisoConnectorGrant(
  connectorName: string,
  request: MisoConnectorGrantRequest = {},
): Promise<MisoConnectorGrantResponse> {
  const response = await fetch(
    `${getApiBase()}/auth/connectors/${encodeURIComponent(connectorName)}/grant`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(request),
    },
  );
  return readJson<MisoConnectorGrantResponse>(
    response,
    `MISO connector ${connectorName} grant`,
  );
}

export async function fetchMisoConnectorAccessToken(
  connectorName: string,
  grant: string,
  request: MisoConnectorGrantRequest = {},
): Promise<MisoConnectorTokenResponse> {
  const response = await fetch(
    `${getApiBase()}/auth/connectors/${encodeURIComponent(connectorName)}/token`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ ...request, grant }),
    },
  );
  return readJson<MisoConnectorTokenResponse>(
    response,
    `MISO connector ${connectorName} token`,
  );
}

export interface MisoConnectorMcpTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

export interface MisoConnectorMcpToolsResponse {
  tools: MisoConnectorMcpTool[];
}

export interface MisoConnectorMcpCallRequest {
  tool: string;
  arguments?: Record<string, unknown>;
}

export interface MisoConnectorMcpCallResponse {
  content: unknown;
  isError?: boolean;
}

export async function listMisoConnectorMcpTools(
  connectorName: string,
): Promise<MisoConnectorMcpToolsResponse> {
  const response = await fetch(
    `${getApiBase()}/auth/connectors/${encodeURIComponent(connectorName)}/mcp/tools`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({}),
    },
  );
  return readJson<MisoConnectorMcpToolsResponse>(
    response,
    `MISO connector ${connectorName} mcp tools`,
  );
}

export async function callMisoConnectorMcpTool(
  connectorName: string,
  args: MisoConnectorMcpCallRequest,
): Promise<MisoConnectorMcpCallResponse> {
  const response = await fetch(
    `${getApiBase()}/auth/connectors/${encodeURIComponent(connectorName)}/mcp/call`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ tool: args.tool, arguments: args.arguments ?? {} }),
    },
  );
  return readJson<MisoConnectorMcpCallResponse>(
    response,
    `MISO connector ${connectorName} mcp call`,
  );
}

export async function disconnectMisoConnector(connectorName: string): Promise<void> {
  const response = await fetch(
    `${getApiBase()}/auth/connectors/${encodeURIComponent(connectorName)}/disconnect`,
    {
      method: "POST",
      headers: { Accept: "application/json" },
      credentials: "include",
    },
  );
  await readJson<unknown>(response, `MISO connector ${connectorName} disconnect`);
}

export function openMisoConnectorPopup(authUrl: string): Window | null {
  const width = 600;
  const height = 720;
  const left =
    typeof window === "undefined" ? 0 : window.screenX + Math.max(0, (window.outerWidth - width) / 2);
  const top =
    typeof window === "undefined" ? 0 : window.screenY + Math.max(0, (window.outerHeight - height) / 2);

  return window.open(
    authUrl,
    "miso_connector_oauth",
    `width=${width},height=${height},left=${left},top=${top}`,
  );
}

export function subscribeMisoConnectorOAuthComplete(
  callback: (payload: { success: boolean; connectorId?: string; error?: string }) => void,
): () => void {
  const trustedOrigins = getMisoConnectorTrustedMessageOrigins();
  const handler = (event: MessageEvent) => {
    if (!trustedOrigins.includes(event.origin)) return;
    const data = event.data as Record<string, unknown> | null;
    if (!data || data.type !== "connector_oauth_complete") return;

    callback({
      success: data.success === true,
      connectorId: normalizeString(data.connector_id) ?? normalizeString(data.connectorId) ?? undefined,
      error: normalizeString(data.error) ?? undefined,
    });
  };

  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
}

export function useMisoExternalConnectors(
  {
    enabled = true,
    onConnected,
  }: {
    enabled?: boolean;
    onConnected?: (connectorId?: string) => void;
  } = {},
) {
  const [connectors, setConnectors] = useState<MisoConnectorItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onConnectedRef = useRef(onConnected);
  onConnectedRef.current = onConnected;

  const refetch = useCallback(async () => {
    if (!enabled) {
      setInitialized(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setConnectors(await fetchMisoConnectorStatus());
    } catch (err) {
      setConnectors([]);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setInitialized(true);
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;
    return subscribeMisoConnectorOAuthComplete((payload) => {
      if (!payload.success) {
        setError(payload.error ?? "MISO connector OAuth failed.");
        return;
      }
      void refetch();
      onConnectedRef.current?.(payload.connectorId);
    });
  }, [enabled, refetch]);

  const connect = useCallback(async (connectorName: string) => {
    const authUrl = await getMisoConnectorAuthorizeUrl(connectorName, {
      redirect: typeof window === "undefined" ? undefined : window.location.href,
    });
    openMisoConnectorPopup(authUrl);
  }, []);

  const disconnect = useCallback(
    async (connectorName: string) => {
      await disconnectMisoConnector(connectorName);
      await refetch();
    },
    [refetch],
  );

  return {
    connectors,
    initialized,
    missing: connectors.filter((connector) => connector.status !== "connected"),
    loading,
    error,
    connect,
    disconnect,
    refetch,
  };
}
