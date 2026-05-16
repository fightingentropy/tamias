import { upsertDocuments } from "@tamias/app-data/queries/documents/records";
import { registerUploadedR2VaultFile } from "@tamias/storage";
import { z } from "zod";
import { registerUploadSchema } from "../../schemas/uploads";
import { createR2UploadUrl } from "../../services/r2-upload";
import { createTRPCRouter, protectedProcedure } from "../init";

export const uploadsRouter = createTRPCRouter({
  generateUrl: protectedProcedure
    .input(z.object({ bucket: z.string().optional() }).optional())
    .mutation(async ({ input }) => {
      if (input?.bucket && input.bucket !== "vault") {
        throw new Error(`Unsupported upload bucket: ${input.bucket}`);
      }

      return createR2UploadUrl();
    }),

  register: protectedProcedure.input(registerUploadSchema).mutation(async ({ ctx, input }) => {
    if (input.bucket !== "vault") {
      throw new Error(`Unsupported upload bucket: ${input.bucket}`);
    }

    const result = await registerUploadedR2VaultFile({
      pathTokens: input.pathTokens,
      storageId: input.storageId,
      contentType: input.contentType,
      size: input.size,
    });

    if (result.error || !result.data) {
      throw result.error ?? new Error("Failed to register R2 upload");
    }

    const teamId = ctx.teamId!;
    const metadata =
      input.contentType || input.size
        ? {
            mimetype: input.contentType ?? null,
            size: input.size ?? null,
          }
        : null;

    await upsertDocuments(ctx.db, {
      documents: [
        {
          teamId,
          name: input.pathTokens.join("/"),
          metadata,
          pathTokens: input.pathTokens,
          objectId: result.data.storageId,
          processingStatus: "pending",
        },
      ],
    });

    return result.data;
  }),
});
