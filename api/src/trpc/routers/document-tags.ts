import slugify from "@sindresorhus/slugify";
import {
  createDocumentTag,
  createDocumentTagEmbedding,
  deleteDocumentTag,
  getDocumentTags,
} from "@tamias/app-data/queries";
import { Embed } from "@tamias/documents/embed";
import { createDocumentTagSchema, deleteDocumentTagSchema } from "../../schemas/document-tags";
import { createTRPCRouter, protectedProcedure } from "../init";

export const documentTagsRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx: { db, teamId } }) => {
    return getDocumentTags(db, teamId!);
  }),

  create: protectedProcedure
    .input(createDocumentTagSchema)
    .mutation(async ({ ctx: { db, teamId }, input }) => {
      const data = await createDocumentTag(db, {
        teamId: teamId!,
        name: input.name,
        slug: slugify(input.name),
      });

      // If a tag is created, we need to embed it
      if (data) {
        const embedService = new Embed();
        const { embedding, model } = await embedService.embed(input.name);

        await createDocumentTagEmbedding(db, {
          slug: data.slug,
          name: input.name,
          embedding: JSON.stringify(embedding),
          model,
        });
      }

      return data;
    }),

  delete: protectedProcedure
    .input(deleteDocumentTagSchema)
    .mutation(async ({ ctx: { db, teamId }, input }) => {
      return deleteDocumentTag(db, {
        id: input.id,
        teamId: teamId!,
      });
    }),
});
