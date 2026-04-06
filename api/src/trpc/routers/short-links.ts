import { createShortLink, getDocumentById } from "@tamias/app-data/queries";
import { getPublicShortLink } from "@tamias/app-services/public-reads";
import { getAppUrl } from "@tamias/utils/envs";
import { TRPCError } from "@trpc/server";
import {
  createShortLinkForDocumentSchema,
  createShortLinkSchema,
  getShortLinkSchema,
} from "../../schemas/short-links";
import { getVaultSignedUrl } from "../../services/storage";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../init";

export const shortLinksRouter = createTRPCRouter({
  createForUrl: protectedProcedure
    .input(createShortLinkSchema)
    .mutation(async ({ ctx: { db, teamId, session }, input }) => {
      if (!session.user.convexId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Missing Convex user id",
        });
      }

      const result = await createShortLink(db, {
        url: input.url,
        teamId: teamId!,
        userId: session.user.convexId,
        type: "redirect",
      });

      if (!result) {
        throw new Error("Failed to create short link");
      }

      return {
        ...result,
        shortUrl: `${getAppUrl()}/s/${result.shortId}`,
      };
    }),

  createForDocument: protectedProcedure
    .input(createShortLinkForDocumentSchema)
    .mutation(async ({ ctx: { db, teamId, session }, input }) => {
      if (!session.user.convexId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Missing Convex user id",
        });
      }

      const document = await getDocumentById(db, {
        id: input.documentId,
        filePath: input.filePath,
        teamId: teamId!,
      });

      if (!document) {
        throw new Error("Document not found");
      }

      // First create the signed URL for the file
      const response = await getVaultSignedUrl({
        path: document.pathTokens?.join("/") ?? "",
        expireIn: input.expireIn,
        options: {
          download: true,
        },
      });

      if (!response.data?.signedUrl) {
        throw new Error("Failed to create signed URL for file");
      }

      // Then create a short link for the signed URL
      const result = await createShortLink(db, {
        url: response.data.signedUrl,
        teamId: teamId!,
        userId: session.user.convexId,
        type: "download",
        fileName: document.name ?? undefined,
        // @ts-expect-error
        mimeType: document.metadata?.contentType ?? undefined,
        // @ts-expect-error
        size: document.metadata?.size ?? undefined,
        expiresAt: input.expireIn
          ? new Date(Date.now() + input.expireIn * 1000).toISOString()
          : undefined,
      });

      if (!result) {
        throw new Error("Failed to create short link");
      }

      return {
        ...result,
        shortUrl: `${getAppUrl()}/s/${result.shortId}`,
        originalUrl: response.data.signedUrl,
      };
    }),

  get: publicProcedure
    .input(getShortLinkSchema)
    .query(async ({ ctx: { db }, input }) =>
      getPublicShortLink({ db, shortId: input.shortId }),
    ),
});
