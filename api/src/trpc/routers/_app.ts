import { createTRPCRouter } from "../init";

// Re-export types from the static type file (type-only, no runtime cost).
export type { AppRouter, RouterInputs, RouterOutputs } from "./_app.types";

// ── Core routers (always loaded) ────────────────────────────────────────
// Only the two routers needed for the initial auth query (user.me,
// team.current). Everything else is in lazy clusters — including the
// "shell" cluster for billing, search, widgets, notifications, etc.
import { teamRouter } from "./team";
import { userRouter } from "./user";

const coreRouters = {
  team: teamRouter,
  user: userRouter,
};

// ── Lazy-loaded clusters ────────────────────────────────────────────────
// Each cluster is a dynamic import that defers module evaluation until
// a procedure in that cluster is actually called. This avoids loading AI
// SDKs, banking integrations, document processing, etc. on cold starts
// that only need core data (user, team, widgets).

type ClusterLoader = () => Promise<Record<string, any>>;

const clusterLoaders: Record<string, ClusterLoader> = {
  shell: () => import("./clusters/shell").then((m) => m.shellRouters),
  finance: () => import("./clusters/finance").then((m) => m.financeRouters),
  invoice: () => import("./clusters/invoice").then((m) => m.invoiceRouters),
  content: () => import("./clusters/content").then((m) => m.contentRouters),
  ai: () => import("./clusters/ai").then((m) => m.aiRouters),
  misc: () => import("./clusters/misc").then((m) => m.miscRouters),
};

// Map each procedure prefix to its cluster name.
const procedureClusterMap: Record<string, string> = {
  // shell (app-shell routers, deferred from core)
  billing: "shell",
  notifications: "shell",
  notificationSettings: "shell",
  search: "shell",
  suggestedActions: "shell",
  support: "shell",
  tags: "shell",
  widgets: "shell",
  // finance
  accounting: "finance",
  bankAccounts: "finance",
  bankConnections: "finance",
  banking: "finance",
  payroll: "finance",
  reports: "finance",
  transactionAttachments: "finance",
  transactionCategories: "finance",
  transactionTags: "finance",
  transactions: "finance",
  vat: "finance",
  yearEnd: "finance",
  // invoice
  invoice: "invoice",
  invoicePayments: "invoice",
  invoiceProducts: "invoice",
  invoiceRecurring: "invoice",
  invoiceTemplate: "invoice",
  // content
  compliance: "content",
  companiesHouse: "content",
  customers: "content",
  documentTagAssignments: "content",
  documentTags: "content",
  documents: "content",
  inbox: "content",
  inboxAccounts: "content",
  uploads: "content",
  // ai
  chats: "ai",
  chatFeedback: "ai",
  insights: "ai",
  // misc
  apiKeys: "misc",
  apps: "misc",
  asyncRuns: "misc",
  institutions: "misc",
  oauthApplications: "misc",
  shortLinks: "misc",
  trackerEntries: "misc",
  trackerProjects: "misc",
};

// ── Dynamic router assembly ─────────────────────────────────────────────

const loadedRouters: Record<string, any> = { ...coreRouters };
const loadedClusters = new Set<string>();
let cachedRouter: ReturnType<typeof createTRPCRouter> = createTRPCRouter(coreRouters);

/**
 * Ensure clusters required for the given procedure paths are loaded,
 * then return the (potentially rebuilt) appRouter.
 */
export async function getRouterForProcedures(procedurePaths: string[]) {
  const missing = new Set<string>();

  for (const path of procedurePaths) {
    const prefix = path.split(".")[0] ?? "";
    const cluster = procedureClusterMap[prefix];
    if (cluster && !loadedClusters.has(cluster)) {
      missing.add(cluster);
    }
  }

  if (missing.size === 0) {
    return cachedRouter;
  }

  const results = await Promise.all(
    [...missing].map(async (name) => {
      const routers = await clusterLoaders[name]!();
      loadedClusters.add(name);
      return routers;
    }),
  );

  for (const routers of results) {
    Object.assign(loadedRouters, routers);
  }

  cachedRouter = createTRPCRouter(loadedRouters);
  return cachedRouter;
}

/**
 * Load ALL clusters and return the complete router.
 * Used when procedure paths can't be determined upfront (e.g. OpenAPI schema).
 */
export async function getFullRouter() {
  const unloaded = Object.keys(clusterLoaders).filter((k) => !loadedClusters.has(k));

  if (unloaded.length > 0) {
    const results = await Promise.all(
      unloaded.map(async (name) => {
        const routers = await clusterLoaders[name]!();
        loadedClusters.add(name);
        return routers;
      }),
    );

    for (const routers of results) {
      Object.assign(loadedRouters, routers);
    }

    cachedRouter = createTRPCRouter(loadedRouters);
  }

  return cachedRouter;
}

// For backwards compat: export appRouter (starts with core, grows at runtime).
export const appRouter = cachedRouter;
