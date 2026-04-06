import {
  bulkUpdateNotificationSettings,
  getNotificationSettings,
  getUserNotificationPreferences,
  upsertNotificationSetting,
} from "@tamias/app-data/queries";
import {
  bulkUpdateNotificationSettingsSchema,
  getNotificationSettingsSchema,
  updateNotificationSettingSchema,
} from "../../schemas/notification-settings";
import { createTRPCRouter, protectedWithConvexIdProcedure } from "../init";

export const notificationSettingsRouter = createTRPCRouter({
  get: protectedWithConvexIdProcedure
    .input(getNotificationSettingsSchema.optional())
    .query(async ({ ctx: { db, session, teamId }, input = {} }) => {
      return getNotificationSettings(db, {
        userId: session.user.convexId,
        teamId: teamId!,
        ...input,
      });
    }),

  // Get all notification types with their current settings for the user
  getAll: protectedWithConvexIdProcedure.query(async ({ ctx: { db, session, teamId } }) => {
    return getUserNotificationPreferences(db, session.user.convexId, teamId!);
  }),

  // Update a single notification setting
  update: protectedWithConvexIdProcedure
    .input(updateNotificationSettingSchema)
    .mutation(async ({ ctx: { db, session, teamId }, input }) => {
      return upsertNotificationSetting(db, {
        userId: session.user.convexId,
        teamId: teamId!,
        ...input,
      });
    }),

  // Bulk update multiple notification settings
  bulkUpdate: protectedWithConvexIdProcedure
    .input(bulkUpdateNotificationSettingsSchema)
    .mutation(async ({ ctx: { db, session, teamId }, input }) => {
      return bulkUpdateNotificationSettings(db, session.user.convexId, teamId!, input.updates);
    }),
});
