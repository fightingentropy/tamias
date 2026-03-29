import { ConvexError, v } from "convex/values";
import { nowIso } from "../../../packages/domain/src/identity";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";

const sourceTypeValidator = v.union(
  v.literal("transaction"),
  v.literal("invoice"),
  v.literal("invoice_refund"),
  v.literal("manual_adjustment"),
  v.literal("payroll_import"),
);

const lineValidator = v.object({
  accountCode: v.string(),
  description: v.optional(v.union(v.string(), v.null())),
  debit: v.number(),
  credit: v.number(),
  taxRate: v.optional(v.union(v.number(), v.null())),
  taxAmount: v.optional(v.union(v.number(), v.null())),
  taxType: v.optional(v.union(v.string(), v.null())),
  vatBox: v.optional(v.union(v.string(), v.null())),
  meta: v.optional(v.any()),
});

async function getTeamOrThrow(ctx: MutationCtx, publicTeamId: string) {
  const team = await getTeamByPublicTeamId(ctx, publicTeamId);

  if (!team) {
    throw new ConvexError("Convex compliance ledger team not found");
  }

  return team;
}

export const serviceDeleteComplianceJournalEntries = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    sourceTypes: v.optional(v.array(sourceTypeValidator)),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamOrThrow(ctx, args.publicTeamId);
    const sourceTypes = args.sourceTypes ?? [
      "transaction",
      "invoice",
      "invoice_refund",
      "manual_adjustment",
      "payroll_import",
    ];
    const existingEntries = await ctx.db
      .query("complianceJournalEntries")
      .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
      .collect()
      .then((records) =>
        records.filter((entry) => sourceTypes.includes(entry.sourceType)),
      );
    const existingSourceLinks = await Promise.all(
      sourceTypes.map((sourceType) =>
        ctx.db
          .query("sourceLinks")
          .withIndex("by_team_and_source_type", (q) =>
            q.eq("teamId", team._id).eq("sourceType", sourceType),
          )
          .collect(),
      ),
    );

    await Promise.all([
      ...existingEntries.map((entry) => ctx.db.delete(entry._id)),
      ...existingSourceLinks.flat().map((record) => ctx.db.delete(record._id)),
    ]);

    return {
      deletedEntryIds: existingEntries.map(
        (entry) => entry.publicJournalEntryId ?? entry._id,
      ),
      deletedSourceLinkIds: existingSourceLinks
        .flat()
        .map((record) => record.publicSourceLinkId ?? record._id),
    };
  },
});

export const serviceListComplianceJournalEntries = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    sourceTypes: v.optional(v.array(sourceTypeValidator)),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    const allowedSourceTypes = args.sourceTypes
      ? new Set(args.sourceTypes)
      : null;

    return ctx.db
      .query("complianceJournalEntries")
      .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
      .collect()
      .then((records) =>
        records
          .filter((record) =>
            allowedSourceTypes
              ? allowedSourceTypes.has(record.sourceType)
              : true,
          )
          .sort((left, right) => {
            const dateComparison = left.entryDate.localeCompare(
              right.entryDate,
            );

            if (dateComparison !== 0) {
              return dateComparison;
            }

            return left.createdAt.localeCompare(right.createdAt);
          })
          .map((record) => ({
            journalEntryId: record.publicJournalEntryId ?? record._id,
            entryDate: record.entryDate,
            reference: record.reference ?? null,
            description: record.description ?? null,
            sourceType: record.sourceType,
            sourceId: record.sourceId,
            currency: record.currency,
            meta: record.meta ?? null,
            lines: record.lines.map((line) => ({
              accountCode: line.accountCode,
              description: line.description ?? null,
              debit: line.debit,
              credit: line.credit,
              taxRate: line.taxRate ?? null,
              taxAmount: line.taxAmount ?? null,
              taxType: line.taxType ?? null,
              vatBox: line.vatBox ?? null,
              meta: line.meta ?? null,
            })),
          })),
      );
  },
});

