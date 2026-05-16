import { getSuggestedActionUsage, incrementSuggestedActionUsage } from "@tamias/app-data/queries";
import { buildSuggestedActionsList } from "@tamias/app-services/suggested-actions";
import {
  getSuggestedActionsSchema,
  trackSuggestedActionUsageSchema,
} from "../../schemas/suggested-actions";
import { createTRPCRouter, protectedProcedure } from "../init";

export const suggestedActionsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(getSuggestedActionsSchema)
    .query(async ({ ctx: { db, teamId, session }, input }) => {
      const allUsage = await getSuggestedActionUsage(db, {
        teamId: teamId!,
        userId: session.user.id,
      });

      return buildSuggestedActionsList({
        allUsage,
        limit: input.limit,
      });
    }),

  trackUsage: protectedProcedure
    .input(trackSuggestedActionUsageSchema)
    .mutation(async ({ ctx: { db, teamId, session }, input }) => {
      await incrementSuggestedActionUsage(db, {
        teamId: teamId!,
        userId: session.user.id,
        actionId: input.actionId,
      });

      return { success: true };
    }),
});
