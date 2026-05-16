import { getAsyncRun } from "@tamias/app-data/queries";
import { getCurrentUserRunSchema } from "../../schemas/async-runs";
import { createTRPCRouter, protectedProcedure } from "../init";

export const asyncRunsRouter = createTRPCRouter({
  currentUserRun: protectedProcedure
    .input(getCurrentUserRunSchema)
    .query(async ({ ctx: { session, teamId }, input }) => {
      const run = await getAsyncRun(input.runId);

      if (!run) {
        return null;
      }

      const sessionUserIds = new Set(
        [session.user.id, session.user.id].filter(Boolean).map(String),
      );

      if (run.appUserId && sessionUserIds.has(run.appUserId)) {
        return run;
      }

      if (run.teamId && run.teamId === teamId) {
        return run;
      }

      return null;
    }),
});
