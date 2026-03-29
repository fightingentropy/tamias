import {
  createInvoiceProductSchema,
  deleteInvoiceProductSchema,
  getInvoiceProductSchema,
  getInvoiceProductsSchema,
  saveLineItemAsProductSchema,
  updateInvoiceProductSchema,
  upsertInvoiceProductSchema,
} from "../../schemas/invoice";
import { createTRPCRouter, protectedProcedure } from "../init";
import { getInvoiceProductsForTeam } from "@tamias/app-services/invoice-products";
import {
  createInvoiceProduct,
  deleteInvoiceProduct,
  getInvoiceProductById,
  incrementProductUsage,
  saveLineItemAsProduct,
  updateInvoiceProduct,
  upsertInvoiceProduct,
} from "@tamias/app-data/queries";
import { TRPCError } from "@trpc/server";

export const invoiceProductsRouter = createTRPCRouter({
  get: protectedProcedure
    .input(getInvoiceProductsSchema)
    .query(async ({ input, ctx: { teamId } }) => {
      const {
        sortBy = "popular",
        limit = 50,
        includeInactive = false,
        currency,
      } = input || {};

      return getInvoiceProductsForTeam({
        teamId: teamId!,
        input: {
          sortBy,
          limit,
          includeInactive,
          currency,
        },
      });
    }),

  getById: protectedProcedure
    .input(getInvoiceProductSchema)
    .query(async ({ input, ctx: { teamId } }) => {
      return getInvoiceProductById(input.id, teamId!);
    }),

  create: protectedProcedure
    .input(createInvoiceProductSchema)
    .mutation(async ({ input, ctx: { teamId, session } }) => {
      if (!session.user.convexId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Missing Convex user id",
        });
      }

      try {
        return await createInvoiceProduct({
          ...input,
          teamId: teamId!,
          createdBy: session.user.convexId,
        });
      } catch (_error) {
        throw new TRPCError({
          code: "CONFLICT",
        });
      }
    }),

  upsert: protectedProcedure
    .input(upsertInvoiceProductSchema)
    .mutation(async ({ input, ctx: { teamId, session } }) => {
      if (!session.user.convexId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Missing Convex user id",
        });
      }

      return upsertInvoiceProduct({
        ...input,
        teamId: teamId!,
        createdBy: session.user.convexId,
      });
    }),

  updateProduct: protectedProcedure
    .input(updateInvoiceProductSchema)
    .mutation(async ({ input, ctx: { teamId } }) => {
      try {
        return await updateInvoiceProduct({
          ...input,
          teamId: teamId!,
        });
      } catch (_error: any) {
        throw new TRPCError({
          code: "CONFLICT",
        });
      }
    }),

  delete: protectedProcedure
    .input(deleteInvoiceProductSchema)
    .mutation(async ({ input, ctx: { teamId } }) => {
      return deleteInvoiceProduct(input.id, teamId!);
    }),

  incrementUsage: protectedProcedure
    .input(getInvoiceProductSchema)
    .mutation(async ({ input, ctx: { teamId } }) => {
      await incrementProductUsage(input.id, teamId!);
      return { success: true };
    }),

  saveLineItemAsProduct: protectedProcedure
    .input(saveLineItemAsProductSchema)
    .mutation(async ({ input, ctx: { teamId, session } }) => {
      if (!session.user.convexId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Missing Convex user id",
        });
      }

      // Convert input to LineItem format
      const lineItem = {
        name: input.name,
        price: input.price || undefined,
        unit: input.unit || undefined,
        productId: input.productId,
      };

      const result = await saveLineItemAsProduct(
        teamId!,
        session.user.convexId,
        lineItem,
        input.currency || undefined,
      );

      return {
        product: result.product,
        shouldClearProductId: result.shouldClearProductId,
      };
    }),
});
