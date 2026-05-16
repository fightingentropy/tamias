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
import { requireUserId } from "./invoice-shared";

export const invoiceMutationProcedures = {
  update: protectedProcedure
    .input(updateInvoiceSchema)
    .mutation(async ({ input, ctx: { db, teamId, session } }) => {
      return updateInvoice(db, {
        ...input,
        teamId: teamId!,
        userId: session.user.id ?? undefined,
      });
    }),

  delete: protectedProcedure
    .input(deleteInvoiceSchema)
    .mutation(async ({ input, ctx: { db, teamId } }) => {
      return deleteInvoice(db, {
        id: input.id,
        teamId: teamId!,
      });
    }),

  draft: protectedProcedure
    .input(draftInvoiceSchema)
    .mutation(async ({ input, ctx: { db, teamId, session } }) => {
      const userId = requireUserId(session);
      const invoiceNumber = input.invoiceNumber || (await allocateNextInvoiceNumber(db, teamId!));

      try {
        return draftInvoice(db, {
          ...input,
          invoiceNumber,
          teamId: teamId!,
          userId: userId,
          paymentDetails: parseInputValue(input.paymentDetails),
          fromDetails: parseInputValue(input.fromDetails),
          customerDetails: parseInputValue(input.customerDetails),
          noteDetails: parseInputValue(input.noteDetails),
        });
      } catch (error) {
        if (isInvoiceNumberConflictError(error)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: getInvoiceNumberConflictMessage(invoiceNumber),
          });
        }

        throw error;
      }
    }),

  remind: protectedProcedure
    .input(remindInvoiceSchema)
    .mutation(async ({ input, ctx: { db, teamId } }) => {
      await enqueue(
        "send-invoice-reminder",
        {
          invoiceId: input.id,
          teamId: teamId!,
        },
        "invoices",
        {
          publicTeamId: teamId!,
        },
      );

      return updateInvoice(db, {
        id: input.id,
        teamId: teamId!,
        reminderSentAt: input.date,
      });
    }),

  duplicate: protectedProcedure
    .input(duplicateInvoiceSchema)
    .mutation(async ({ input, ctx: { db, session, teamId } }) => {
      const userId = requireUserId(session);
      const nextInvoiceNumber = await allocateNextInvoiceNumber(db, teamId!);

      return duplicateInvoice(db, {
        id: input.id,
        userId: userId,
        invoiceNumber: nextInvoiceNumber!,
        teamId: teamId!,
      });
    }),
};
