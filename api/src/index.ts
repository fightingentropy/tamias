// ── Lightweight top-level imports only ──────────────────────────────────
// Heavy modules (banking, job-client, worker infra, health probes) are
// deferred to dynamic imports so tRPC cold starts don't pay their cost.
import { logger } from "@tamias/logger";
import { getApiUrl, getAppUrl } from "@tamias/utils/envs";
import type { Context } from "./rest/types";

export { RateLimitCoordinator } from "./rate-limit/coordinator";

const dashboardUrl = getAppUrl();
const apiUrl = getApiUrl();
const sharedLocalDashboardOrigins = [
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "http://app.tamias.test:3001",
  "http://tamias.test:3001",
];

// ── Lightweight tRPC fast-path ─────────────────────────────────────────
// Handles tRPC requests WITHOUT loading the full Hono app (Scalar, OpenAPI,
// REST routers, etc.) which adds ~2s of CPU time. Only loads the tRPC
// router, context, and fetch adapter — everything else is deferred.

const CACHEABLE_PROCEDURES = new Map<string, number>([
  ["user.me", 60],
  ["team.current", 60],
  ["widgets.getOverview", 30],
  ["widgets.getAccountBalances", 30],
  ["widgets.getOutstandingInvoices", 30],
  ["widgets.getInboxStats", 30],
  ["notificationSettings.get", 120],
]);

let trpcDepsPromise: Promise<{
  fetchRequestHandler: typeof import("@trpc/server/adapters/fetch").fetchRequestHandler;
  createTRPCContext: typeof import("./trpc/init").createTRPCContext;
  getRouterForProcedures: typeof import("./trpc/routers/_app").getRouterForProcedures;
}> | null = null;

function getTrpcDeps() {
  trpcDepsPromise ??= Promise.all([
    import("@trpc/server/adapters/fetch"),
    import("./trpc/init"),
    import("./trpc/routers/_app"),
  ]).then(([fetchMod, initMod, appMod]) => ({
    fetchRequestHandler: fetchMod.fetchRequestHandler,
    createTRPCContext: initMod.createTRPCContext,
    getRouterForProcedures: appMod.getRouterForProcedures,
  }));
  return trpcDepsPromise;
}

function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") ?? "";
  if (!allowedApiOrigins.includes(origin)) {
    return {};
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS,PATCH",
    "Access-Control-Allow-Headers":
      "Authorization,Content-Type,User-Agent,accept-language,cf-ray,trpc-accept,x-request-id,x-trpc-source,x-user-locale,x-user-timezone,x-user-country,x-slack-signature,x-slack-request-timestamp",
    "Access-Control-Expose-Headers": "Content-Length,Content-Type,Cache-Control,Cross-Origin-Resource-Policy",
    "Access-Control-Max-Age": "86400",
  };
}

async function handleTrpcFastPath(
  request: Request,
  executionCtx: ExecutionContext,
): Promise<Response> {
  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(request) });
  }

  const url = new URL(request.url);
  const procedurePath = url.pathname.replace("/trpc/", "");
  const procedures = procedurePath.split(",");
  const corsHeaders = getCorsHeaders(request);

  // ── Edge cache for hot tRPC GET queries ────────────────────────────
  if (request.method === "GET") {
    const minTtl = procedures.reduce((min, proc) => {
      const ttl = CACHEABLE_PROCEDURES.get(proc);
      return ttl !== undefined ? Math.min(min, ttl) : -1;
    }, Infinity);

    if (minTtl > 0 && Number.isFinite(minTtl)) {
      const authHeader = request.headers.get("Authorization") ?? "";
      const tokenBytes = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(authHeader),
      );
      const tokenHash = [...new Uint8Array(tokenBytes)]
        .slice(0, 8)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const cacheUrl = new URL(request.url);
      cacheUrl.searchParams.set("_ck", tokenHash);
      const cacheKey = new Request(cacheUrl.toString());

      const cache = (caches as unknown as { default: Cache }).default;
      const cached = await cache.match(cacheKey);
      if (cached) {
        const headers = new Headers(cached.headers);
        for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
        return new Response(cached.body, { status: cached.status, headers });
      }

      // Cache miss — resolve tRPC, then cache the response
      const response = await callTrpcHandler(request, procedures, corsHeaders);

      if (response.ok) {
        const responseToCache = response.clone();
        const cacheHeaders = new Headers(responseToCache.headers);
        cacheHeaders.set(
          "Cache-Control",
          `s-maxage=${minTtl}, stale-while-revalidate=${minTtl * 2}`,
        );
        // Cache Tags enable targeted purge via Cloudflare API
        const tags = [
          `user-${tokenHash}`,
          "trpc",
          ...new Set(procedures.map((p) => p.split(".")[0]!)),
        ];
        cacheHeaders.set("Cache-Tag", tags.join(","));
        const cacheable = new Response(responseToCache.body, {
          status: responseToCache.status,
          headers: cacheHeaders,
        });
        executionCtx.waitUntil(cache.put(cacheKey, cacheable));
      }

      return response;
    }
  }

  // ── Non-cacheable tRPC request ─────────────────────────────────────
  return callTrpcHandler(request, procedures, corsHeaders);
}

