import {
  getInvoiceRecurringById,
  getInvoiceRecurringList,
  getUpcomingInvoices,
} from "@tamias/app-data/queries";
import { TRPCError } from "@trpc/server";
import {
  getInvoiceRecurringByIdSchema,
  getInvoiceRecurringListSchema,
  getUpcomingInvoicesSchema,
} from "../../schemas/invoice-recurring";
import { protectedProcedure } from "../init";
import { requireInvoiceRecurringTeamId } from "./invoice-recurring-shared";

export const invoiceRecurringReadProcedures = {
  get: protectedProcedure
    .input(getInvoiceRecurringByIdSchema)
    .query(async ({ input, ctx: { db, teamId } }) => {
      const resolvedTeamId = requireInvoiceRecurringTeamId(teamId);
      const result = await getInvoiceRecurringById(db, {
        id: input.id,
        teamId: resolvedTeamId,
      });

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Recurring invoice series not found",
        });
      }

      return result;
    }),

  list: protectedProcedure
    .input(getInvoiceRecurringListSchema.optional())
    .query(async ({ input, ctx: { db, teamId } }) => {
      const resolvedTeamId = requireInvoiceRecurringTeamId(teamId);

      return getInvoiceRecurringList(db, {
        teamId: resolvedTeamId,
        cursor: input?.cursor ?? null,
        pageSize: input?.pageSize ?? 25,
        status: input?.status ?? undefined,
        customerId: input?.customerId ?? undefined,
      });
    }),

  getUpcoming: protectedProcedure
    .input(getUpcomingInvoicesSchema)
    .query(async ({ input, ctx: { db, teamId } }) => {
      const resolvedTeamId = requireInvoiceRecurringTeamId(teamId);
      const result = await getUpcomingInvoices(db, {
        id: input.id,
        teamId: resolvedTeamId,
        limit: input.limit,
      });

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Recurring invoice series not found",
        });
      }

      return result;
    }),
};
