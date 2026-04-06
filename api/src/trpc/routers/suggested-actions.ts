import { isHostedConvexMissingServiceKey } from "@tamias/app-services/convex-client";
import {
  buildSuggestedActionsList,
  getSuggestedActionUsageFromConvex,
  incrementSuggestedActionUsageInConvex,
} from "@tamias/app-services/suggested-actions";
import {
  getSuggestedActionsSchema,
  trackSuggestedActionUsageSchema,
} from "../../schemas/suggested-actions";
import { isMissingConvexServiceKeyError } from "../convex-service-dev-fallback";
import { createTRPCRouter, protectedProcedure } from "../init";

export const suggestedActionsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(getSuggestedActionsSchema)
    .query(async ({ ctx: { teamId, session }, input }) => {
      const userId = session.user.convexId;

      if (!userId) {
        throw new Error("Missing Convex user id");
      }

      if (isHostedConvexMissingServiceKey()) {
        return buildSuggestedActionsList({
          allUsage: {},
          limit: input.limit,
        });
      }

      try {
        const allUsage = await getSuggestedActionUsageFromConvex({
          teamId: teamId!,
          userId,
        });

        return buildSuggestedActionsList({
          allUsage,
          limit: input.limit,
        });
      } catch (error) {
        if (isMissingConvexServiceKeyError(error)) {
          return buildSuggestedActionsList({
            allUsage: {},
            limit: input.limit,
          });
        }

        throw error;
      }
    }),

  trackUsage: protectedProcedure
    .input(trackSuggestedActionUsageSchema)
    .mutation(async ({ ctx: { teamId, session }, input }) => {
      if (!session.user.convexId) {
        throw new Error("Missing Convex user id");
      }

      if (isHostedConvexMissingServiceKey()) {
        return { success: true };
      }

      try {
        await incrementSuggestedActionUsageInConvex({
          teamId: teamId!,
          userId: session.user.convexId,
          actionId: input.actionId,
        });
      } catch (error) {
        if (!isMissingConvexServiceKeyError(error)) {
          throw error;
        }
      }

      return { success: true };
    }),
});
