import { AsyncLocalStorage } from "node:async_hooks";
import type { DashboardRequestContext } from "./cloudflare-context";

const DASHBOARD_CONTEXT_STORAGE_KEY = Symbol.for("tamias:dashboard-request-context");
const DASHBOARD_CONTEXT_FALLBACK_KEY = Symbol.for("tamias:dashboard-request-context:fallback");

const dashboardContextStorageHost = globalThis as typeof globalThis & {
  [DASHBOARD_CONTEXT_STORAGE_KEY]?: AsyncLocalStorage<DashboardRequestContext>;
  [DASHBOARD_CONTEXT_FALLBACK_KEY]?: DashboardRequestContext;
};

const dashboardContextStorage = (dashboardContextStorageHost[DASHBOARD_CONTEXT_STORAGE_KEY] ??=
  new AsyncLocalStorage<DashboardRequestContext>());

export function runWithDashboardRequestContext<T>(
  context: DashboardRequestContext,
  fn: () => T | Promise<T>,
) {
  const hadPreviousFallback = Object.prototype.hasOwnProperty.call(
    dashboardContextStorageHost,
    DASHBOARD_CONTEXT_FALLBACK_KEY,
  );
  const previousFallback = dashboardContextStorageHost[DASHBOARD_CONTEXT_FALLBACK_KEY];

  const restoreFallback = () => {
    if (hadPreviousFallback) {
      dashboardContextStorageHost[DASHBOARD_CONTEXT_FALLBACK_KEY] = previousFallback;
      return;
    }

    delete dashboardContextStorageHost[DASHBOARD_CONTEXT_FALLBACK_KEY];
  };

  dashboardContextStorageHost[DASHBOARD_CONTEXT_FALLBACK_KEY] = context;
  try {
    const result = dashboardContextStorage.run(context, fn);

    if (result && typeof (result as Promise<T>).finally === "function") {
      return (result as Promise<T>).finally(restoreFallback);
    }

    restoreFallback();
    return result;
  } catch (error) {
    restoreFallback();
    throw error;
  }
}

export function getScopedDashboardRequestContext() {
  return (
    dashboardContextStorage.getStore() ??
    dashboardContextStorageHost[DASHBOARD_CONTEXT_FALLBACK_KEY] ??
    null
  );
}
