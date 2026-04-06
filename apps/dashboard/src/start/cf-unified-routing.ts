import type { DashboardCloudflareEnv } from "@/start/server/cloudflare-context";

const API_PREFIX_SEGMENTS = new Set([
  "trpc",
  "health",
  "openapi",
  "oauth",
  "webhook",
  "files",
  "apps",
  "invoice-payments",
  "notifications",
  "transactions",
  "teams",
  "users",
  "customers",
  "bank-accounts",
  "tags",
  "documents",
  "inbox",
  "insights",
  "invoices",
  "search",
  "reports",
  "tracker-projects",
  "tracker-entries",
  "chat",
  "transcription",
  "mcp",
  "internal",
]);

const LIKELY_DOCUMENT_NAVIGATION_SEGMENTS = new Set([
  "inbox",
  "teams",
  "invoices",
  "customers",
  "documents",
  "transactions",
  "insights",
  "notifications",
  "users",
  "bank-accounts",
  "tags",
  "reports",
  "tracker-projects",
  "tracker-entries",
  "chat",
  "search",
  "oauth",
  "invoice-payments",
  "apps",
]);

function firstPathSegment(pathname: string): string | null {
  const seg = pathname.split("/").filter(Boolean)[0];
  return seg ?? null;
}

function pathnameLooksLikeApi(pathname: string): boolean {
  if (
    pathname.startsWith("/trpc") ||
    pathname.startsWith("/health") ||
    pathname.startsWith("/openapi") ||
    pathname.startsWith("/files/") ||
    pathname.startsWith("/internal")
  ) {
    return true;
  }

  if (pathname === "/favicon.ico" || pathname === "/robots.txt") {
    return true;
  }

  const seg = firstPathSegment(pathname);
  return !!seg && API_PREFIX_SEGMENTS.has(seg);
}

function isLocalLoopbackHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function preferDashboardForSharedPath(request: Request, pathname: string) {
  const seg = firstPathSegment(pathname);
  if (!seg || !LIKELY_DOCUMENT_NAVIGATION_SEGMENTS.has(seg)) {
    return false;
  }

  if (request.method !== "GET") {
    return false;
  }

  const accept = request.headers.get("Accept") ?? "";
  return (
    accept.includes("text/html") || accept === "" || accept.includes("*/*")
  );
}

/**
 * Routes requests to the Hono API vs TanStack Start handlers in the unified worker.
 * Production relies on distinct API vs app hostnames; local wrangler uses path + Accept heuristics.
 */
export function shouldServeApi(
  request: Request,
  env: DashboardCloudflareEnv,
): boolean {
  const url = new URL(request.url);

  let apiHost: string;
  let dashboardHost: string;
  try {
    apiHost = new URL(env.API_URL ?? "").hostname;
    dashboardHost = new URL(env.DASHBOARD_URL ?? "").hostname;
  } catch {
    return false;
  }

  if (!apiHost) {
    return false;
  }

  if (url.hostname === apiHost && apiHost !== dashboardHost) {
    return true;
  }

  if (isLocalLoopbackHost(url.hostname) && pathnameLooksLikeApi(url.pathname)) {
    if (preferDashboardForSharedPath(request, url.pathname)) {
      return false;
    }
    return true;
  }

  return false;
}
