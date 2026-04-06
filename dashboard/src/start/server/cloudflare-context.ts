import { getStartContext } from "@tanstack/start-storage-context";

export type ApiServiceBinding = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

export type DashboardCloudflareEnv = {
  API_SERVICE?: ApiServiceBinding;
  TAMIAS_ENVIRONMENT?: string;
  API_URL?: string;
  DASHBOARD_URL?: string;
  WEBSITE_URL?: string;
  CONVEX_URL?: string;
  CONVEX_SITE_URL?: string;
};

export type DashboardRequestContext = {
  cloudflare?: {
    env?: DashboardCloudflareEnv;
    executionCtx?: unknown;
  };
  /** Unified worker: same-island API fetch for SSR tRPC (replaces API_SERVICE binding). */
  internalApiFetch?: (request: Request) => Promise<Response>;
};

export function getDashboardRequestContext() {
  const startContext = getStartContext({ throwIfNotFound: false });

  return (startContext?.contextAfterGlobalMiddlewares ?? null) as DashboardRequestContext | null;
}

export function getApiServiceBinding() {
  const ctx = getDashboardRequestContext();
  const internalApiFetch = ctx?.internalApiFetch;
  if (internalApiFetch) {
    return { fetch: internalApiFetch };
  }
  return ctx?.cloudflare?.env?.API_SERVICE;
}
