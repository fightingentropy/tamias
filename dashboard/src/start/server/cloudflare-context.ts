import { createIsomorphicFn } from "@tanstack/react-start";
import { getStartContext } from "@tanstack/start-storage-context";

export type DashboardCloudflareEnv = {
  TAMIAS_ENVIRONMENT?: string;
  API_URL?: string;
  DASHBOARD_URL?: string;
  WEBSITE_URL?: string;
};

export type DashboardRequestContext = {
  cloudflare?: {
    env?: DashboardCloudflareEnv;
    executionCtx?: unknown;
  };
  /** Unified worker: same-island API fetch for SSR tRPC. */
  internalApiFetch?: (request: Request) => Promise<Response>;
};

const getDashboardRequestContextImpl = createIsomorphicFn()
  .client(() => null as DashboardRequestContext | null)
  .server(() => {
    const startContext = getStartContext({ throwIfNotFound: false });

    return (startContext?.contextAfterGlobalMiddlewares ?? null) as DashboardRequestContext | null;
  });

export function getDashboardRequestContext() {
  return getDashboardRequestContextImpl();
}

const getInternalApiFetchImpl = createIsomorphicFn()
  .client(() => undefined as DashboardRequestContext["internalApiFetch"])
  .server(() => {
    const ctx = getDashboardRequestContext();

    return ctx?.internalApiFetch;
  });

export function getInternalApiFetch() {
  return getInternalApiFetchImpl();
}