export const serviceInsertComplianceJournalEntries = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    entries: v.array(
      v.object({
        journalEntryId: v.string(),
        entryDate: v.string(),
        reference: v.optional(v.union(v.string(), v.null())),
        description: v.optional(v.union(v.string(), v.null())),
        sourceType: sourceTypeValidator,
        sourceId: v.string(),
        currency: v.string(),
        meta: v.optional(v.any()),
        lines: v.array(lineValidator),
      }),
    ),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamOrThrow(ctx, args.publicTeamId);
    const timestamp = nowIso();
    const insertedEntryIds: string[] = [];

    for (const entry of args.entries) {
      await ctx.db.insert("complianceJournalEntries", {
        publicJournalEntryId: entry.journalEntryId,
        teamId: team._id,
        entryDate: entry.entryDate,
        reference: entry.reference ?? undefined,
        description: entry.description ?? undefined,
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        currency: entry.currency,
        meta: entry.meta,
        lines: entry.lines.map((line) => ({
          accountCode: line.accountCode,
          description: line.description ?? undefined,
          debit: line.debit,
          credit: line.credit,
          taxRate: line.taxRate ?? undefined,
          taxAmount: line.taxAmount ?? undefined,
          taxType: line.taxType ?? undefined,
          vatBox: line.vatBox ?? undefined,
          meta: line.meta,
        })),
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      insertedEntryIds.push(entry.journalEntryId);

      const existingSourceLink = await ctx.db
        .query("sourceLinks")
        .withIndex("by_team_source_type_source_id", (q) =>
          q
            .eq("teamId", team._id)
            .eq("sourceType", entry.sourceType)
            .eq("sourceId", entry.sourceId),
        )
        .unique();

      if (existingSourceLink) {
        await ctx.db.patch(existingSourceLink._id, {
          journalEntryId: entry.journalEntryId,
          meta: entry.meta,
          updatedAt: timestamp,
        });

        continue;
      }

      await ctx.db.insert("sourceLinks", {
        publicSourceLinkId: crypto.randomUUID(),
        teamId: team._id,
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        journalEntryId: entry.journalEntryId,
        meta: entry.meta,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    return {
      insertedEntryIds,
      count: insertedEntryIds.length,
    };
  },
});

export const serviceUpsertComplianceJournalEntry = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    entry: v.object({
      journalEntryId: v.optional(v.string()),
      entryDate: v.string(),
      reference: v.optional(v.union(v.string(), v.null())),
      description: v.optional(v.union(v.string(), v.null())),
      sourceType: sourceTypeValidator,
      sourceId: v.string(),
      currency: v.string(),
      meta: v.optional(v.any()),
      lines: v.array(lineValidator),
    }),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamOrThrow(ctx, args.publicTeamId);
    const existingSourceLink = await ctx.db
      .query("sourceLinks")
      .withIndex("by_team_source_type_source_id", (q) =>
        q
          .eq("teamId", team._id)
          .eq("sourceType", args.entry.sourceType)
          .eq("sourceId", args.entry.sourceId),
      )
      .unique();
    const journalEntryId =
      args.entry.journalEntryId ??
      existingSourceLink?.journalEntryId ??
      crypto.randomUUID();
    const timestamp = nowIso();

    if (existingSourceLink) {
      const existingEntry = await ctx.db
        .query("complianceJournalEntries")
        .withIndex("by_public_journal_entry_id", (q) =>
          q.eq("publicJournalEntryId", existingSourceLink.journalEntryId),
        )
        .unique();

      if (existingEntry) {
        await ctx.db.delete(existingEntry._id);
      }
    }

    await ctx.db.insert("complianceJournalEntries", {
      publicJournalEntryId: journalEntryId,
      teamId: team._id,
      entryDate: args.entry.entryDate,
      reference: args.entry.reference ?? undefined,
      description: args.entry.description ?? undefined,
      sourceType: args.entry.sourceType,
      sourceId: args.entry.sourceId,
      currency: args.entry.currency,
      meta: args.entry.meta,
      lines: args.entry.lines.map((line) => ({
        accountCode: line.accountCode,
        description: line.description ?? undefined,
        debit: line.debit,
        credit: line.credit,
        taxRate: line.taxRate ?? undefined,
        taxAmount: line.taxAmount ?? undefined,
        taxType: line.taxType ?? undefined,
        vatBox: line.vatBox ?? undefined,
        meta: line.meta,
      })),
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    if (existingSourceLink) {
      await ctx.db.patch(existingSourceLink._id, {
        journalEntryId,
        meta: args.entry.meta,
        updatedAt: timestamp,
      });

      return { journalEntryId, updated: true };
    }

    await ctx.db.insert("sourceLinks", {
      publicSourceLinkId: crypto.randomUUID(),
      teamId: team._id,
      sourceType: args.entry.sourceType,
      sourceId: args.entry.sourceId,
      journalEntryId,
      meta: args.entry.meta,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return { journalEntryId, updated: false };
  },
});

export const serviceDeleteComplianceJournalEntryBySource = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    sourceType: sourceTypeValidator,
    sourceId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return { deleted: false };
    }

    const sourceLink = await ctx.db
      .query("sourceLinks")
      .withIndex("by_team_source_type_source_id", (q) =>
        q
          .eq("teamId", team._id)
          .eq("sourceType", args.sourceType)
          .eq("sourceId", args.sourceId),
      )
      .unique();

    if (!sourceLink) {
      return { deleted: false };
    }

    const existingEntry = await ctx.db
      .query("complianceJournalEntries")
      .withIndex("by_public_journal_entry_id", (q) =>
        q.eq("publicJournalEntryId", sourceLink.journalEntryId),
      )
      .unique();

    if (existingEntry) {
      await ctx.db.delete(existingEntry._id);
    }

    await ctx.db.delete(sourceLink._id);

    return {
      deleted: true,
      journalEntryId: sourceLink.journalEntryId,
    };
  },
});
