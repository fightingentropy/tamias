import { createTRPCRouter, protectedProcedure } from "../init";
import { getCurrentUserRunSchema } from "../../schemas/async-runs";
import { api, withUserConvexClient } from "../../services/convex-user";

export const asyncRunsRouter = createTRPCRouter({
  currentUserRun: protectedProcedure
    .input(getCurrentUserRunSchema)
    .query(async ({ ctx: { accessToken }, input }) => {
      return withUserConvexClient(accessToken, (client) =>
        client.query(api.asyncRuns.currentUserRun, {
          runId: input.runId,
        }),
      );
    }),
});
