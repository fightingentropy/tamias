import {
  deleteInvoiceSchema,
  draftInvoiceSchema,
  duplicateInvoiceSchema,
  remindInvoiceSchema,
  updateInvoiceSchema,
} from "../../schemas/invoice";
import { parseInputValue } from "../../utils/parse";
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
import { protectedProcedure } from "../init";
import { requireConvexUserId } from "./invoice-shared";

export const invoiceMutationProcedures = {
  update: protectedProcedure
    .input(updateInvoiceSchema)
    .mutation(async ({ input, ctx: { db, teamId, session } }) => {
      return updateInvoice(db, {
        ...input,
        teamId: teamId!,
        userId: session.user.convexId ?? undefined,
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
      const convexUserId = requireConvexUserId(session);
      const invoiceNumber =
        input.invoiceNumber || (await allocateNextInvoiceNumber(db, teamId!));

      try {
        return draftInvoice(db, {
          ...input,
          invoiceNumber,
          teamId: teamId!,
          userId: convexUserId,
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
      const convexUserId = requireConvexUserId(session);
      const nextInvoiceNumber = await allocateNextInvoiceNumber(db, teamId!);

      return duplicateInvoice(db, {
        id: input.id,
        userId: convexUserId,
        invoiceNumber: nextInvoiceNumber!,
        teamId: teamId!,
      });
    }),
};
