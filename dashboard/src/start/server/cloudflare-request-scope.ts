import { AsyncLocalStorage } from "node:async_hooks";
import type { DashboardRequestContext } from "./cloudflare-context";

const DASHBOARD_CONTEXT_STORAGE_KEY = Symbol.for("tamias:dashboard-request-context");
const DASHBOARD_CONTEXT_FALLBACK_KEY = Symbol.for("tamias:dashboard-request-context:fallback");

const dashboardContextStorageHost = globalThis as typeof globalThis & {
  [DASHBOARD_CONTEXT_STORAGE_KEY]?: AsyncLocalStorage<DashboardRequestContext>;
  [DASHBOARD_CONTEXT_FALLBACK_KEY]?: DashboardRequestContext;
};

const dashboardContextStorage =
  dashboardContextStorageHost[DASHBOARD_CONTEXT_STORAGE_KEY] ??=
    new AsyncLocalStorage<DashboardRequestContext>();

export function runWithDashboardRequestContext<T>(
  context: DashboardRequestContext,
  fn: () => T | Promise<T>,
) {
  dashboardContextStorageHost[DASHBOARD_CONTEXT_FALLBACK_KEY] = context;
  return dashboardContextStorage.run(context, fn);
}

export function getScopedDashboardRequestContext() {
  return (
    dashboardContextStorage.getStore() ??
    dashboardContextStorageHost[DASHBOARD_CONTEXT_FALLBACK_KEY] ??
    null
  );
}
