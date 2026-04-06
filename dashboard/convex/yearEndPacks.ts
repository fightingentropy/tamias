import { ConvexError, v } from "convex/values";
import { nowIso } from "../../packages/domain/src/identity";
import { mutation, query } from "./_generated/server";
import { getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";

type ExportBundleRecord = {
  id: string;
  filePath: string;
  fileName: string;
  checksum: string;
  generatedAt: string;
  manifest: Record<string, unknown>;
};

function serializeYearEndPack(
  publicTeamId: string,
  record: {
    _id: string;
    publicYearEndPackId?: string;
    filingProfileId: string;
    periodKey: string;
    periodStart: string;
    periodEnd: string;
    accountsDueDate: string;
    corporationTaxDueDate: string;
    status: "draft" | "ready" | "exported";
    currency: string;
    trialBalance: unknown;
    profitAndLoss: unknown;
    balanceSheet: unknown;
    retainedEarnings: unknown;
    workingPapers: unknown;
    corporationTax: unknown;
    manualJournalCount: number;
    payrollRunCount: number;
    exportBundles: ExportBundleRecord[];
    latestExportedAt?: string;
    snapshotChecksum: string;
    createdAt: string;
    updatedAt: string;
  },
) {
  return {
    id: record.publicYearEndPackId ?? record._id,
    teamId: publicTeamId,
    filingProfileId: record.filingProfileId,
    periodKey: record.periodKey,
    periodStart: record.periodStart,
    periodEnd: record.periodEnd,
    accountsDueDate: record.accountsDueDate,
    corporationTaxDueDate: record.corporationTaxDueDate,
    status: record.status,
    currency: record.currency,
    trialBalance: record.trialBalance,
    profitAndLoss: record.profitAndLoss,
    balanceSheet: record.balanceSheet,
    retainedEarnings: record.retainedEarnings,
    workingPapers: record.workingPapers,
    corporationTax: record.corporationTax,
    manualJournalCount: record.manualJournalCount,
    payrollRunCount: record.payrollRunCount,
    exportBundles: record.exportBundles,
    latestExportedAt: record.latestExportedAt ?? null,
    snapshotChecksum: record.snapshotChecksum,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export const serviceUpsertYearEndPack = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    yearEndPackId: v.optional(v.string()),
    filingProfileId: v.string(),
    periodKey: v.string(),
    periodStart: v.string(),
    periodEnd: v.string(),
    accountsDueDate: v.string(),
    corporationTaxDueDate: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("ready"),
      v.literal("exported"),
    ),
    currency: v.string(),
    trialBalance: v.any(),
    profitAndLoss: v.any(),
    balanceSheet: v.any(),
    retainedEarnings: v.any(),
    workingPapers: v.any(),
    corporationTax: v.any(),
    manualJournalCount: v.number(),
    payrollRunCount: v.number(),
    exportBundles: v.array(
      v.object({
        id: v.string(),
        filePath: v.string(),
        fileName: v.string(),
        checksum: v.string(),
        generatedAt: v.string(),
        manifest: v.any(),
      }),
    ),
    latestExportedAt: v.optional(v.union(v.string(), v.null())),
    snapshotChecksum: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      throw new ConvexError("Convex year-end pack team not found");
    }

    const existing = await ctx.db
      .query("yearEndPacks")
      .withIndex("by_team_and_filing_profile_period_key", (q) =>
        q
          .eq("teamId", team._id)
          .eq("filingProfileId", args.filingProfileId)
          .eq("periodKey", args.periodKey),
      )
      .unique();
    const timestamp = nowIso();

    if (existing) {
      await ctx.db.patch(existing._id, {
        publicYearEndPackId:
          existing.publicYearEndPackId ?? args.yearEndPackId ?? undefined,
        periodStart: args.periodStart,
        periodEnd: args.periodEnd,
        accountsDueDate: args.accountsDueDate,
        corporationTaxDueDate: args.corporationTaxDueDate,
        status: args.status,
        currency: args.currency,
        trialBalance: args.trialBalance,
        profitAndLoss: args.profitAndLoss,
        balanceSheet: args.balanceSheet,
        retainedEarnings: args.retainedEarnings,
        workingPapers: args.workingPapers,
        corporationTax: args.corporationTax,
        manualJournalCount: args.manualJournalCount,
        payrollRunCount: args.payrollRunCount,
        exportBundles: args.exportBundles,
        latestExportedAt: args.latestExportedAt ?? undefined,
        snapshotChecksum: args.snapshotChecksum,
        updatedAt: timestamp,
      });

      const updated = await ctx.db.get(existing._id);

      if (!updated) {
        throw new ConvexError("Failed to update year-end pack");
      }

      return serializeYearEndPack(args.publicTeamId, updated);
    }

    const insertedId = await ctx.db.insert("yearEndPacks", {
      publicYearEndPackId: args.yearEndPackId ?? crypto.randomUUID(),
      teamId: team._id,
      filingProfileId: args.filingProfileId,
      periodKey: args.periodKey,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      accountsDueDate: args.accountsDueDate,
      corporationTaxDueDate: args.corporationTaxDueDate,
      status: args.status,
      currency: args.currency,
      trialBalance: args.trialBalance,
      profitAndLoss: args.profitAndLoss,
      balanceSheet: args.balanceSheet,
      retainedEarnings: args.retainedEarnings,
      workingPapers: args.workingPapers,
      corporationTax: args.corporationTax,
      manualJournalCount: args.manualJournalCount,
      payrollRunCount: args.payrollRunCount,
      exportBundles: args.exportBundles,
      latestExportedAt: args.latestExportedAt ?? undefined,
      snapshotChecksum: args.snapshotChecksum,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const inserted = await ctx.db.get(insertedId);

    if (!inserted) {
      throw new ConvexError("Failed to create year-end pack");
    }

    return serializeYearEndPack(args.publicTeamId, inserted);
  },
});

export const serviceGetYearEndPackByPeriod = query({
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
      .query("yearEndPacks")
      .withIndex("by_team_and_filing_profile_period_key", (q) =>
        q
          .eq("teamId", team._id)
          .eq("filingProfileId", args.filingProfileId)
          .eq("periodKey", args.periodKey),
      )
      .unique();

    if (!record) {
      return null;
    }

    return serializeYearEndPack(args.publicTeamId, record);
  },
});
