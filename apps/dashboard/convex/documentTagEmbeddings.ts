import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { nowIso } from "../../../packages/domain/src/identity";
import { requireServiceKey } from "./lib/service";

type EmbeddingPayload = {
  slug: string;
  name?: string;
  embedding: number[];
  model?: string;
};

const DEFAULT_MODEL = "gemini-embedding-001";

export const serviceGetDocumentTagEmbeddings = query({
  args: {
    serviceKey: v.string(),
    slugs: v.array(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    if (args.slugs.length === 0) {
      return [];
    }

    const records = await Promise.all(
      args.slugs.map((slug) =>
        ctx.db
          .query("documentTagEmbeddings")
          .withIndex("by_slug", (q) => q.eq("slug", slug))
          .unique(),
      ),
    );

    const results: {
      slug: string;
      name: string;
      embedding: number[];
      model: string;
      createdAt: string;
      updatedAt: string;
    }[] = [];

    for (const record of records) {
      if (!record) {
        continue;
      }

      const existingRecord = record;

      results.push({
        slug: existingRecord.slug,
        name: existingRecord.name,
        embedding: existingRecord.embedding,
        model: existingRecord.model,
        createdAt: existingRecord.createdAt,
        updatedAt: existingRecord.updatedAt,
      });
    }

    return results;
  },
});

export const serviceUpsertDocumentTagEmbeddings = mutation({
  args: {
    serviceKey: v.string(),
    embeddings: v.array(
      v.object({
        slug: v.string(),
        name: v.optional(v.string()),
        embedding: v.array(v.number()),
        model: v.optional(v.string()),
      }),
    ),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    if (args.embeddings.length === 0) {
      return [];
    }

    const timestamp = nowIso();
    const results = [] as {
      slug: string;
      name: string;
      embedding: number[];
      model: string;
      createdAt: string;
      updatedAt: string;
    }[];

    for (const entry of args.embeddings) {
      const model = entry.model ?? DEFAULT_MODEL;
      const name = entry.name ?? entry.slug;
      const record = await ctx.db
        .query("documentTagEmbeddings")
        .withIndex("by_slug", (q) => q.eq("slug", entry.slug))
        .unique();

      if (record) {
        const existingRecord = record;

        await ctx.db.patch(existingRecord._id, {
          name,
          embedding: entry.embedding,
          model,
          updatedAt: timestamp,
        });

        results.push({
          slug: existingRecord.slug,
          name,
          embedding: entry.embedding,
          model,
          createdAt: existingRecord.createdAt,
          updatedAt: timestamp,
        });
        continue;
      }

      const insertedId = await ctx.db.insert("documentTagEmbeddings", {
        slug: entry.slug,
        name,
        embedding: entry.embedding,
        model,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      const inserted = await ctx.db.get(insertedId);
      if (!inserted) {
        throw new Error("Failed to persist document tag embedding");
      }

      results.push({
        slug: inserted.slug,
        name: inserted.name,
        embedding: inserted.embedding,
        model: inserted.model,
        createdAt: inserted.createdAt,
        updatedAt: inserted.updatedAt,
      });
    }

    return results;
  },
});
