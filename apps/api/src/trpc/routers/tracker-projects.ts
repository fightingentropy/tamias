import {
  deleteTrackerProjectSchema,
  getTrackerProjectByIdSchema,
  getTrackerProjectsSchema,
  upsertTrackerProjectSchema,
} from "../../schemas/tracker-projects";
import { createTRPCRouter, protectedProcedure } from "../init";
import { getTrackerProjectsPage } from "@tamias/app-services/tracker";
import {
  deleteTrackerProject,
  getTrackerProjectById,
  upsertTrackerProject,
} from "@tamias/app-data/queries";

export const trackerProjectsRouter = createTRPCRouter({
  get: protectedProcedure
    .input(getTrackerProjectsSchema.optional())
    .query(async ({ input, ctx: { db, teamId } }) => {
      return getTrackerProjectsPage({
        db,
        teamId: teamId!,
        input,
      });
    }),

  upsert: protectedProcedure
    .input(upsertTrackerProjectSchema)
    .mutation(async ({ input, ctx: { db, teamId, session } }) => {
      return upsertTrackerProject(db, {
        ...input,
        teamId: teamId!,
        userId: session.user.convexId ?? undefined,
      });
    }),

  delete: protectedProcedure
    .input(deleteTrackerProjectSchema)
    .mutation(async ({ input, ctx: { db, teamId } }) => {
      return deleteTrackerProject(db, {
        ...input,
        teamId: teamId!,
      });
    }),

  getById: protectedProcedure
    .input(getTrackerProjectByIdSchema)
    .query(async ({ input, ctx: { db, teamId } }) => {
      return getTrackerProjectById(db, {
        ...input,
        teamId: teamId!,
      });
    }),
});