async function callTrpcHandler(
  request: Request,
  procedures: string[],
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const { fetchRequestHandler, createTRPCContext, getRouterForProcedures } =
    await getTrpcDeps();
  const router = await getRouterForProcedures(procedures);

  const response = await fetchRequestHandler({
    endpoint: "/trpc",
    req: request,
    router,
    createContext: async (_opts) =>
      createTRPCContext(_opts, {
        req: { raw: request },
        header: () => {},
      }),
    onError: ({ error, path }) => {
      logger.error(`[tRPC] ${path}`, {
        message: error.message,
        code: error.code,
        cause: error.cause instanceof Error ? error.cause.message : undefined,
      });
    },
  });

  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
  return new Response(response.body, { status: response.status, headers });
}

// ── Runtime configuration (lazy, cached) ───────────────────────────────

type TellerMtlsFetcher = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

type ApiRuntimeEnv = {
  RATE_LIMIT_COORDINATOR?: DurableObjectNamespace;
  /** Present in unified dashboard+API+async worker deploys */
  RUN_COORDINATOR?: DurableObjectNamespace;
  TELLER_MTLS_CERTIFICATE?: TellerMtlsFetcher;
};

function getAllowedApiOrigins() {
  const allowedOrigins = new Set<string>();

  const addOrigin = (value?: string | null) => {
    if (!value) {
      return;
    }

    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return;
    }

    try {
      allowedOrigins.add(new URL(trimmedValue).origin);
    } catch {
      logger.warn("Ignoring invalid API CORS origin", {
        origin: trimmedValue,
      });
    }
  };

  for (const origin of process.env.ALLOWED_API_ORIGINS?.split(",") ?? []) {
    addOrigin(origin);
  }

  for (const origin of sharedLocalDashboardOrigins) {
    addOrigin(origin);
  }

  addOrigin(dashboardUrl);

  try {
    const dashboardOrigin = new URL(dashboardUrl);
    const isLocalhost =
      dashboardOrigin.hostname === "localhost" || dashboardOrigin.hostname === "127.0.0.1";

    if (!isLocalhost && dashboardOrigin.hostname.startsWith("app.")) {
      addOrigin(`${dashboardOrigin.protocol}//${dashboardOrigin.host.replace(/^app\./, "")}`);
    }

    if (
      !isLocalhost &&
      !dashboardOrigin.hostname.startsWith("app.") &&
      dashboardOrigin.hostname.includes(".")
    ) {
      addOrigin(`${dashboardOrigin.protocol}//app.${dashboardOrigin.host}`);
    }
  } catch {
    logger.warn("Unable to derive API CORS aliases from dashboard URL", {
      dashboardUrl,
    });
  }

  return [...allowedOrigins];
}

const allowedApiOrigins = getAllowedApiOrigins();
let appPromise: Promise<Awaited<ReturnType<typeof createApp>>> | null = null;

