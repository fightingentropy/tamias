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

function serializePayrollRun(
  publicTeamId: string,
  record: {
    _id: string;
    publicPayrollRunId?: string;
    filingProfileId: string;
    periodKey: string;
    payPeriodStart: string;
    payPeriodEnd: string;
    runDate: string;
    source: "csv" | "manual";
    status: "imported" | "exported";
    importChecksum: string;
    currency: string;
    journalEntryId: string;
    lineCount: number;
    liabilityTotals: {
      grossPay: number;
      employerTaxes: number;
      payeLiability: number;
    };
    exportBundles: ExportBundleRecord[];
    latestExportedAt?: string;
    meta?: unknown;
    createdBy?: string;
    createdAt: string;
    updatedAt: string;
  },
) {
  return {
    id: record.publicPayrollRunId ?? record._id,
    teamId: publicTeamId,
    filingProfileId: record.filingProfileId,
    periodKey: record.periodKey,
    payPeriodStart: record.payPeriodStart,
    payPeriodEnd: record.payPeriodEnd,
    runDate: record.runDate,
    source: record.source,
    status: record.status,
    checksum: record.importChecksum,
    currency: record.currency,
    journalEntryId: record.journalEntryId,
    lineCount: record.lineCount,
    liabilityTotals: record.liabilityTotals,
    exportBundles: record.exportBundles,
    latestExportedAt: record.latestExportedAt ?? null,
    meta: record.meta ?? null,
    createdBy: record.createdBy ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export const serviceListPayrollRuns = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    return ctx.db
      .query("payrollRuns")
      .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
      .collect()
      .then((records) =>
        records
          .sort((left, right) => right.payPeriodEnd.localeCompare(left.payPeriodEnd))
          .map((record) => serializePayrollRun(args.publicTeamId, record)),
      );
  },
});

export const serviceGetPayrollRunByPeriod = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    periodKey: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return null;
    }

    const record = await ctx.db
      .query("payrollRuns")
      .withIndex("by_team_and_period_key", (q) =>
        q.eq("teamId", team._id).eq("periodKey", args.periodKey),
      )
      .unique();

    if (!record) {
      return null;
    }

    return serializePayrollRun(args.publicTeamId, record);
  },
});

export const serviceUpsertPayrollRun = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    payrollRunId: v.optional(v.string()),
    filingProfileId: v.string(),
    periodKey: v.string(),
    payPeriodStart: v.string(),
    payPeriodEnd: v.string(),
    runDate: v.string(),
    source: v.union(v.literal("csv"), v.literal("manual")),
    status: v.union(v.literal("imported"), v.literal("exported")),
    importChecksum: v.string(),
    currency: v.string(),
    journalEntryId: v.string(),
    lineCount: v.number(),
    liabilityTotals: v.object({
      grossPay: v.number(),
      employerTaxes: v.number(),
      payeLiability: v.number(),
    }),
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
    meta: v.optional(v.any()),
    createdBy: v.optional(v.union(v.string(), v.null())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      throw new ConvexError("Convex payroll run team not found");
    }

    const existing = await ctx.db
      .query("payrollRuns")
      .withIndex("by_team_and_period_key", (q) =>
        q.eq("teamId", team._id).eq("periodKey", args.periodKey),
      )
      .unique();
    const timestamp = nowIso();

    if (existing) {
      await ctx.db.patch(existing._id, {
        publicPayrollRunId: existing.publicPayrollRunId ?? args.payrollRunId,
        filingProfileId: args.filingProfileId,
        payPeriodStart: args.payPeriodStart,
        payPeriodEnd: args.payPeriodEnd,
        runDate: args.runDate,
        source: args.source,
        status: args.status,
        importChecksum: args.importChecksum,
        currency: args.currency,
        journalEntryId: args.journalEntryId,
        lineCount: args.lineCount,
        liabilityTotals: args.liabilityTotals,
        exportBundles: args.exportBundles,
        latestExportedAt: args.latestExportedAt ?? undefined,
        meta: args.meta,
        createdBy: args.createdBy ?? undefined,
        updatedAt: timestamp,
      });

      const updated = await ctx.db.get(existing._id);

      if (!updated) {
        throw new ConvexError("Failed to update payroll run");
      }

      return serializePayrollRun(args.publicTeamId, updated);
    }

    const insertedId = await ctx.db.insert("payrollRuns", {
      publicPayrollRunId: args.payrollRunId ?? crypto.randomUUID(),
      teamId: team._id,
      filingProfileId: args.filingProfileId,
      periodKey: args.periodKey,
      payPeriodStart: args.payPeriodStart,
      payPeriodEnd: args.payPeriodEnd,
      runDate: args.runDate,
      source: args.source,
      status: args.status,
      importChecksum: args.importChecksum,
      currency: args.currency,
      journalEntryId: args.journalEntryId,
      lineCount: args.lineCount,
      liabilityTotals: args.liabilityTotals,
      exportBundles: args.exportBundles,
      latestExportedAt: args.latestExportedAt ?? undefined,
      meta: args.meta,
      createdBy: args.createdBy ?? undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const inserted = await ctx.db.get(insertedId);

    if (!inserted) {
      throw new ConvexError("Failed to create payroll run");
    }

    return serializePayrollRun(args.publicTeamId, inserted);
  },
});
