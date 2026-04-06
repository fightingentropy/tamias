import { ConvexError, v } from "convex/values";
import { nowIso } from "../../packages/domain/src/identity";
import { mutation, query } from "./_generated/server";
import { getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";

function serializeSchedule(
  publicTeamId: string,
  record: {
    _id: string;
    publicCloseCompanyLoansScheduleId?: string;
    filingProfileId: string;
    periodKey: string;
    beforeEndPeriod: boolean;
    loansMade: Array<{
      name: string;
      amountOfLoan: number;
    }>;
    taxChargeable?: number;
    reliefEarlierThan: Array<{
      name: string;
      amountRepaid?: number;
      amountReleasedOrWrittenOff?: number;
      date: string;
    }>;
    reliefEarlierDue?: number;
    loanLaterReliefNow: Array<{
      name: string;
      amountRepaid?: number;
      amountReleasedOrWrittenOff?: number;
      date: string;
    }>;
    reliefLaterDue?: number;
    totalLoansOutstanding?: number;
    createdBy?: string;
    createdAt: string;
    updatedAt: string;
  },
) {
  return {
    id: record.publicCloseCompanyLoansScheduleId ?? record._id,
    teamId: publicTeamId,
    filingProfileId: record.filingProfileId,
    periodKey: record.periodKey,
    beforeEndPeriod: record.beforeEndPeriod,
    loansMade: record.loansMade,
    taxChargeable: record.taxChargeable ?? null,
    reliefEarlierThan: record.reliefEarlierThan.map((item) => ({
      name: item.name,
      amountRepaid: item.amountRepaid ?? null,
      amountReleasedOrWrittenOff: item.amountReleasedOrWrittenOff ?? null,
      date: item.date,
    })),
    reliefEarlierDue: record.reliefEarlierDue ?? null,
    loanLaterReliefNow: record.loanLaterReliefNow.map((item) => ({
      name: item.name,
      amountRepaid: item.amountRepaid ?? null,
      amountReleasedOrWrittenOff: item.amountReleasedOrWrittenOff ?? null,
      date: item.date,
    })),
    reliefLaterDue: record.reliefLaterDue ?? null,
    totalLoansOutstanding: record.totalLoansOutstanding ?? null,
    createdBy: record.createdBy ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export const serviceGetCloseCompanyLoansScheduleByPeriod = query({
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
      .query("closeCompanyLoansSchedules")
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

export const serviceUpsertCloseCompanyLoansSchedule = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    filingProfileId: v.string(),
    periodKey: v.string(),
    beforeEndPeriod: v.boolean(),
    loansMade: v.array(
      v.object({
        name: v.string(),
        amountOfLoan: v.number(),
      }),
    ),
    taxChargeable: v.optional(v.union(v.number(), v.null())),
    reliefEarlierThan: v.array(
      v.object({
        name: v.string(),
        amountRepaid: v.optional(v.union(v.number(), v.null())),
        amountReleasedOrWrittenOff: v.optional(v.union(v.number(), v.null())),
        date: v.string(),
      }),
    ),
    reliefEarlierDue: v.optional(v.union(v.number(), v.null())),
    loanLaterReliefNow: v.array(
      v.object({
        name: v.string(),
        amountRepaid: v.optional(v.union(v.number(), v.null())),
        amountReleasedOrWrittenOff: v.optional(v.union(v.number(), v.null())),
        date: v.string(),
      }),
    ),
    reliefLaterDue: v.optional(v.union(v.number(), v.null())),
    totalLoansOutstanding: v.optional(v.union(v.number(), v.null())),
    createdBy: v.optional(v.union(v.string(), v.null())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      throw new ConvexError("Convex close company loans schedule team not found");
    }

    const timestamp = nowIso();
    const existing = await ctx.db
      .query("closeCompanyLoansSchedules")
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
      beforeEndPeriod: args.beforeEndPeriod,
      loansMade: args.loansMade,
      taxChargeable: args.taxChargeable ?? undefined,
      reliefEarlierThan: args.reliefEarlierThan.map((item) => ({
        name: item.name,
        amountRepaid: item.amountRepaid ?? undefined,
        amountReleasedOrWrittenOff: item.amountReleasedOrWrittenOff ?? undefined,
        date: item.date,
      })),
      reliefEarlierDue: args.reliefEarlierDue ?? undefined,
      loanLaterReliefNow: args.loanLaterReliefNow.map((item) => ({
        name: item.name,
        amountRepaid: item.amountRepaid ?? undefined,
        amountReleasedOrWrittenOff: item.amountReleasedOrWrittenOff ?? undefined,
        date: item.date,
      })),
      reliefLaterDue: args.reliefLaterDue ?? undefined,
      totalLoansOutstanding: args.totalLoansOutstanding ?? undefined,
      createdBy: args.createdBy ?? undefined,
      updatedAt: timestamp,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);

      const updated = await ctx.db.get(existing._id);

      if (!updated) {
        throw new ConvexError("Failed to update close company loans schedule");
      }

      return serializeSchedule(args.publicTeamId, updated);
    }

    const insertedId = await ctx.db.insert("closeCompanyLoansSchedules", {
      publicCloseCompanyLoansScheduleId: crypto.randomUUID(),
      teamId: team._id,
      createdAt: timestamp,
      ...payload,
    });

    const inserted = await ctx.db.get(insertedId);

    if (!inserted) {
      throw new ConvexError("Failed to create close company loans schedule");
    }

    return serializeSchedule(args.publicTeamId, inserted);
  },
});

export const serviceDeleteCloseCompanyLoansSchedule = mutation({
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
      .query("closeCompanyLoansSchedules")
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
