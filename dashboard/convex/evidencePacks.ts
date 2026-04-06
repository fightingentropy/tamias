import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";
import { nowIso } from "../../packages/domain/src/identity";

type EvidencePackPayload = Record<string, unknown>;

function serializeEvidencePack(
  publicTeamId: string,
  record: {
    _id: string;
    publicEvidencePackId?: string;
    filingProfileId: string;
    vatReturnId: string;
    checksum: string;
    payload: EvidencePackPayload;
    createdBy?: string;
    createdAt: string;
  },
) {
  return {
    id: record.publicEvidencePackId ?? record._id,
    teamId: publicTeamId,
    filingProfileId: record.filingProfileId,
    vatReturnId: record.vatReturnId,
    checksum: record.checksum,
    payload: record.payload,
    createdBy: record.createdBy ?? null,
    createdAt: record.createdAt,
  };
}

export const serviceUpsertEvidencePack = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    evidencePackId: v.optional(v.string()),
    filingProfileId: v.string(),
    vatReturnId: v.string(),
    checksum: v.string(),
    payload: v.any(),
    createdBy: v.optional(v.union(v.string(), v.null())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      throw new ConvexError("Convex evidence pack team not found");
    }

    const existing = await ctx.db
      .query("evidencePacks")
      .withIndex("by_team_and_vat_return_id", (q) =>
        q.eq("teamId", team._id).eq("vatReturnId", args.vatReturnId),
      )
      .unique();

    const timestamp = nowIso();

    if (existing) {
      await ctx.db.patch(existing._id, {
        publicEvidencePackId: existing.publicEvidencePackId ?? args.evidencePackId ?? undefined,
        filingProfileId: args.filingProfileId,
        checksum: args.checksum,
        payload: args.payload as EvidencePackPayload,
        createdBy: args.createdBy ?? undefined,
        updatedAt: timestamp,
      });

      const updated = await ctx.db.get(existing._id);

      if (!updated) {
        throw new ConvexError("Failed to update evidence pack");
      }

      return serializeEvidencePack(args.publicTeamId, {
        _id: updated._id,
        publicEvidencePackId: updated.publicEvidencePackId,
        filingProfileId: updated.filingProfileId,
        vatReturnId: updated.vatReturnId,
        checksum: updated.checksum,
        payload: updated.payload as EvidencePackPayload,
        createdBy: updated.createdBy,
        createdAt: updated.createdAt,
      });
    }

    const insertedId = await ctx.db.insert("evidencePacks", {
      publicEvidencePackId: args.evidencePackId ?? crypto.randomUUID(),
      teamId: team._id,
      filingProfileId: args.filingProfileId,
      vatReturnId: args.vatReturnId,
      checksum: args.checksum,
      payload: args.payload as EvidencePackPayload,
      createdBy: args.createdBy ?? undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const inserted = await ctx.db.get(insertedId);

    if (!inserted) {
      throw new ConvexError("Failed to create evidence pack");
    }

    return serializeEvidencePack(args.publicTeamId, {
      _id: inserted._id,
      publicEvidencePackId: inserted.publicEvidencePackId,
      filingProfileId: inserted.filingProfileId,
      vatReturnId: inserted.vatReturnId,
      checksum: inserted.checksum,
      payload: inserted.payload as EvidencePackPayload,
      createdBy: inserted.createdBy,
      createdAt: inserted.createdAt,
    });
  },
});

export const serviceGetEvidencePackById = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    evidencePackId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return null;
    }

    const record = await ctx.db
      .query("evidencePacks")
      .withIndex("by_team_and_public_evidence_pack_id", (q) =>
        q.eq("teamId", team._id).eq("publicEvidencePackId", args.evidencePackId),
      )
      .unique();

    if (!record) {
      return null;
    }

    return serializeEvidencePack(args.publicTeamId, {
      _id: record._id,
      publicEvidencePackId: record.publicEvidencePackId,
      filingProfileId: record.filingProfileId,
      vatReturnId: record.vatReturnId,
      checksum: record.checksum,
      payload: record.payload as EvidencePackPayload,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
    });
  },
});
