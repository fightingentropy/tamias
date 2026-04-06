import { ConvexError, v } from "convex/values";
import { nowIso } from "../../packages/domain/src/identity";
import { mutation, query } from "./_generated/server";
import { getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";

function serializeAdjustment(
  publicTeamId: string,
  record: {
    _id: string;
    publicCorporationTaxAdjustmentId?: string;
    filingProfileId: string;
    periodKey: string;
    category?: string;
    label: string;
    amount: number;
    note?: string;
    createdBy?: string;
    createdAt: string;
    updatedAt: string;
  },
) {
  return {
    id: record.publicCorporationTaxAdjustmentId ?? record._id,
    teamId: publicTeamId,
    filingProfileId: record.filingProfileId,
    periodKey: record.periodKey,
    category: record.category ?? "other",
    label: record.label,
    amount: record.amount,
    note: record.note ?? null,
    createdBy: record.createdBy ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export const serviceListCorporationTaxAdjustmentsForPeriod = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    filingProfileId: v.string(),
    periodKey: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    return ctx.db
      .query("corporationTaxAdjustments")
      .withIndex("by_team_and_filing_profile_period_key", (q) =>
        q
          .eq("teamId", team._id)
          .eq("filingProfileId", args.filingProfileId)
          .eq("periodKey", args.periodKey),
      )
      .collect()
      .then((records) =>
        records
          .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
          .map((record) => serializeAdjustment(args.publicTeamId, record)),
      );
  },
});

export const serviceUpsertCorporationTaxAdjustment = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    corporationTaxAdjustmentId: v.optional(v.string()),
    filingProfileId: v.string(),
    periodKey: v.string(),
    category: v.optional(v.string()),
    label: v.string(),
    amount: v.number(),
    note: v.optional(v.union(v.string(), v.null())),
    createdBy: v.optional(v.union(v.string(), v.null())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      throw new ConvexError("Convex corporation tax adjustment team not found");
    }

    const timestamp = nowIso();

    if (args.corporationTaxAdjustmentId) {
      const existing = await ctx.db
        .query("corporationTaxAdjustments")
        .withIndex("by_public_corporation_tax_adjustment_id", (q) =>
          q.eq("publicCorporationTaxAdjustmentId", args.corporationTaxAdjustmentId),
        )
        .unique();

      if (existing && existing.teamId === team._id) {
        await ctx.db.patch(existing._id, {
          filingProfileId: args.filingProfileId,
          periodKey: args.periodKey,
          category: args.category ?? undefined,
          label: args.label,
          amount: args.amount,
          note: args.note ?? undefined,
          createdBy: args.createdBy ?? undefined,
          updatedAt: timestamp,
        });

        const updated = await ctx.db.get(existing._id);

        if (!updated) {
          throw new ConvexError("Failed to update corporation tax adjustment");
        }

        return serializeAdjustment(args.publicTeamId, updated);
      }
    }

    const insertedId = await ctx.db.insert("corporationTaxAdjustments", {
      publicCorporationTaxAdjustmentId: args.corporationTaxAdjustmentId ?? crypto.randomUUID(),
      teamId: team._id,
      filingProfileId: args.filingProfileId,
      periodKey: args.periodKey,
      category: args.category ?? undefined,
      label: args.label,
      amount: args.amount,
      note: args.note ?? undefined,
      createdBy: args.createdBy ?? undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const inserted = await ctx.db.get(insertedId);

    if (!inserted) {
      throw new ConvexError("Failed to create corporation tax adjustment");
    }

    return serializeAdjustment(args.publicTeamId, inserted);
  },
});

export const serviceDeleteCorporationTaxAdjustment = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    corporationTaxAdjustmentId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return { deleted: false };
    }

    const existing = await ctx.db
      .query("corporationTaxAdjustments")
      .withIndex("by_public_corporation_tax_adjustment_id", (q) =>
        q.eq("publicCorporationTaxAdjustmentId", args.corporationTaxAdjustmentId),
      )
      .unique();

    if (!existing || existing.teamId !== team._id) {
      return { deleted: false };
    }

    await ctx.db.delete(existing._id);

    return { deleted: true };
  },
});
