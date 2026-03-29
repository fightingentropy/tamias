import { setupAnalytics } from "@tamias/events/server";
import {
  createSafeActionClient,
  DEFAULT_SERVER_ERROR_MESSAGE,
} from "next-safe-action";
import { z } from "zod";
import { configureDashboardAsyncWorkerRuntime } from "@/server/cloudflare-async-worker";
import { getCurrentUserLocally } from "@/server/loaders/identity";
import { logger } from "@/utils/logger";

export const actionClient = createSafeActionClient({
  handleServerError(e) {
    if (e instanceof Error) {
      return e.message;
    }

    return DEFAULT_SERVER_ERROR_MESSAGE;
  },
});

export const actionClientWithMeta = createSafeActionClient({
  defineMetadataSchema() {
    return z.object({
      name: z.string(),
      track: z
        .object({
          event: z.string(),
          channel: z.string(),
        })
        .optional(),
    });
  },
  handleServerError(e) {
    if (e instanceof Error) {
      return e.message;
    }

    return DEFAULT_SERVER_ERROR_MESSAGE;
  },
});

export const authActionClient = actionClientWithMeta
  .use(async ({ next, clientInput, metadata }) => {
    configureDashboardAsyncWorkerRuntime();
    const result = await next({ ctx: {} });

    if (process.env.NODE_ENV === "development") {
      logger("Input ->", clientInput);
      logger("Result ->", result.data);
      logger("Metadata ->", metadata);

      return result;
    }

    return result;
  })
  .use(async ({ next, metadata }) => {
    const user = await getCurrentUserLocally();

    if (!user) {
      throw new Error("Unauthorized");
    }

    const analytics = await setupAnalytics();

    if (metadata?.track) {
      analytics.track(metadata.track);
    }

    return next({
      ctx: {
        analytics,
        user,
        teamId: user.teamId,
      },
    });
  });
