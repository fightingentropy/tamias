import {
  getActivities,
  updateActivityStatus,
  updateAllActivitiesStatus,
} from "@tamias/app-data/queries";
import {
  getNotificationsSchema,
  updateAllNotificationsStatusSchema,
  updateNotificationStatusSchema,
} from "../../schemas/notifications";
import { createTRPCRouter, protectedProcedure, protectedWithConvexIdProcedure } from "../init";

export const notificationsRouter = createTRPCRouter({
  list: protectedWithConvexIdProcedure
    .input(getNotificationsSchema.optional())
    .query(async ({ ctx: { teamId, db, session }, input }) => {
      return getActivities(db, {
        ...input,
        teamId: teamId!,
        userId: session.user.convexId,
      });
    }),

  updateStatus: protectedProcedure
    .input(updateNotificationStatusSchema)
    .mutation(async ({ ctx: { db, teamId }, input }) => {
      return updateActivityStatus(db, input.activityId, input.status, teamId!);
    }),

  updateAllStatus: protectedWithConvexIdProcedure
    .input(updateAllNotificationsStatusSchema)
    .mutation(async ({ ctx: { db, teamId, session }, input }) => {
      return updateAllActivitiesStatus(db, teamId!, input.status, {
        userId: session.user.convexId,
      });
    }),
});
