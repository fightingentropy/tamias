import {
  getBillableHoursSchema,
  getInboxStatsSchema,
  getTrackedTimeSchema,
  getVaultActivitySchema,
} from "../../schemas/widgets";
import { protectedProcedure } from "../init";
import {
  getBillableHours,
  getInboxStats,
  getRecentDocuments,
  getTrackedTime,
} from "@tamias/app-data/queries";
import { getWidgetAssignedUserId } from "./widgets-shared";

export const widgetOperationProcedures = {
  getInboxStats: protectedProcedure
    .input(getInboxStatsSchema)
    .query(async ({ ctx: { db, teamId }, input }) => {
      const inboxStats = await getInboxStats(db, {
        teamId: teamId!,
        from: input.from,
        to: input.to,
        currency: input.currency,
      });

      return {
        result: inboxStats.result,
      };
    }),

  getTrackedTime: protectedProcedure
    .input(getTrackedTimeSchema)
    .query(async ({ ctx: { db, teamId, session }, input }) => {
      const assignedId = (input.assignedId ??
        getWidgetAssignedUserId(session)) as typeof session.user.id;

      const trackedTime = await getTrackedTime(db, {
        teamId: teamId!,
        assignedId,
        from: input.from,
        to: input.to,
      });

      return {
        result: trackedTime,
      };
    }),

  getVaultActivity: protectedProcedure
    .input(getVaultActivitySchema)
    .query(async ({ ctx: { db, teamId }, input }) => {
      const vaultActivity = await getRecentDocuments(db, {
        teamId: teamId!,
        limit: input.limit,
      });

      return {
        result: vaultActivity,
      };
    }),

  getBillableHours: protectedProcedure
    .input(getBillableHoursSchema)
    .query(async ({ ctx: { db, teamId }, input }) => {
      return getBillableHours(db, {
        teamId: teamId!,
        date: input.date,
        view: input.view,
        weekStartsOnMonday: input.weekStartsOnMonday,
      });
    }),
};
