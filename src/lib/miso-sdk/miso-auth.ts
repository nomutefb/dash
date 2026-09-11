import { getApiBase, getAuthHeaders } from "./site-client";

export interface MisoCurrentUser {
  id: string | null;
  email: string | null;
  name: string | null;
  avatar: string | null;
  department: string | null;
}

export interface MisoAuthContext {
  authenticated: boolean;
  user: MisoCurrentUser | null;
  site: {
    code: string | null;
  };
  app: {
    id: string | null;
    permission: string | null;
  };
}

export const anonymousMisoAuthContext: MisoAuthContext = {
  authenticated: false,
  user: null,
  site: { code: null },
  app: { id: null, permission: null },
};

function getCurrentReturnPath(): string {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function normalizeMisoLoginReturnTo(returnTo?: string): string {
  const next = (returnTo || getCurrentReturnPath()).trim();
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("://")) {
    return "/";
  }
  return next;
}

export function buildMisoLoginUrl(returnTo?: string): string {
  return `/login?redirect=${encodeURIComponent(normalizeMisoLoginReturnTo(returnTo))}`;
}

export function redirectToMisoLogin(returnTo?: string): void {
  if (typeof window === "undefined") return;
  window.location.assign(buildMisoLoginUrl(returnTo));
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function normalizeMisoUser(value: unknown): MisoCurrentUser | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  return {
    id: optionalString(record.id),
    email: optionalString(record.email),
    name: optionalString(record.name),
    avatar: optionalString(record.avatar),
    department: optionalString(record.department),
  };
}

function normalizeMisoAuthContext(value: Partial<MisoAuthContext>): MisoAuthContext {
  const user = normalizeMisoUser(value.user);
  const authenticated = Boolean(value.authenticated && user?.id);

  return {
    authenticated,
    user: authenticated ? user : null,
    site: {
      code: optionalString(value.site?.code),
    },
    app: {
      id: optionalString(value.app?.id),
      permission: optionalString(value.app?.permission),
    },
  };
}

export async function getMisoCurrentUser(): Promise<MisoAuthContext> {
  const response = await fetch(`${getApiBase()}/auth/me`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...getAuthHeaders(),
    },
    credentials: "same-origin",
  });

  if (response.status === 401) {
    return anonymousMisoAuthContext;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`MISO auth context failed (${response.status}): ${text}`);
  }

  return normalizeMisoAuthContext((await response.json()) as Partial<MisoAuthContext>);
}
