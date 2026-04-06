import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";
import { nowIso } from "../../packages/domain/src/identity";

type ComplianceAdjustmentLineCode =
  | "box1"
  | "box2"
  | "box3"
  | "box4"
  | "box5"
  | "box6"
  | "box7"
  | "box8"
  | "box9";

type ComplianceAdjustmentRecord = {
  _id: string;
  publicComplianceAdjustmentId?: string;
  filingProfileId: string;
  vatReturnId?: string;
  obligationId?: string;
  effectiveDate: string;
  lineCode: ComplianceAdjustmentLineCode;
  amount: number;
  reason: string;
  note?: string;
  createdBy?: string;
  meta?: unknown;
  createdAt: string;
};

function serializeComplianceAdjustment(publicTeamId: string, record: ComplianceAdjustmentRecord) {
  return {
    id: record.publicComplianceAdjustmentId ?? record._id,
    teamId: publicTeamId,
    filingProfileId: record.filingProfileId,
    vatReturnId: record.vatReturnId ?? null,
    obligationId: record.obligationId ?? null,
    effectiveDate: record.effectiveDate,
    lineCode: record.lineCode,
    amount: record.amount,
    reason: record.reason,
    note: record.note ?? null,
    createdBy: record.createdBy ?? null,
    meta: record.meta ?? null,
    createdAt: record.createdAt,
  };
}

export const serviceListComplianceAdjustmentsForPeriod = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    filingProfileId: v.string(),
    periodStart: v.string(),
    periodEnd: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    const records = await ctx.db
      .query("complianceAdjustments")
      .withIndex("by_team_and_filing_profile_id", (q) =>
        q.eq("teamId", team._id).eq("filingProfileId", args.filingProfileId),
      )
      .collect();

    return records
      .filter(
        (record) =>
          record.effectiveDate >= args.periodStart && record.effectiveDate <= args.periodEnd,
      )
      .map((record) =>
        serializeComplianceAdjustment(args.publicTeamId, {
          _id: record._id,
          publicComplianceAdjustmentId: record.publicComplianceAdjustmentId,
          filingProfileId: record.filingProfileId,
          vatReturnId: record.vatReturnId,
          obligationId: record.obligationId,
          effectiveDate: record.effectiveDate,
          lineCode: record.lineCode,
          amount: record.amount,
          reason: record.reason,
          note: record.note,
          createdBy: record.createdBy,
          meta: record.meta,
          createdAt: record.createdAt,
        }),
      );
  },
});

export const serviceCountComplianceAdjustmentsByVatReturnId = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    vatReturnId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return 0;
    }

    const records = await ctx.db
      .query("complianceAdjustments")
      .withIndex("by_team_and_vat_return_id", (q) =>
        q.eq("teamId", team._id).eq("vatReturnId", args.vatReturnId),
      )
      .collect();

    return records.length;
  },
});

export const serviceCreateComplianceAdjustment = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    complianceAdjustmentId: v.optional(v.string()),
    filingProfileId: v.string(),
    vatReturnId: v.optional(v.union(v.string(), v.null())),
    obligationId: v.optional(v.union(v.string(), v.null())),
    effectiveDate: v.string(),
    lineCode: v.union(
      v.literal("box1"),
      v.literal("box2"),
      v.literal("box3"),
      v.literal("box4"),
      v.literal("box5"),
      v.literal("box6"),
      v.literal("box7"),
      v.literal("box8"),
      v.literal("box9"),
    ),
    amount: v.number(),
    reason: v.string(),
    note: v.optional(v.union(v.string(), v.null())),
    createdBy: v.optional(v.union(v.string(), v.null())),
    meta: v.optional(v.any()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      throw new ConvexError("Convex compliance adjustment team not found");
    }

    const insertedId = await ctx.db.insert("complianceAdjustments", {
      publicComplianceAdjustmentId: args.complianceAdjustmentId ?? crypto.randomUUID(),
      teamId: team._id,
      filingProfileId: args.filingProfileId,
      vatReturnId: args.vatReturnId ?? undefined,
      obligationId: args.obligationId ?? undefined,
      effectiveDate: args.effectiveDate,
      lineCode: args.lineCode,
      amount: args.amount,
      reason: args.reason,
      note: args.note ?? undefined,
      createdBy: args.createdBy ?? undefined,
      meta: args.meta,
      createdAt: nowIso(),
    });

    const inserted = await ctx.db.get(insertedId);

    if (!inserted) {
      throw new ConvexError("Failed to create compliance adjustment");
    }

    return serializeComplianceAdjustment(args.publicTeamId, {
      _id: inserted._id,
      publicComplianceAdjustmentId: inserted.publicComplianceAdjustmentId,
      filingProfileId: inserted.filingProfileId,
      vatReturnId: inserted.vatReturnId,
      obligationId: inserted.obligationId,
      effectiveDate: inserted.effectiveDate,
      lineCode: inserted.lineCode,
      amount: inserted.amount,
      reason: inserted.reason,
      note: inserted.note,
      createdBy: inserted.createdBy,
      meta: inserted.meta,
      createdAt: inserted.createdAt,
    });
  },
});
