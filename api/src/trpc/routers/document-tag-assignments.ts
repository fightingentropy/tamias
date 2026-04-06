import { createDocumentTagAssignment, deleteDocumentTagAssignment } from "@tamias/app-data/queries";
import {
  createDocumentTagAssignmentSchema,
  deleteDocumentTagAssignmentSchema,
} from "../../schemas/document-tag-assignments";
import { createTRPCRouter, protectedProcedure } from "../init";

export const documentTagAssignmentsRouter = createTRPCRouter({
  create: protectedProcedure
    .input(createDocumentTagAssignmentSchema)
    .mutation(async ({ ctx: { db, teamId }, input }) => {
      return createDocumentTagAssignment(db, {
        documentId: input.documentId,
        tagId: input.tagId,
        teamId: teamId!,
      });
    }),

  delete: protectedProcedure
    .input(deleteDocumentTagAssignmentSchema)
    .mutation(async ({ ctx: { db, teamId }, input }) => {
      return deleteDocumentTagAssignment(db, {
        documentId: input.documentId,
        tagId: input.tagId,
        teamId: teamId!,
      });
    }),
});
