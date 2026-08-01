import { getInvoiceById, updateInvoice } from "@tamias/app-data/queries";
import { TRPCError } from "@trpc/server";
import {
  createScheduledInvoiceJob,
  enqueueInvoiceGeneration,
  enqueueInvoiceScheduledNotification,
  removeInvoiceJob,
} from "../../invoice/transport";
import {
  cancelScheduledInvoiceSchema,
  createInvoiceSchema,
  updateScheduledInvoiceSchema,
} from "../../schemas/invoice";
import { protectedProcedure } from "../init";
import {
  assertScheduledAtInFuture,
  invoiceLogger,
  requireUserId,
  runIdempotentInvoiceMutation,
} from "./invoice-shared";

export const invoiceDeliveryProcedures = {
  create: protectedProcedure
    .input(createInvoiceSchema)
    .mutation(async ({ input, ctx: { db, teamId, session } }) => {
      const { idempotencyKey, ...request } = input;
      return runIdempotentInvoiceMutation({
        db,
        teamId: teamId!,
        userId: requireUserId(session),
        action: "deliver",
        resourceId: input.id,
        idempotencyKey,
        request,
        mutate: async ({ markMutationApplied }) => {
          if (input.deliveryType === "scheduled") {
            if (!input.scheduledAt) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "scheduledAt is required for scheduled delivery",
              });
            }

            const { delayMs } = assertScheduledAtInFuture(input.scheduledAt);
            const existingInvoice = await getInvoiceById(db, {
              id: input.id,
              teamId: teamId!,
            });

            let scheduledJobId: string | null = null;

            try {
              scheduledJobId = await createScheduledInvoiceJob(input.id, delayMs);
              markMutationApplied({ invoiceId: input.id, scheduledJobId });

              if (existingInvoice?.scheduledJobId) {
                await removeInvoiceJob(existingInvoice.scheduledJobId, {
                  logFailureMessage: "Failed to remove old scheduled job",
                  logger: invoiceLogger,
                });
              }
            } catch (error) {
              throw new TRPCError({
                code: "SERVICE_UNAVAILABLE",
                cause: error,
              });
            }

            if (!scheduledJobId) {
              throw new TRPCError({
                code: "SERVICE_UNAVAILABLE",
              });
            }

            const data = await updateInvoice(db, {
              id: input.id,
              status: "scheduled",
              scheduledAt: input.scheduledAt,
              scheduledJobId,
              teamId: teamId!,
            });

            if (!data) {
              try {
                await removeInvoiceJob(scheduledJobId);
              } catch (error) {
                invoiceLogger.error("Failed to clean up orphaned scheduled job", {
                  error: error instanceof Error ? error.message : String(error),
                });
              }

              throw new TRPCError({
                code: "NOT_FOUND",
                message: "Invoice not found",
              });
            }

            enqueueInvoiceScheduledNotification({
              teamId: teamId!,
              invoiceId: input.id,
              invoiceNumber: data.invoiceNumber!,
              scheduledAt: input.scheduledAt,
              customerName: data.customerName ?? undefined,
            });

            return data;
          }

          const data = await updateInvoice(db, {
            id: input.id,
            status: "unpaid",
            teamId: teamId!,
            userId: session.user.id ?? undefined,
          });

          if (!data) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Invoice not found",
            });
          }
          markMutationApplied({ invoiceId: data.id });

          await enqueueInvoiceGeneration({
            invoiceId: data.id,
            deliveryType: input.deliveryType,
          });

          return data;
        },
      });
    }),

  updateSchedule: protectedProcedure
    .input(updateScheduledInvoiceSchema)
    .mutation(async ({ input, ctx: { db, teamId, session } }) => {
      return runIdempotentInvoiceMutation({
        db,
        teamId: teamId!,
        userId: requireUserId(session),
        action: "schedule.update",
        resourceId: input.id,
        idempotencyKey: input.idempotencyKey,
        request: { id: input.id, scheduledAt: input.scheduledAt },
        mutate: async ({ markMutationApplied }) => {
          const invoice = await getInvoiceById(db, {
            id: input.id,
            teamId: teamId!,
          });

          if (!invoice || !invoice.scheduledJobId) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Scheduled invoice not found",
            });
          }

          const { delayMs } = assertScheduledAtInFuture(input.scheduledAt);
          let scheduledJobId: string;
          try {
            scheduledJobId = await createScheduledInvoiceJob(input.id, delayMs);
            markMutationApplied({ invoiceId: input.id, scheduledJobId });
          } catch {
            throw new TRPCError({
              code: "SERVICE_UNAVAILABLE",
              message: "Failed to create scheduled job",
            });
          }

          const updatedInvoice = await updateInvoice(db, {
            id: input.id,
            scheduledAt: input.scheduledAt,
            scheduledJobId,
            teamId: teamId!,
          });

          if (!updatedInvoice) {
            await removeInvoiceJob(scheduledJobId, {
              logFailureMessage: "Failed to clean up orphaned scheduled job",
              logger: invoiceLogger,
            });

            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Invoice not found or update failed",
            });
          }

          await removeInvoiceJob(invoice.scheduledJobId, {
            logFailureMessage: "Failed to remove old scheduled job",
            logger: invoiceLogger,
          });

          return updatedInvoice;
        },
      });
    }),

  cancelSchedule: protectedProcedure
    .input(cancelScheduledInvoiceSchema)
    .mutation(async ({ input, ctx: { db, teamId, session } }) => {
      return runIdempotentInvoiceMutation({
        db,
        teamId: teamId!,
        userId: requireUserId(session),
        action: "schedule.cancel",
        resourceId: input.id,
        idempotencyKey: input.idempotencyKey,
        request: { id: input.id },
        mutate: async ({ markMutationApplied }) => {
          const invoice = await getInvoiceById(db, {
            id: input.id,
            teamId: teamId!,
          });

          if (!invoice) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Scheduled invoice not found",
            });
          }

          if (invoice.scheduledJobId) {
            await removeInvoiceJob(invoice.scheduledJobId);
            markMutationApplied({ invoiceId: input.id, removedJobId: invoice.scheduledJobId });
          }

          return updateInvoice(db, {
            id: input.id,
            status: "draft",
            scheduledAt: null,
            scheduledJobId: null,
            teamId: teamId!,
          });
        },
      });
    }),
};
