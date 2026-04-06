import { createAttachments, deleteAttachment } from "@tamias/app-data/queries";
import { allowedMimeTypes } from "@tamias/documents/utils";
import { enqueue } from "@tamias/job-client";
import {
  createAttachmentsSchema,
  deleteAttachmentSchema,
  processTransactionAttachmentSchema,
} from "../../schemas/transaction-attachments";
import { createTRPCRouter, protectedProcedure } from "../init";

export const transactionAttachmentsRouter = createTRPCRouter({
  createMany: protectedProcedure
    .input(createAttachmentsSchema)
    .mutation(async ({ input, ctx: { db, teamId, session } }) => {
      return createAttachments(db, {
        teamId: teamId!,
        userId: session.user.convexId ?? undefined,
        attachments: input,
      });
    }),

  delete: protectedProcedure
    .input(deleteAttachmentSchema)
    .mutation(async ({ input, ctx: { db, teamId } }) => {
      return deleteAttachment(db, {
        id: input.id,
        teamId: teamId!,
      });
    }),

  processAttachment: protectedProcedure
    .input(processTransactionAttachmentSchema)
    .mutation(async ({ input, ctx: { teamId, session } }) => {
      const allowedAttachments = input.filter((item) =>
        allowedMimeTypes.includes(item.mimetype),
      );

      if (allowedAttachments.length === 0) {
        return;
      }

      // Queue async processing for each supported attachment.
      const jobResults = await Promise.all(
        allowedAttachments.map((item) =>
          enqueue(
            "process-transaction-attachment",
            {
              filePath: item.filePath,
              mimetype: item.mimetype,
              teamId: teamId!,
              transactionId: item.transactionId,
            },
            "transactions",
            {
              publicTeamId: teamId!,
              appUserId: session.user.convexId ?? undefined,
            },
          ),
        ),
      );

      return {
        runs: jobResults.map((result) => ({ runId: result.runId })),
      };
    }),
});
