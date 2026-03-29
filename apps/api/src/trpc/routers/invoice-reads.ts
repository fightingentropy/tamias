import {
  getInvoiceByIdSchema,
  getInvoiceByTokenSchema,
  getInvoicesSchema,
  invoiceSummarySchema,
  searchInvoiceNumberSchema,
} from "../../schemas/invoice";
import { protectedProcedure, publicProcedure } from "../init";
import {
  getInvoiceByToken,
  getInvoiceIdFromToken,
} from "@tamias/app-services/invoice-by-token";
import {
  getInvoicePaymentStatusForTeam,
  getInvoicesPage,
  getInvoiceSummaryForTeam,
} from "@tamias/app-services/invoices";
import {
  getInvoiceById,
  markInvoiceViewed,
  searchInvoiceNumber,
} from "@tamias/app-data/queries";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const invoiceReadProcedures = {
  get: protectedProcedure
    .input(getInvoicesSchema.optional())
    .query(async ({ input, ctx: { db, teamId } }) => {
      return getInvoicesPage({
        db,
        teamId: teamId!,
        input,
      });
    }),

  getById: protectedProcedure
    .input(getInvoiceByIdSchema)
    .query(async ({ input, ctx: { db, teamId } }) => {
      return getInvoiceById(db, {
        id: input.id,
        teamId: teamId!,
      });
    }),

  getInvoiceByToken: publicProcedure
    .input(getInvoiceByTokenSchema)
    .query(async ({ input }) => {
      const invoice = await getInvoiceByToken(input.token);

      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return invoice;
    }),

  markViewedByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input, ctx: { db } }) => {
      const id = await getInvoiceIdFromToken(input.token);

      if (!id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return markInvoiceViewed(db, { id });
    }),

  paymentStatus: protectedProcedure.query(async ({ ctx: { db, teamId } }) =>
    getInvoicePaymentStatusForTeam({
      db,
      teamId: teamId!,
    }),
  ),

  searchInvoiceNumber: protectedProcedure
    .input(searchInvoiceNumberSchema)
    .query(async ({ input, ctx: { db, teamId } }) => {
      return searchInvoiceNumber(db, {
        teamId: teamId!,
        query: input.query,
      });
    }),

  invoiceSummary: protectedProcedure
    .input(invoiceSummarySchema.optional())
    .query(async ({ ctx: { db, teamId }, input }) => {
      return getInvoiceSummaryForTeam({
        db,
        teamId: teamId!,
        statuses: input?.statuses,
      });
    }),
};