async function createApp() {
  // This app handles REST, OpenAPI, health, and Scalar only. tRPC requests
  // are handled by the fast-path above (handleTrpcFastPath).
  const [
    { OpenAPIHono },
    { Scalar },
    { routers },
    { httpLogger },
    { cors },
    { secureHeaders },
    { buildDependenciesResponse, buildReadinessResponse, checkDependencies },
    { apiDependencies },
  ] = await Promise.all([
    import("@hono/zod-openapi"),
    import("@scalar/hono-api-reference"),
    import("./rest/routers"),
    import("./utils/logger"),
    import("hono/cors"),
    import("hono/secure-headers"),
    import("./health/checker"),
    import("./health/probes"),
  ]);

  const app = new OpenAPIHono<Context>();

  app.use(httpLogger());
  app.use("/files/*", async (c, next) => {
    await next();
    c.res.headers.delete("X-Frame-Options");
  });
  app.use(
    secureHeaders({
      crossOriginResourcePolicy: "cross-origin",
    }),
  );

  app.use(
    "*",
    cors({
      origin: allowedApiOrigins,
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
      allowHeaders: [
        "Authorization",
        "Content-Type",
        "User-Agent",
        "accept-language",
        "cf-ray",
        "trpc-accept",
        "x-request-id",
        "x-trpc-source",
        "x-user-locale",
        "x-user-timezone",
        "x-user-country",
        "x-slack-signature",
        "x-slack-request-timestamp",
      ],
      exposeHeaders: [
        "Content-Length",
        "Content-Type",
        "Cache-Control",
        "Cross-Origin-Resource-Policy",
      ],
      maxAge: 86400,
    }),
  );

  app.get("/favicon.ico", (c) => c.body(null, 204));
  app.get("/robots.txt", (c) => c.body(null, 204));

  app.get("/health", (c) => c.json({ status: "ok" }, 200));

  app.get("/health/ready", async (c) => {
    const results = await checkDependencies(apiDependencies(), 1);
    const response = buildReadinessResponse(results);
    return c.json(response, response.status === "ok" ? 200 : 503);
  });

  app.get("/health/dependencies", async (c) => {
    const results = await checkDependencies(apiDependencies());
    const response = buildDependenciesResponse(results);
    return c.json(response, response.status === "ok" ? 200 : 503);
  });

  app.doc("/openapi", {
    openapi: "3.1.0",
    info: {
      version: "0.0.1",
      title: "Tamias API",
      description:
        "Tamias is a platform for Invoicing, Time tracking, File reconciliation, Storage, Financial Overview & your own Assistant.",
      contact: {
        name: "Tamias Support",
        email: "engineer@tamias.xyz",
        url: dashboardUrl,
      },
    },
    servers: [
      {
        url: apiUrl,
        description: "Production API",
      },
    ],
    security: [
      {
        oauth2: [],
      },
      { token: [] },
    ],
  });

  app.openAPIRegistry.registerComponent("securitySchemes", "token", {
    type: "http",
    scheme: "bearer",
    description: "Default authentication mechanism",
    "x-speakeasy-example": "TAMIAS_API_KEY",
  });

  app.get("/", Scalar({ url: "/openapi", pageTitle: "Tamias API", theme: "saturn" }));

  app.route("/", routers);

  app.onError((err, c) => {
    logger.error(`[Hono] ${c.req.method} ${c.req.path}`, {
      message: err.message,
      stack: err.stack,
    });
    return c.json({ error: "Internal Server Error" }, 500);
  });

  return app;
}

async function getApp() {
  appPromise ??= createApp();
  return appPromise;
}

// Cache runtime configuration — only configure once per isolate.
let runtimeConfigured = false;

async function configureApiRuntime(env?: ApiRuntimeEnv) {
  if (runtimeConfigured) return;
  runtimeConfigured = true;

  const [
    { configureBankingRuntime },
    { configureCloudflareAsyncServiceRuntime },
    { createInProcessAsyncBridge },
  ] = await Promise.all([
    import("@tamias/banking/runtime"),
    import("@tamias/job-client/cloudflare-runtime"),
    import("@tamias/worker/cloudflare"),
  ]);

  const asyncWorker =
    env && isUnifiedCloudflareWorkerEnv(env) ? createInProcessAsyncBridge(env) : null;

  configureCloudflareAsyncServiceRuntime(asyncWorker ? { asyncWorker } : null);
  configureBankingRuntime({
    tellerMtlsFetcher: env?.TELLER_MTLS_CERTIFICATE,
  });
}

export async function apiEntryFetch(
  request: Request,
  env: ApiRuntimeEnv,
  executionCtx: ExecutionContext,
) {
  const url = new URL(request.url);

  // Fast-path: respond to /health immediately without loading the full app.
  if (url.pathname === "/health") {
    return Response.json({ status: "ok" }, {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Fast-path: tRPC requests bypass the full Hono app (Scalar, OpenAPI, REST
  // routers, health probes, etc.). Only loads the tRPC router, context, and
  // fetch adapter — no banking, Plaid, Convex, or worker infra needed.
  if (url.pathname.startsWith("/trpc/")) {
    return handleTrpcFastPath(request, executionCtx);
  }

  // Non-tRPC requests need the full runtime (banking, async worker, etc.)
  await configureApiRuntime(env);

  const app = await getApp();
  return app.fetch(request, env as unknown as Env, executionCtx);
}

export default {
  fetch: apiEntryFetch,
};
