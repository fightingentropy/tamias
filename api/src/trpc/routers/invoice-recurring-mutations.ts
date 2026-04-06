import {
  createInvoiceRecurring,
  deleteInvoiceRecurring,
  getInvoiceById,
  getInvoiceRecurringById,
  pauseInvoiceRecurring,
  resumeInvoiceRecurring,
  updateInvoice,
  updateInvoiceRecurring,
} from "@tamias/app-data/queries";
import {
  calculateNextScheduledDate,
  isDateInFutureUTC,
} from "@tamias/invoice/server-recurring";
import { Notifications } from "@tamias/notifications";
import { TRPCError } from "@trpc/server";
import {
  createInvoiceRecurringSchema,
  deleteInvoiceRecurringSchema,
  pauseResumeInvoiceRecurringSchema,
  updateInvoiceRecurringSchema,
} from "../../schemas/invoice-recurring";
import { protectedProcedure } from "../init";
import {
  assertRecurringCustomerCanReceiveInvoices,
  clearScheduledRecurringInvoices,
  invoiceRecurringLogger,
  requireInvoiceRecurringContext,
  requireInvoiceRecurringTeamId,
  validateInvoiceRecurringUpdateInput,
} from "./invoice-recurring-shared";

export const invoiceRecurringMutationProcedures = {
  create: protectedProcedure
    .input(createInvoiceRecurringSchema)
    .mutation(async ({ input, ctx: { db, teamId, session } }) => {
      const context = requireInvoiceRecurringContext({
        teamId,
        userId: session?.user?.id,
      });
      const { invoiceId, ...recurringData } = input;
      let existingInvoice: {
        id: string;
        invoiceRecurringId: string | null;
        issueDate: string | null;
      } | null = null;

      if (invoiceId) {
        const foundInvoice = await getInvoiceById(db, {
          id: invoiceId,
          teamId: context.teamId,
        });
        existingInvoice = foundInvoice
          ? {
              id: foundInvoice.id,
              invoiceRecurringId: foundInvoice.invoiceRecurringId,
              issueDate: foundInvoice.issueDate,
            }
          : null;

        if (existingInvoice?.invoiceRecurringId) {
          const existingSeries = await getInvoiceRecurringById(db, {
            id: existingInvoice.invoiceRecurringId,
            teamId: context.teamId,
          });

          if (existingSeries) {
            return existingSeries;
          }
        }
      }

      await assertRecurringCustomerCanReceiveInvoices(
        db,
        context.teamId,
        recurringData.customerId,
      );

      const issueDate = existingInvoice?.issueDate ?? null;
      const recurring = await createInvoiceRecurring(db, {
        teamId: context.teamId,
        userId: context.userId,
        ...recurringData,
        issueDate,
      });

      if (!recurring?.id) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create recurring invoice series",
        });
      }

      let result = recurring;

      if (invoiceId) {
        if (!existingInvoice) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Invoice not found or does not belong to this team",
          });
        }

        const now = new Date();
        const issueDateParsed = issueDate ? new Date(issueDate) : now;
        const isIssueDateFuture = isDateInFutureUTC(issueDateParsed, now);

        await updateInvoice(db, {
          id: invoiceId,
          teamId: context.teamId,
          invoiceRecurringId: recurring.id,
          recurringSequence: 1,
        });

        if (!isIssueDateFuture) {
          const nextScheduledAt = calculateNextScheduledDate(
            {
              frequency: recurringData.frequency,
              frequencyDay: recurringData.frequencyDay ?? null,
              frequencyWeek: recurringData.frequencyWeek ?? null,
              frequencyInterval: recurringData.frequencyInterval ?? null,
              timezone: recurringData.timezone,
            },
            issueDateParsed,
          );

          result =
            (await updateInvoiceRecurring(db, {
              id: recurring.id,
              teamId: context.teamId,
              invoicesGenerated: 1,
              nextScheduledAt: nextScheduledAt.toISOString(),
              lastGeneratedAt: new Date().toISOString(),
            })) ?? recurring;
        }
      }

      if (result?.id) {
        const notifications = new Notifications(db);
        notifications
          .create("recurring_series_started", context.teamId, {
            recurringId: result.id,
            invoiceId,
            customerName: recurringData.customerName ?? undefined,
            frequency: recurringData.frequency,
            endType: recurringData.endType,
            endDate: recurringData.endDate ?? undefined,
            endCount: recurringData.endCount ?? undefined,
          })
          .catch((error) => {
            invoiceRecurringLogger.error(
              "Failed to send recurring_series_started notification",
              {
                error: error instanceof Error ? error.message : String(error),
              },
            );
          });
      }

      return result;
    }),

  update: protectedProcedure
    .input(updateInvoiceRecurringSchema)
    .mutation(async ({ input, ctx: { db, teamId } }) => {
      const resolvedTeamId = requireInvoiceRecurringTeamId(teamId);

      await validateInvoiceRecurringUpdateInput(db, resolvedTeamId, input);

      const result = await updateInvoiceRecurring(db, {
        ...input,
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

  delete: protectedProcedure
    .input(deleteInvoiceRecurringSchema)
    .mutation(async ({ input, ctx: { db, teamId } }) => {
      const resolvedTeamId = requireInvoiceRecurringTeamId(teamId);
      const recurring = await deleteInvoiceRecurring(db, {
        id: input.id,
        teamId: resolvedTeamId,
      });

      if (!recurring) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Recurring invoice series not found",
        });
      }

      await clearScheduledRecurringInvoices(db, resolvedTeamId, input.id);

      return { id: recurring.id };
    }),

  pause: protectedProcedure
    .input(pauseResumeInvoiceRecurringSchema)
    .mutation(async ({ input, ctx: { db, teamId } }) => {
      const resolvedTeamId = requireInvoiceRecurringTeamId(teamId);
      const recurring = await pauseInvoiceRecurring(db, {
        id: input.id,
        teamId: resolvedTeamId,
      });

      if (!recurring) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Recurring invoice series not found",
        });
      }

      await clearScheduledRecurringInvoices(db, resolvedTeamId, input.id);

      return recurring;
    }),

  resume: protectedProcedure
    .input(pauseResumeInvoiceRecurringSchema)
    .mutation(async ({ input, ctx: { db, teamId } }) => {
      const resolvedTeamId = requireInvoiceRecurringTeamId(teamId);
      const result = await resumeInvoiceRecurring(db, {
        id: input.id,
        teamId: resolvedTeamId,
      });

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Recurring invoice series not found or not paused",
        });
      }

      return result;
    }),
};
