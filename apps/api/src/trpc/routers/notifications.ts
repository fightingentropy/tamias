import {
  getNotificationsSchema,
  updateAllNotificationsStatusSchema,
  updateNotificationStatusSchema,
} from "../../schemas/notifications";
import { createTRPCRouter, protectedProcedure } from "../init";
import {
  getActivities,
  updateActivityStatus,
  updateAllActivitiesStatus,
} from "@tamias/app-data/queries";

export const notificationsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(getNotificationsSchema.optional())
    .query(async ({ ctx: { teamId, db, session }, input }) => {
      if (!session.user.convexId) {
        throw new Error("Missing Convex user id");
      }

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

  updateAllStatus: protectedProcedure
    .input(updateAllNotificationsStatusSchema)
    .mutation(async ({ ctx: { db, teamId, session }, input }) => {
      if (!session.user.convexId) {
        throw new Error("Missing Convex user id");
      }

      return updateAllActivitiesStatus(db, teamId!, input.status, {
        userId: session.user.convexId,
      });
    }),
});
