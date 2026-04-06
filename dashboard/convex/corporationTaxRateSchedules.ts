import { ConvexError, v } from "convex/values";
import { nowIso } from "../../packages/domain/src/identity";
import { mutation, query } from "./_generated/server";
import { getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";

function serializeSchedule(
  publicTeamId: string,
  record: {
    _id: string;
    publicCorporationTaxRateScheduleId?: string;
    filingProfileId: string;
    periodKey: string;
    exemptDistributions?: number;
    associatedCompaniesThisPeriod?: number;
    associatedCompaniesFirstYear?: number;
    associatedCompaniesSecondYear?: number;
    createdBy?: string;
    createdAt: string;
    updatedAt: string;
  },
) {
  return {
    id:
      record.publicCorporationTaxRateScheduleId ??
      record._id,
    teamId: publicTeamId,
    filingProfileId: record.filingProfileId,
    periodKey: record.periodKey,
    exemptDistributions: record.exemptDistributions ?? null,
    associatedCompaniesThisPeriod:
      record.associatedCompaniesThisPeriod ?? null,
    associatedCompaniesFirstYear:
      record.associatedCompaniesFirstYear ?? null,
    associatedCompaniesSecondYear:
      record.associatedCompaniesSecondYear ?? null,
    createdBy: record.createdBy ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export const serviceGetCorporationTaxRateScheduleByPeriod = query({
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
      return null;
    }

    const record = await ctx.db
      .query("corporationTaxRateSchedules")
      .withIndex("by_team_and_filing_profile_period_key", (q) =>
        q
          .eq("teamId", team._id)
          .eq("filingProfileId", args.filingProfileId)
          .eq("periodKey", args.periodKey),
      )
      .unique();

    return record ? serializeSchedule(args.publicTeamId, record) : null;
  },
});

export const serviceUpsertCorporationTaxRateSchedule = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    filingProfileId: v.string(),
    periodKey: v.string(),
    exemptDistributions: v.optional(v.union(v.number(), v.null())),
    associatedCompaniesThisPeriod: v.optional(v.union(v.number(), v.null())),
    associatedCompaniesFirstYear: v.optional(v.union(v.number(), v.null())),
    associatedCompaniesSecondYear: v.optional(v.union(v.number(), v.null())),
    createdBy: v.optional(v.union(v.string(), v.null())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      throw new ConvexError(
        "Convex corporation tax rate schedule team not found",
      );
    }

    const timestamp = nowIso();
    const existing = await ctx.db
      .query("corporationTaxRateSchedules")
      .withIndex("by_team_and_filing_profile_period_key", (q) =>
        q
          .eq("teamId", team._id)
          .eq("filingProfileId", args.filingProfileId)
          .eq("periodKey", args.periodKey),
      )
      .unique();

    const payload = {
      filingProfileId: args.filingProfileId,
      periodKey: args.periodKey,
      exemptDistributions: args.exemptDistributions ?? undefined,
      associatedCompaniesThisPeriod:
        args.associatedCompaniesThisPeriod ?? undefined,
      associatedCompaniesFirstYear:
        args.associatedCompaniesFirstYear ?? undefined,
      associatedCompaniesSecondYear:
        args.associatedCompaniesSecondYear ?? undefined,
      createdBy: args.createdBy ?? undefined,
      updatedAt: timestamp,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);

      const updated = await ctx.db.get(existing._id);

      if (!updated) {
        throw new ConvexError(
          "Failed to update corporation tax rate schedule",
        );
      }

      return serializeSchedule(args.publicTeamId, updated);
    }

    const insertedId = await ctx.db.insert("corporationTaxRateSchedules", {
      publicCorporationTaxRateScheduleId: crypto.randomUUID(),
      teamId: team._id,
      createdAt: timestamp,
      ...payload,
    });

    const inserted = await ctx.db.get(insertedId);

    if (!inserted) {
      throw new ConvexError(
        "Failed to create corporation tax rate schedule",
      );
    }

    return serializeSchedule(args.publicTeamId, inserted);
  },
});

export const serviceDeleteCorporationTaxRateSchedule = mutation({
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
      return { deleted: false };
    }

    const existing = await ctx.db
      .query("corporationTaxRateSchedules")
      .withIndex("by_team_and_filing_profile_period_key", (q) =>
        q
          .eq("teamId", team._id)
          .eq("filingProfileId", args.filingProfileId)
          .eq("periodKey", args.periodKey),
      )
      .unique();

    if (!existing) {
      return { deleted: false };
    }

    await ctx.db.delete(existing._id);
    return { deleted: true };
  },
});
