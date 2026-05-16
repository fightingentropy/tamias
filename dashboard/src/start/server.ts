import "@/start/html-element-shim";
import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import type {
  DashboardCloudflareEnv,
  DashboardRequestContext,
} from "@/start/server/cloudflare-context";
import { runWithDashboardRequestContext } from "@/start/server/cloudflare-request-scope";

export const startHandler = createStartHandler(defaultStreamHandler);

function createRequestContext(
  env: DashboardCloudflareEnv,
  executionCtx: unknown,
): DashboardRequestContext {
  return {
    cloudflare: {
      env,
      executionCtx,
    },
  };
}

export function createServerEntry(
  entry: { fetch: typeof startHandler },
  options?: {
    internalApiEntry?: (
      request: Request,
      env: DashboardCloudflareEnv,
      executionCtx: ExecutionContext,
    ) => Promise<Response>;
  },
) {
  return {
    async fetch(request: Request, env: DashboardCloudflareEnv, executionCtx: ExecutionContext) {
      const internalApiFetch = options?.internalApiEntry
        ? (incoming: Request) => options.internalApiEntry!(incoming, env, executionCtx)
        : undefined;

      const context = {
        ...createRequestContext(env, executionCtx),
        ...(internalApiFetch ? { internalApiFetch } : {}),
      };

      return runWithDashboardRequestContext(context, () =>
        (entry.fetch as any)(request, { context }),
      );
    },
  };
}

export default createServerEntry({ fetch: startHandler });
