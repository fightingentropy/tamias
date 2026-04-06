import "@/start/html-element-shim";
import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import type {
  DashboardCloudflareEnv,
  DashboardRequestContext,
} from "@/start/server/cloudflare-context";

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

      return (entry.fetch as any)(request, {
        context: {
          ...createRequestContext(env, executionCtx),
          ...(internalApiFetch ? { internalApiFetch } : {}),
        },
      });
    },
  };
}

export default createServerEntry({ fetch: startHandler });
