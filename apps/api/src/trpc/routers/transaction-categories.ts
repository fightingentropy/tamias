import {
  createTransactionCategorySchema,
  deleteTransactionCategorySchema,
  getCategoriesSchema,
  getCategoryByIdSchema,
  updateTransactionCategorySchema,
} from "../../schemas/transaction-categories";
import { createTRPCRouter, protectedProcedure } from "../init";
import {
  createTransactionCategory,
  deleteTransactionCategory,
  getCategoryById,
  updateTransactionCategory,
} from "@tamias/app-data/queries";
import { getTransactionCategoriesForTeam } from "@tamias/app-services/transactions";

export const transactionCategoriesRouter = createTRPCRouter({
  get: protectedProcedure
    .input(getCategoriesSchema)
    .query(async ({ ctx: { db, teamId }, input }) => {
      const data = await getTransactionCategoriesForTeam({
        db,
        teamId: teamId!,
        input,
      });

      return data;
    }),

  getById: protectedProcedure
    .input(getCategoryByIdSchema)
    .query(async ({ input, ctx: { db, teamId } }) => {
      return getCategoryById(db, { id: input.id, teamId: teamId! });
    }),

  create: protectedProcedure
    .input(createTransactionCategorySchema)
    .mutation(async ({ input, ctx: { db, teamId, session } }) => {
      return createTransactionCategory(db, {
        teamId: teamId!,
        userId: session.user.convexId ?? undefined,
        ...input,
      });
    }),

  update: protectedProcedure
    .input(updateTransactionCategorySchema)
    .mutation(async ({ input, ctx: { db, teamId } }) => {
      return updateTransactionCategory(db, {
        ...input,
        teamId: teamId!,
      });
    }),

  delete: protectedProcedure
    .input(deleteTransactionCategorySchema)
    .mutation(async ({ input, ctx: { db, teamId } }) => {
      return deleteTransactionCategory(db, {
        id: input.id,
        teamId: teamId!,
      });
    }),
});
