import {
  getSuggestedActionsSchema,
  trackSuggestedActionUsageSchema,
} from "../../schemas/suggested-actions";
import {
  getSuggestedActionUsageFromConvex,
  incrementSuggestedActionUsageInConvex,
} from "@tamias/app-services/suggested-actions";
import { createTRPCRouter, protectedProcedure } from "../init";
import { buildSuggestedActionsList } from "@tamias/app-services/suggested-actions";

export const suggestedActionsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(getSuggestedActionsSchema)
    .query(async ({ ctx: { teamId, session }, input }) => {
      const userId = session.user.convexId;

      if (!userId) {
        throw new Error("Missing Convex user id");
      }

      const allUsage = await getSuggestedActionUsageFromConvex({
        teamId: teamId!,
        userId,
      });

      return buildSuggestedActionsList({
        allUsage,
        limit: input.limit,
      });
    }),

  trackUsage: protectedProcedure
    .input(trackSuggestedActionUsageSchema)
    .mutation(async ({ ctx: { teamId, session }, input }) => {
      if (!session.user.convexId) {
        throw new Error("Missing Convex user id");
      }

      await incrementSuggestedActionUsageInConvex({
        teamId: teamId!,
        userId: session.user.convexId,
        actionId: input.actionId,
      });

      return { success: true };
    }),
});
