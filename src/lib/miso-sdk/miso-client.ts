/**
 * MISO API Client — DO NOT MODIFY THIS FILE
 *
 * Low-level HTTP client for calling MISO Service API (/ext/v1).
 * Used by miso-hooks.ts.
 *
 * Dev mode: Requests go to /__api/* → SM preview proxy → Flask /ext/v1/*
 *   SM injects API token based on X-Miso-App header.
 * Published mode: Requests go to /site/<site_code>/__api/ext/<appId>/*
 *   and Flask enforces access server-side before proxying.
 */

import { getApiBase, getAuthHeaders } from "./site-client";
import { directLlmErrorFromResponse } from "./direct-llm-error";

function getMisoApiBase(appId?: string): string {
  if (import.meta.env.DEV) return "/__api";
  if (appId) return `${getApiBase()}/ext/${appId}`;
  return getApiBase(); // non-ext paths (tools/invoke, datasets, etc.)
}

export interface MisoRequestOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Query string parameters */
  params?: Record<string, string | number>;
  /** MISO app/dataset ID — sent as X-Miso-App header for multi-token routing */
  appId?: string;
}

interface MisoMultipartRequestOptions extends MisoRequestOptions {
  body: FormData;
}

function buildUrl(path: string, params?: Record<string, string | number>, appId?: string): string {
  const base = getMisoApiBase(appId);
  const url = `${base}${path}`;
  if (!params || Object.keys(params).length === 0) return url;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    qs.set(k, String(v));
  }
  return `${url}?${qs.toString()}`;
}

function buildHeaders(options?: MisoRequestOptions): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...getAuthHeaders(),
    ...options?.headers,
  };
  if (options?.appId) {
    headers["X-Miso-App"] = options.appId;
  }
  return headers;
}

function buildMultipartHeaders(options?: MisoRequestOptions): Record<string, string> {
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
    ...options?.headers,
  };
  if (options?.appId) {
    headers["X-Miso-App"] = options.appId;
  }
  delete headers["Content-Type"];
  return headers;
}

async function request<T = unknown>(
  method: string,
  path: string,
  options?: MisoRequestOptions & { body?: unknown },
): Promise<T> {
  const url = buildUrl(path, options?.params, options?.appId);
  const headers = buildHeaders(options);

  const res = await fetch(url, {
    method,
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
    signal: options?.signal,
  });

  if (!res.ok) {
    if (path === "/tools/invoke") {
      throw await directLlmErrorFromResponse(res);
    }
    const text = await res.text().catch(() => "");
    throw new Error(`MISO API ${method} ${path} failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<T>;
}

async function multipartRequest<T = unknown>(
  path: string,
  options: MisoMultipartRequestOptions,
): Promise<T> {
  const url = buildUrl(path, options.params, options.appId);
  const headers = buildMultipartHeaders(options);

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: options.body,
    signal: options.signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`MISO API upload ${path} failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<T>;
}

// ── SSE Stream Types ──────────────────────────────────────────────

/** Parsed SSE event from MISO streaming response */
export interface MisoSSEEvent {
  event: string;
  task_id?: string;
  message_id?: string;
  conversation_id?: string;
  workflow_run_id?: string;
  answer?: string;
  created_at?: number;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

export type MisoStreamCallback = (event: MisoSSEEvent) => void;

export interface MisoStreamHandle {
  /** Abort the ongoing stream */
  abort: () => void;
}

/**
 * POST request that returns an SSE stream.
 * Calls `onEvent` for each parsed SSE event.
 * Returns a handle with abort().
 */
function streamRequest(
  path: string,
  options: MisoRequestOptions & {
    body?: unknown;
    onEvent: MisoStreamCallback;
    onError?: (error: Error) => void;
    onDone?: () => void;
  },
): MisoStreamHandle {
  const controller = new AbortController();
  const url = buildUrl(path, options.params, options.appId);
  const headers = buildHeaders(options);

  const run = async () => {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`MISO API stream ${path} failed (${res.status}): ${text}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body for stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep the last (potentially incomplete) line in the buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const jsonStr = trimmed.slice(6); // strip "data: "
          if (!jsonStr) continue;
          try {
            const event = JSON.parse(jsonStr) as MisoSSEEvent;
            options.onEvent(event);
          } catch {
            // Skip malformed JSON lines
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim().startsWith("data: ")) {
        try {
          const event = JSON.parse(buffer.trim().slice(6)) as MisoSSEEvent;
          options.onEvent(event);
        } catch {
          // ignore
        }
      }

      options.onDone?.();
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        options.onDone?.();
        return;
      }
      options.onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  };

  run();

  return { abort: () => controller.abort() };
}

// ── Exports ───────────────────────────────────────────────────────

export const misoClient = {
  get: <T = unknown>(path: string, options?: MisoRequestOptions) =>
    request<T>("GET", path, options),
  post: <T = unknown>(
    path: string,
    options?: MisoRequestOptions & { body?: unknown },
  ) => request<T>("POST", path, options),
  put: <T = unknown>(
    path: string,
    options?: MisoRequestOptions & { body?: unknown },
  ) => request<T>("PUT", path, options),
  del: <T = unknown>(path: string, options?: MisoRequestOptions) =>
    request<T>("DELETE", path, options),
  upload: <T = unknown>(
    path: string,
    options: MisoMultipartRequestOptions,
  ) => multipartRequest<T>(path, options),
  /** POST with SSE streaming response */
  stream: streamRequest,
};
