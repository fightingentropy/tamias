import {
  bulkUpdateNotificationSettingsSchema,
  getNotificationSettingsSchema,
  updateNotificationSettingSchema,
} from "../../schemas/notification-settings";
import { createTRPCRouter, protectedProcedure } from "../init";
import {
  bulkUpdateNotificationSettings,
  getNotificationSettings,
  getUserNotificationPreferences,
  upsertNotificationSetting,
} from "@tamias/app-data/queries";

export const notificationSettingsRouter = createTRPCRouter({
  get: protectedProcedure
    .input(getNotificationSettingsSchema.optional())
    .query(async ({ ctx: { db, session, teamId }, input = {} }) => {
      if (!session.user.convexId) {
        throw new Error("Missing Convex user id");
      }

      return getNotificationSettings(db, {
        userId: session.user.convexId,
        teamId: teamId!,
        ...input,
      });
    }),

  // Get all notification types with their current settings for the user
  getAll: protectedProcedure.query(async ({ ctx: { db, session, teamId } }) => {
    if (!session.user.convexId) {
      throw new Error("Missing Convex user id");
    }

    return getUserNotificationPreferences(db, session.user.convexId, teamId!);
  }),

  // Update a single notification setting
  update: protectedProcedure
    .input(updateNotificationSettingSchema)
    .mutation(async ({ ctx: { db, session, teamId }, input }) => {
      if (!session.user.convexId) {
        throw new Error("Missing Convex user id");
      }

      return upsertNotificationSetting(db, {
        userId: session.user.convexId,
        teamId: teamId!,
        ...input,
      });
    }),

  // Bulk update multiple notification settings
  bulkUpdate: protectedProcedure
    .input(bulkUpdateNotificationSettingsSchema)
    .mutation(async ({ ctx: { db, session, teamId }, input }) => {
      if (!session.user.convexId) {
        throw new Error("Missing Convex user id");
      }

      return bulkUpdateNotificationSettings(
        db,
        session.user.convexId,
        teamId!,
        input.updates,
      );
    }),
});
