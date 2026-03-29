import {
  createTagSchema,
  deleteTagSchema,
  updateTagSchema,
} from "../../schemas/tags";
import { createTRPCRouter, protectedProcedure } from "../init";
import { getTagsForTeam } from "@tamias/app-services/tags";
import { createTag, deleteTag, updateTag } from "@tamias/app-data/queries";

export const tagsRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx: { db, teamId } }) => {
    return getTagsForTeam({
      db,
      teamId: teamId!,
    });
  }),

  create: protectedProcedure
    .input(createTagSchema)
    .mutation(async ({ ctx: { db, teamId }, input }) => {
      return createTag(db, {
        teamId: teamId!,
        name: input.name,
      });
    }),

  delete: protectedProcedure
    .input(deleteTagSchema)
    .mutation(async ({ ctx: { db, teamId }, input }) => {
      return deleteTag(db, {
        id: input.id,
        teamId: teamId!,
      });
    }),

  update: protectedProcedure
    .input(updateTagSchema)
    .mutation(async ({ ctx: { db, teamId }, input }) => {
      return updateTag(db, {
        id: input.id,
        name: input.name,
        teamId: teamId!,
      });
    }),
});
