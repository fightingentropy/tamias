import {
  checkDocumentAttachments,
  deleteDocument,
  getDocumentById,
  getRelatedDocuments,
  updateDocumentProcessingStatus,
  updateDocuments,
} from "@tamias/app-data/queries";
import { getDocuments } from "@tamias/app-data/queries/documents";
import { isMimeTypeSupportedForProcessing } from "@tamias/documents/utils";
import { enqueue } from "@tamias/job-client";
import { TRPCError } from "@trpc/server";
import {
  deleteDocumentSchema,
  getDocumentSchema,
  getDocumentsSchema,
  getRelatedDocumentsSchema,
  processDocumentSchema,
  reprocessDocumentSchema,
  signedUrlSchema,
  signedUrlsSchema,
} from "../../schemas/documents";
import { getVaultSignedUrl, removeVaultFile } from "../../services/storage";
import { createTRPCRouter, protectedProcedure } from "../init";

export const documentsRouter = createTRPCRouter({
  get: protectedProcedure
    .input(getDocumentsSchema)
    .query(async ({ input, ctx: { db, teamId } }) => {
      return getDocuments(db, {
        teamId: teamId!,
        ...input,
      });
    }),

  getById: protectedProcedure
    .input(getDocumentSchema)
    .query(async ({ input, ctx: { db, teamId } }) => {
      const result = await getDocumentById(db, {
        id: input.id,
        filePath: input.filePath,
        teamId: teamId!,
      });

      return result ?? null;
    }),

  getRelatedDocuments: protectedProcedure
    .input(getRelatedDocumentsSchema)
    .query(async ({ input, ctx: { db, teamId } }) => {
      return getRelatedDocuments(db, {
        id: input.id,
        pageSize: input.pageSize,
        teamId: teamId!,
      });
    }),

  checkAttachments: protectedProcedure
    .input(deleteDocumentSchema)
    .query(async ({ input, ctx: { db, teamId } }) => {
      return checkDocumentAttachments(db, {
        id: input.id,
        teamId: teamId!,
      });
    }),

  delete: protectedProcedure
    .input(deleteDocumentSchema)
    .mutation(async ({ input, ctx: { db, teamId } }) => {
      const document = await deleteDocument(db, {
        id: input.id,
        teamId: teamId!,
      });

      if (!document?.pathTokens) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      // Delete from storage
      await removeVaultFile(document.pathTokens);

      return document;
    }),

  processDocument: protectedProcedure
    .input(processDocumentSchema)
    .mutation(async ({ ctx: { teamId, db }, input }) => {
      const supportedDocuments = input.filter((item) =>
        isMimeTypeSupportedForProcessing(item.mimetype),
      );

      const unsupportedDocuments = input.filter(
        (item) => !isMimeTypeSupportedForProcessing(item.mimetype),
      );

      if (unsupportedDocuments.length > 0) {
        const unsupportedNames = unsupportedDocuments.map((doc) => doc.filePath.join("/"));

        await updateDocuments(db, {
          ids: unsupportedNames,
          teamId: teamId!,
          processingStatus: "completed",
        });
      }

      if (supportedDocuments.length === 0) {
        return;
      }

      // Enqueue document processing for each supported document.
      // Keep a stable requested job ID so related runs are easy to trace.
      const jobResults = await Promise.all(
        supportedDocuments.map((item) =>
          enqueue(
            "process-document",
            {
              filePath: item.filePath,
              mimetype: item.mimetype,
              teamId: teamId!,
            },
            "documents",
            {
              jobId: `process-doc_${teamId}_${item.filePath.join("/")}`,
              publicTeamId: teamId!,
            },
          ),
        ),
      );

      return {
        runs: jobResults.map((result) => ({ runId: result.runId })),
      };
    }),

  reprocessDocument: protectedProcedure
    .input(reprocessDocumentSchema)
    .mutation(async ({ ctx: { teamId, db }, input }) => {
      // Get the document to reprocess
      const document = await getDocumentById(db, {
        id: input.id,
        teamId: teamId!,
      });

      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      // Get mimetype from metadata
      const mimetype =
        (document.metadata as { mimetype?: string })?.mimetype ?? "application/octet-stream";

      // Validate pathTokens exists - required for job processing
      if (!document.pathTokens || document.pathTokens.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Document has no file path and cannot be reprocessed",
        });
      }

      // Check if it's a supported file type
      if (!isMimeTypeSupportedForProcessing(mimetype)) {
        // Mark unsupported files as completed
        await updateDocumentProcessingStatus(db, {
          id: input.id,
          processingStatus: "completed",
        });
        return {
          success: true,
          skipped: true,
          document: { id: input.id, processingStatus: "completed" as const },
        };
      }

      // Reset status to pending
      await updateDocumentProcessingStatus(db, {
        id: input.id,
        processingStatus: "pending",
      });

      // Trigger reprocessing with a timestamped requested job ID so manual retries
      // stay distinct in async-run metadata and logs.
      const jobResult = await enqueue(
        "process-document",
        {
          filePath: document.pathTokens,
          mimetype,
          teamId: teamId!,
        },
        "documents",
        {
          jobId: `reprocess-doc_${teamId}_${document.pathTokens.join("/")}_${Date.now()}`,
          publicTeamId: teamId!,
        },
      );

      return {
        success: true,
        runId: jobResult.runId,
        document: { id: input.id, processingStatus: "pending" as const },
      };
    }),

  signedUrl: protectedProcedure.input(signedUrlSchema).mutation(async ({ input }) => {
    const { data } = await getVaultSignedUrl({
      path: input.filePath,
      expireIn: input.expireIn,
    });

    return data;
  }),

  signedUrls: protectedProcedure.input(signedUrlsSchema).mutation(async ({ input }) => {
    const results = await Promise.all(
      input.map((filePath) =>
        getVaultSignedUrl({
          path: filePath,
          expireIn: 60,
        }),
      ),
    );

    return results.map((r) => r.data?.signedUrl).filter((url): url is string => !!url);
  }),
});
