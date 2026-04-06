import type { CurrentUserIdentityRecord } from "@tamias/app-data-convex";
import {
  deleteTrackerEntry,
  getCurrentTimer,
  getTimerStatus,
  getTrackerRecordsByDate,
  getTrackerRecordsByRange,
  startTimer,
  stopTimer,
  upsertTrackerEntries,
} from "@tamias/app-data/queries";
import {
  deleteTrackerEntrySchema,
  getCurrentTimerSchema,
  getTrackerRecordsByDateSchema,
  getTrackerRecordsByRangeSchema,
  startTimerSchema,
  stopTimerSchema,
  upsertTrackerEntriesSchema,
} from "../../schemas/tracker-entries";
import { createTRPCRouter, protectedProcedure } from "../init";

type ConvexUserId = CurrentUserIdentityRecord["convexId"];

export const trackerEntriesRouter = createTRPCRouter({
  byDate: protectedProcedure
    .input(getTrackerRecordsByDateSchema)
    .query(async ({ ctx: { db, teamId }, input }) => {
      return getTrackerRecordsByDate(db, {
        date: input.date,
        teamId: teamId!,
      });
    }),

  byRange: protectedProcedure
    .input(getTrackerRecordsByRangeSchema)
    .query(async ({ input, ctx: { db, session, teamId } }) => {
      const userId = session.user.id as ConvexUserId;

      return getTrackerRecordsByRange(db, {
        teamId: teamId!,
        userId,
        ...input,
      });
    }),

  upsert: protectedProcedure
    .input(upsertTrackerEntriesSchema)
    .mutation(async ({ ctx: { db, teamId, session }, input }) => {
      const { assignedId, ...rest } = input;

      return upsertTrackerEntries(db, {
        ...rest,
        activityUserId: session.user.convexId ?? undefined,
        ...(assignedId !== undefined && {
          assignedId: assignedId as ConvexUserId,
        }),
        teamId: teamId!,
      });
    }),

  delete: protectedProcedure
    .input(deleteTrackerEntrySchema)
    .mutation(async ({ ctx: { db, teamId }, input }) => {
      return deleteTrackerEntry(db, {
        teamId: teamId!,
        id: input.id,
      });
    }),

  // Timer procedures
  startTimer: protectedProcedure
    .input(startTimerSchema)
    .mutation(async ({ ctx: { db, teamId, session }, input }) => {
      const assignedId = (input.assignedId ?? session.user.id) as ConvexUserId;
      const { assignedId: _assignedId, ...rest } = input;

      return startTimer(db, {
        teamId: teamId!,
        assignedId,
        ...rest,
      });
    }),

  stopTimer: protectedProcedure
    .input(stopTimerSchema)
    .mutation(async ({ ctx: { db, teamId, session }, input }) => {
      const assignedId = (input.assignedId ?? session.user.id) as ConvexUserId;
      const { assignedId: _assignedId, ...rest } = input;

      return stopTimer(db, {
        teamId: teamId!,
        assignedId,
        ...rest,
      });
    }),

  getCurrentTimer: protectedProcedure
    .input(getCurrentTimerSchema.optional())
    .query(async ({ ctx: { db, teamId, session }, input }) => {
      const assignedId = (input?.assignedId ?? session.user.id) as ConvexUserId;

      return getCurrentTimer(db, {
        teamId: teamId!,
        assignedId,
      });
    }),

  getTimerStatus: protectedProcedure
    .input(getCurrentTimerSchema.optional())
    .query(async ({ ctx: { db, teamId, session }, input }) => {
      const assignedId = (input?.assignedId ?? session.user.id) as ConvexUserId;

      return getTimerStatus(db, {
        teamId: teamId!,
        assignedId,
      });
    }),
});
