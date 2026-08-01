import {
  allocateNextInvoiceNumber,
  deleteInvoice,
  draftInvoice,
  duplicateInvoice,
  getInvoiceNumberConflictMessage,
  isInvoiceNumberConflictError,
  updateInvoice,
} from "@tamias/app-data/queries";
import { enqueue } from "@tamias/job-client";
import { TRPCError } from "@trpc/server";
import {
  deleteInvoiceSchema,
  draftInvoiceSchema,
  duplicateInvoiceSchema,
  remindInvoiceSchema,
  updateInvoiceSchema,
} from "../../schemas/invoice";
import { parseInputValue } from "../../utils/parse";
import { protectedProcedure } from "../init";
import { requireUserId, runIdempotentInvoiceMutation } from "./invoice-shared";

export const invoiceMutationProcedures = {
  update: protectedProcedure
    .input(updateInvoiceSchema)
    .mutation(async ({ input, ctx: { db, teamId, session } }) => {
      const { idempotencyKey, ...mutation } = input;
      const userId = requireUserId(session);
      return runIdempotentInvoiceMutation({
        db,
        teamId: teamId!,
        userId,
        action: "update",
        resourceId: input.id,
        idempotencyKey,
        request: mutation,
        mutate: () =>
          updateInvoice(db, {
            ...mutation,
            teamId: teamId!,
            userId,
          }),
      });
    }),

  delete: protectedProcedure
    .input(deleteInvoiceSchema)
    .mutation(async ({ input, ctx: { db, teamId, session } }) => {
      return runIdempotentInvoiceMutation({
        db,
        teamId: teamId!,
        userId: requireUserId(session),
        action: "delete",
        resourceId: input.id,
        idempotencyKey: input.idempotencyKey,
        request: { id: input.id },
        mutate: () => deleteInvoice(db, { id: input.id, teamId: teamId! }),
      });
    }),

  draft: protectedProcedure
    .input(draftInvoiceSchema)
    .mutation(async ({ input, ctx: { db, teamId, session } }) => {
      const userId = requireUserId(session);
      const { idempotencyKey, ...draft } = input;

      try {
        return await runIdempotentInvoiceMutation({
          db,
          teamId: teamId!,
          userId,
          action: "draft",
          resourceId: input.id,
          idempotencyKey,
          request: draft,
          mutate: async () => {
            const invoiceNumber =
              draft.invoiceNumber || (await allocateNextInvoiceNumber(db, teamId!));
            return draftInvoice(db, {
              ...draft,
              invoiceNumber,
              teamId: teamId!,
              userId,
              paymentDetails: parseInputValue(draft.paymentDetails),
              fromDetails: parseInputValue(draft.fromDetails),
              customerDetails: parseInputValue(draft.customerDetails),
              noteDetails: parseInputValue(draft.noteDetails),
            });
          },
        });
      } catch (error) {
        if (isInvoiceNumberConflictError(error)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: getInvoiceNumberConflictMessage(draft.invoiceNumber ?? "auto-generated"),
          });
        }

        throw error;
      }
    }),

  remind: protectedProcedure
    .input(remindInvoiceSchema)
    .mutation(async ({ input, ctx: { db, teamId, session } }) => {
      return runIdempotentInvoiceMutation({
        db,
        teamId: teamId!,
        userId: requireUserId(session),
        action: "remind",
        resourceId: input.id,
        idempotencyKey: input.idempotencyKey,
        request: { id: input.id, date: input.date },
        mutate: async ({ markMutationApplied }) => {
          const result = await updateInvoice(db, {
            id: input.id,
            teamId: teamId!,
            reminderSentAt: input.date,
          });
          if (!result) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Invoice not found",
            });
          }
          markMutationApplied({ invoiceId: input.id });
          await enqueue(
            "send-invoice-reminder",
            { invoiceId: input.id, teamId: teamId! },
            "invoices",
            { publicTeamId: teamId! },
          );
          return result;
        },
      });
    }),

  duplicate: protectedProcedure
    .input(duplicateInvoiceSchema)
    .mutation(async ({ input, ctx: { db, session, teamId } }) => {
      const userId = requireUserId(session);
      return runIdempotentInvoiceMutation({
        db,
        teamId: teamId!,
        userId,
        action: "duplicate",
        resourceId: input.id,
        idempotencyKey: input.idempotencyKey,
        request: { id: input.id },
        mutate: async () => {
          const nextInvoiceNumber = await allocateNextInvoiceNumber(db, teamId!);
          return duplicateInvoice(db, {
            id: input.id,
            userId,
            invoiceNumber: nextInvoiceNumber!,
            teamId: teamId!,
          });
        },
      });
    }),
};
