import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { nowIso } from "../../packages/domain/src/identity";
import { requireServiceKey } from "./lib/service";

const DEFAULT_MODEL = "gemini-embedding-001";

export const serviceGetTransactionCategoryEmbeddingsByNames = query({
  args: {
    serviceKey: v.string(),
    names: v.array(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    if (args.names.length === 0) {
      return [];
    }

    const records = await Promise.all(
      args.names.map((name) =>
        ctx.db
          .query("transactionCategoryEmbeddings")
          .withIndex("by_name", (q) => q.eq("name", name))
          .unique(),
      ),
    );

    const results: {
      name: string;
      embedding: number[];
      model: string;
      system: boolean;
      createdAt: string;
      updatedAt: string;
    }[] = [];

    for (const record of records) {
      if (!record) {
        continue;
      }

      results.push({
        name: record.name,
        embedding: record.embedding,
        model: record.model,
        system: record.system,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      });
    }

    return results;
  },
});

export const serviceUpsertTransactionCategoryEmbeddings = mutation({
  args: {
    serviceKey: v.string(),
    embeddings: v.array(
      v.object({
        name: v.string(),
        embedding: v.array(v.number()),
        system: v.optional(v.boolean()),
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
    const results: {
      name: string;
      embedding: number[];
      model: string;
      system: boolean;
      createdAt: string;
      updatedAt: string;
    }[] = [];

    for (const entry of args.embeddings) {
      const model = entry.model ?? DEFAULT_MODEL;
      const system = entry.system ?? false;
      const record = await ctx.db
        .query("transactionCategoryEmbeddings")
        .withIndex("by_name", (q) => q.eq("name", entry.name))
        .unique();

      if (record) {
        await ctx.db.patch(record._id, {
          embedding: entry.embedding,
          model,
          system,
          updatedAt: timestamp,
        });

        results.push({
          name: record.name,
          embedding: entry.embedding,
          model,
          system,
          createdAt: record.createdAt,
          updatedAt: timestamp,
        });
        continue;
      }

      const insertedId = await ctx.db.insert("transactionCategoryEmbeddings", {
        name: entry.name,
        embedding: entry.embedding,
        model,
        system,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      const inserted = await ctx.db.get(insertedId);
      if (!inserted) {
        throw new Error("Failed to persist transaction category embedding");
      }

      results.push({
        name: inserted.name,
        embedding: inserted.embedding,
        model: inserted.model,
        system: inserted.system,
        createdAt: inserted.createdAt,
        updatedAt: inserted.updatedAt,
      });
    }

    return results;
  },
});
