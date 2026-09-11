/// <reference types="vite/client" />

/**
 * Site Client — Mode-Aware Routing Helpers
 *
 * Dev mode: SM preview proxy handles auth. API calls go to /__api/*.
 * Published mode: API/runtime/external calls go directly to /site/<site_code>/__*.
 * API/runtime/external calls go to /site/<site_code>/__* and are
 * authorized server-side via same-origin cookies.
 *
 * Exports:
 *   getApiBase()      — "/__api" (dev) or "/site/<code>/__api" (published)
 *   getRuntimeBase()  — "/__runtime" (dev) or "/site/<code>/__runtime" (published)
 *   getExternalBase() — "/__external" (dev) or "/site/<code>/__external" (published)
 *   getAuthHeaders()  — empty; published auth is cookie-driven
 *   initBootstrap()   — legacy no-op
 *
 * NOTE: dev 의 root-absolute path (/__api 등) 는 miso-proxy-plugin 의 fetch
 * monkey-patch 가 자동으로 `${basePath}__api` (즉 `/service/coder/preview/
 * <sessionId>/__api`) 로 rewrite 해 SM 의 preview wildcard 라우트로 흘려
 * 보낸다. 따라서 이 파일에서는 prefix 처리하지 않고 root-absolute 만 반환.
 */

function getPublishedSiteBase(): string | null {
  const siteCode = resolveSiteCode();
  return siteCode ? `/site/${siteCode}` : null;
}

/**
 * Legacy compatibility hook. Published mode no longer requires bootstrap.
 */
export async function initBootstrap(): Promise<void> {
  return;
}

/**
 * Legacy compatibility hook. Runtime requests no longer depend on bootstrap.
 */
export async function ensureAuth(): Promise<void> {
  return;
}

/**
 * Legacy compatibility hook. No bootstrap refresh path remains.
 */
export async function refreshAuth(): Promise<void> {
  return;
}

/** API base URL: dev goes through SM, published goes through the site path. */
export function getApiBase(): string {
  if (import.meta.env.DEV) return "/__api";
  return `${getPublishedSiteBase()}/__api`;
}

/** PB runtime base URL. */
export function getRuntimeBase(): string {
  if (import.meta.env.DEV) return "/__runtime";
  return `${getPublishedSiteBase()}/__runtime`;
}

/** External outbound proxy base URL. */
export function getExternalBase(): string {
  if (import.meta.env.DEV) return "/__external";
  return `${getPublishedSiteBase()}/__external`;
}

/** Auth headers: published mode uses same-origin cookies; no client token exchange. */
export function getAuthHeaders(): Record<string, string> {
  return {};
}

/**
 * Base path for client-side routers (React Router `basename`, etc.).
 *
 * Dev: returns "" (root).
 * Published: returns "/site/<site_code>" (no trailing slash).
 *
 * Usage:
 *   <BrowserRouter basename={getBasePath()}>
 */
export function getBasePath(): string {
  if (import.meta.env.DEV) return "";
  const siteCode = resolveSiteCode();
  return siteCode ? `/site/${siteCode}` : "";
}

/** Published site code from `/site/<site_code>/...`, or null in coder preview/dev. */
export function getPublishedSiteCode(): string | null {
  return resolveSiteCode();
}

/** Extract site code from the URL path: /site/<site_code>/... */
function resolveSiteCode(): string | null {
  const match = window.location.pathname.match(/^\/site\/([^/]+)/);
  return match ? match[1] : null;
}
