import {
  createTransactionTag,
  deleteTransactionTag,
} from "@tamias/app-data/queries";
import {
  createTransactionTagSchema,
  deleteTransactionTagSchema,
} from "../../schemas/transaction-tags";
import { createTRPCRouter, protectedProcedure } from "../init";

export const transactionTagsRouter = createTRPCRouter({
  create: protectedProcedure
    .input(createTransactionTagSchema)
    .mutation(async ({ ctx: { db, teamId }, input }) => {
      return createTransactionTag(db, {
        teamId: teamId!,
        transactionId: input.transactionId,
        tagId: input.tagId,
      });
    }),

  delete: protectedProcedure
    .input(deleteTransactionTagSchema)
    .mutation(async ({ ctx: { db, teamId }, input }) => {
      return deleteTransactionTag(db, {
        transactionId: input.transactionId,
        tagId: input.tagId,
        teamId: teamId!,
      });
    }),
});
