import { markInvoiceViewed } from "@tamias/app-data/queries";
import {
  getInvoiceByToken,
  getInvoiceIdFromToken,
} from "@tamias/app-services/invoice-by-token";
import {
  getInvoiceByIdForTeam,
  getInvoicePaymentStatusForTeam,
  getInvoiceSummaryForTeam,
  getInvoicesPage,
  searchInvoiceNumberForTeam,
} from "@tamias/app-services/invoices";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  getInvoiceByIdSchema,
  getInvoiceByTokenSchema,
  getInvoicesSchema,
  invoiceSummarySchema,
  searchInvoiceNumberSchema,
} from "../../schemas/invoice";
import { protectedProcedure, publicProcedure } from "../init";

export const invoiceReadProcedures = {
  get: protectedProcedure
    .input(getInvoicesSchema.optional())
    .query(async ({ input, ctx: { db, teamId } }) => {
      return getInvoicesPage({ db, teamId: teamId!, input });
    }),

  getById: protectedProcedure
    .input(getInvoiceByIdSchema)
    .query(async ({ input, ctx: { db, teamId } }) => {
      return getInvoiceByIdForTeam({
        db,
        teamId: teamId!,
        input: { id: input.id },
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
    getInvoicePaymentStatusForTeam({ db, teamId: teamId! }),
  ),

  searchInvoiceNumber: protectedProcedure
    .input(searchInvoiceNumberSchema)
    .query(async ({ input, ctx: { db, teamId } }) => {
      return searchInvoiceNumberForTeam({
        db,
        teamId: teamId!,
        input: { query: input.query },
      });
    }),

  invoiceSummary: protectedProcedure
    .input(invoiceSummarySchema.optional())
    .query(async ({ ctx: { db, teamId }, input }) => {
      return getInvoiceSummaryForTeam({
        db,
        teamId: teamId!,
        input: { statuses: input?.statuses },
      });
    }),
};
