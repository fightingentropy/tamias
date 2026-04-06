import { configureBankingRuntime, type TellerMtlsFetcher } from "@tamias/banking";
import { configureCloudflareAsyncServiceRuntime } from "@tamias/job-client/cloudflare-runtime";
import { createLoggerWithContext, logger } from "@tamias/logger";
import { getApiUrl, getAppUrl } from "@tamias/utils/envs";
import {
  type CloudflareAsyncEnv,
  createInProcessAsyncBridge,
  handleAsyncWorkerHttp,
} from "@tamias/worker/cloudflare";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import {
  buildDependenciesResponse,
  buildReadinessResponse,
  checkDependencies,
} from "./health/checker";
import { apiDependencies } from "./health/probes";
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
  const [
    { trpcServer },
    { OpenAPIHono },
    { Scalar },
    { routers },
    { createTRPCContext },
    { appRouter },
    { httpLogger },
    { getRequestTrace },
  ] = await Promise.all([
    import("@hono/trpc-server"),
    import("@hono/zod-openapi"),
    import("@scalar/hono-api-reference"),
    import("./rest/routers"),
    import("./trpc/init"),
    import("./trpc/routers/_app"),
    import("./utils/logger"),
    import("./utils/request-trace"),
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

  if (process.env.DEBUG_PERF === "true") {
    const perfLogger = createLoggerWithContext("perf:trpc");

    app.use("/trpc/*", async (c, next) => {
      const start = performance.now();
      const { requestId, cfRay } = getRequestTrace(c.req);
      await next();
      const elapsed = performance.now() - start;
      const procedures = c.req.path.replace("/trpc/", "").split(",");
      perfLogger.info("request", {
        totalMs: +elapsed.toFixed(2),
        procedureCount: procedures.length,
        procedures,
        status: c.res.status,
        requestId,
        cfRay,
      });
    });
  }

  app.use(
    "/trpc/*",
    trpcServer({
      router: appRouter,
      createContext: createTRPCContext,
      onError: ({ error, path }) => {
        logger.error(`[tRPC] ${path}`, {
          message: error.message,
          code: error.code,
          cause: error.cause instanceof Error ? error.cause.message : undefined,
          stack: error.stack,
        });
      },
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

function isUnifiedCloudflareWorkerEnv(
  env: ApiRuntimeEnv,
): env is ApiRuntimeEnv & CloudflareAsyncEnv {
  return !!(env.RATE_LIMIT_COORDINATOR && env.RUN_COORDINATOR);
}

function configureApiRuntime(env?: ApiRuntimeEnv) {
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
  configureApiRuntime(env);

  if (isUnifiedCloudflareWorkerEnv(env)) {
    const asyncResponse = await handleAsyncWorkerHttp(request, env);
    if (asyncResponse) {
      return asyncResponse;
    }
  }

  const app = await getApp();
  return app.fetch(request, env as unknown as Env, executionCtx);
}

export default {
  fetch: apiEntryFetch,
};
