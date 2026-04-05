import "@/start/html-element-shim";
import {
  createStartHandler,
  defaultStreamHandler,
} from "@tanstack/react-start/server";
import type {
  DashboardCloudflareEnv,
  DashboardRequestContext,
} from "@/start/server/cloudflare-context";

const startHandler = createStartHandler(defaultStreamHandler);

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

export function createServerEntry(entry: { fetch: typeof startHandler }) {
  return {
    async fetch(
      request: Request,
      env: DashboardCloudflareEnv,
      executionCtx: unknown,
    ) {
      return (entry.fetch as any)(request, {
        context: createRequestContext(env, executionCtx),
      });
    },
  };
}

export default createServerEntry({ fetch: startHandler });
