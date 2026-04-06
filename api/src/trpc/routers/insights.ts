import {
  dismissInsight,
  getInsightById,
  getInsightByPeriod,
  getInsightsForUser,
  getLatestInsight,
  markInsightAsRead,
  updateInsight,
} from "@tamias/app-data/queries";
import { canGenerateAudio, generateInsightAudio } from "@tamias/insights/audio";
import { createLoggerWithContext } from "@tamias/logger";
import { TRPCError } from "@trpc/server";
import {
  dismissInsightSchema,
  insightAudioUrlSchema,
  insightByIdSchema,
  insightByPeriodSchema,
  latestInsightSchema,
  listInsightsSchema,
  markInsightAsReadSchema,
} from "../../schemas/insights";
import { getVaultSignedUrl } from "../../services/storage";
import { createTRPCRouter, protectedProcedure } from "../init";

const logger = createLoggerWithContext("trpc:insights");

export const insightsRouter = createTRPCRouter({
  /**
   * Get paginated list of insights for the team with user's read/dismiss status
   * By default, filters out insights the user has dismissed
   */
  list: protectedProcedure
    .input(listInsightsSchema)
    .query(async ({ ctx: { db, teamId, session }, input }) => {
      if (!session.user.convexId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Missing Convex user id",
        });
      }

      return getInsightsForUser(db, {
        teamId: teamId!,
        userId: session.user.convexId,
        periodType: input.periodType,
        pageSize: input.limit,
        cursor: input.cursor,
        includeDismissed: input.includeDismissed,
        status: "completed",
      });
    }),

  /**
   * Get the most recent completed insight
   */
  latest: protectedProcedure
    .input(latestInsightSchema)
    .query(async ({ ctx: { db, teamId }, input }) => {
      return getLatestInsight(db, {
        teamId: teamId!,
        periodType: input.periodType,
      });
    }),

  /**
   * Get a specific insight by ID
   */
  byId: protectedProcedure
    .input(insightByIdSchema)
    .query(async ({ ctx: { db, teamId }, input }) => {
      const insight = await getInsightById(db, {
        id: input.id,
        teamId: teamId!,
      });

      if (!insight) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Insight not found",
        });
      }

      return insight;
    }),

  /**
   * Get insight for a specific period
   */
  byPeriod: protectedProcedure
    .input(insightByPeriodSchema)
    .query(async ({ ctx: { db, teamId }, input }) => {
      const insight = await getInsightByPeriod(db, {
        teamId: teamId!,
        periodType: input.periodType,
        periodYear: input.periodYear,
        periodNumber: input.periodNumber,
      });

      if (!insight) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Insight not found for this period",
        });
      }

      return insight;
    }),

  /**
   * Get presigned URL for insight audio
   * Audio is generated on-demand if not already cached.
   * Returns a short-lived URL (1 hour) for dashboard playback.
   */
  audioUrl: protectedProcedure
    .input(insightAudioUrlSchema)
    .query(async ({ ctx: { db, teamId }, input }) => {
      const insight = await getInsightById(db, {
        id: input.id,
        teamId: teamId!,
      });

      if (!insight) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Insight not found",
        });
      }

      let audioPath = insight.audioPath;

      // Lazy generation: generate audio if not already cached
      if (!audioPath) {
        if (!canGenerateAudio(insight)) {
          return {
            audioUrl: null,
            expiresIn: null,
          };
        }

        try {
          const result = await generateInsightAudio(insight);
          audioPath = result.audioPath;

          // Update the insight with the new audio path for future requests
          await updateInsight(db, {
            id: insight.id,
            teamId: insight.teamId,
            audioPath,
          });
        } catch (error) {
          logger.error("Failed to generate audio", {
            error: error instanceof Error ? error.message : String(error),
          });
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to generate audio",
          });
        }
      }

      // Generate presigned URL (1 hour for dashboard playback)
      const { data, error } = await getVaultSignedUrl({
        path: audioPath,
        expireIn: 60 * 60,
      });

      if (error || !data?.signedUrl) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate audio URL",
        });
      }

      return {
        audioUrl: data.signedUrl,
        expiresIn: 60 * 60, // seconds
      };
    }),

  /**
   * Mark an insight as read for the current user
   * Safe to call multiple times - only sets readAt if not already set
   */
  markAsRead: protectedProcedure
    .input(markInsightAsReadSchema)
    .mutation(async ({ ctx: { db, teamId, session }, input }) => {
      if (!session.user.convexId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Missing Convex user id",
        });
      }

      // Verify the insight belongs to the user's team
      const insight = await getInsightById(db, {
        id: input.id,
        teamId: teamId!,
      });

      if (!insight) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Insight not found",
        });
      }

      const result = await markInsightAsRead(db, {
        insightId: input.id,
        userId: session.user.convexId,
      });

      return { success: true, readAt: result.readAt };
    }),

  /**
   * Dismiss an insight for the current user
   * The insight will no longer appear in their list unless includeDismissed is true
   */
  dismiss: protectedProcedure
    .input(dismissInsightSchema)
    .mutation(async ({ ctx: { db, teamId, session }, input }) => {
      if (!session.user.convexId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Missing Convex user id",
        });
      }

      // Verify the insight belongs to the user's team
      const insight = await getInsightById(db, {
        id: input.id,
        teamId: teamId!,
      });

      if (!insight) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Insight not found",
        });
      }

      const result = await dismissInsight(db, {
        insightId: input.id,
        userId: session.user.convexId,
      });

      return { success: true, dismissedAt: result.dismissedAt };
    }),
});
