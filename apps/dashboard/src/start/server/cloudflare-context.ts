import { getStartContext } from "@tanstack/start-storage-context";

export type ApiServiceBinding = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

export type DashboardCloudflareEnv = {
  API_SERVICE?: ApiServiceBinding;
};

export type DashboardRequestContext = {
  cloudflare?: {
    env?: DashboardCloudflareEnv;
    executionCtx?: unknown;
  };
};

export function getDashboardRequestContext() {
  const startContext = getStartContext({ throwIfNotFound: false });

  return (startContext?.contextAfterGlobalMiddlewares ??
    null) as DashboardRequestContext | null;
}

export function getApiServiceBinding() {
  return getDashboardRequestContext()?.cloudflare?.env?.API_SERVICE;
}
