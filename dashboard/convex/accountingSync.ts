import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";
import { nowIso } from "../../packages/domain/src/identity";

type AccountingSyncCtx = QueryCtx | MutationCtx;

const providerValidator = v.union(v.literal("xero"), v.literal("quickbooks"), v.literal("fortnox"));

const statusValidator = v.union(
  v.literal("synced"),
  v.literal("partial"),
  v.literal("failed"),
  v.literal("pending"),
);

type AccountingSyncProvider = "xero" | "quickbooks" | "fortnox";
type AccountingSyncStatus = "synced" | "partial" | "failed" | "pending";

type AccountingSyncDocument = Doc<"accountingSyncRecords">;

function serializeAccountingSyncRecord(publicTeamId: string, record: AccountingSyncDocument) {
  return {
    id: record.publicSyncRecordId ?? record._id,
    transactionId: record.transactionId,
    teamId: publicTeamId,
    provider: record.provider,
    providerTenantId: record.providerTenantId,
    providerTransactionId: record.providerTransactionId ?? null,
    syncedAttachmentMapping: (record.syncedAttachmentMapping ?? {}) as Record<
      string,
      string | null
    >,
    syncedAt: record.syncedAt,
    syncType: record.syncType ?? null,
    status: record.status,
    errorMessage: record.errorMessage ?? null,
    errorCode: record.errorCode ?? null,
    providerEntityType: record.providerEntityType ?? null,
    createdAt: record.createdAt,
  };
}

async function getTeamOrThrow(ctx: AccountingSyncCtx, publicTeamId: string) {
  const team = await getTeamByPublicTeamId(ctx, publicTeamId);

  if (!team) {
    throw new ConvexError("Convex accounting sync team not found");
  }

  return team;
}

async function getAccountingSyncRecordByLegacyId(
  ctx: AccountingSyncCtx,
  publicSyncRecordId: string,
) {
  return ctx.db
    .query("accountingSyncRecords")
    .withIndex("by_public_sync_record_id", (q) => q.eq("publicSyncRecordId", publicSyncRecordId))
    .unique();
}

async function getAccountingSyncRecordByTransactionProvider(
  ctx: AccountingSyncCtx,
  args: {
    teamId: Id<"teams">;
    transactionId: string;
    provider: AccountingSyncProvider;
  },
) {
  return ctx.db
    .query("accountingSyncRecords")
    .withIndex("by_team_provider_transaction", (q) =>
      q
        .eq("teamId", args.teamId)
        .eq("provider", args.provider)
        .eq("transactionId", args.transactionId),
    )
    .unique();
}

async function listAccountingSyncRecordsByTeam(ctx: AccountingSyncCtx, teamId: Id<"teams">) {
  return ctx.db
    .query("accountingSyncRecords")
    .withIndex("by_team_id", (q) => q.eq("teamId", teamId))
    .collect();
}

export const serviceGetAccountingSyncStatus = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    transactionIds: v.optional(v.array(v.string())),
    provider: v.optional(providerValidator),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    let records: AccountingSyncDocument[] = [];

    if (args.transactionIds && args.transactionIds.length > 0) {
      const transactionIds = [...new Set(args.transactionIds)];

      if (args.provider) {
        const existing = await Promise.all(
          transactionIds.map((transactionId) =>
            getAccountingSyncRecordByTransactionProvider(ctx, {
              teamId: team._id,
              transactionId,
              provider: args.provider!,
            }),
          ),
        );

        records = existing.flatMap((record) => (record ? [record as AccountingSyncDocument] : []));
      } else {
        const existing = await Promise.all(
          transactionIds.map((transactionId) =>
            ctx.db
              .query("accountingSyncRecords")
              .withIndex("by_team_transaction", (q) =>
                q.eq("teamId", team._id).eq("transactionId", transactionId),
              )
              .collect(),
          ),
        );

        records = existing.flat() as AccountingSyncDocument[];
      }
    } else if (args.provider) {
      const statuses: AccountingSyncStatus[] = ["synced", "partial", "failed", "pending"];
      const existing = await Promise.all(
        statuses.map((status) =>
          ctx.db
            .query("accountingSyncRecords")
            .withIndex("by_team_provider_status", (q) =>
              q.eq("teamId", team._id).eq("provider", args.provider!).eq("status", status),
            )
            .collect(),
        ),
      );

      records = existing.flat() as AccountingSyncDocument[];
    } else {
      records = (await listAccountingSyncRecordsByTeam(ctx, team._id)) as AccountingSyncDocument[];
    }

    return records
      .sort((left, right) => right.syncedAt.localeCompare(left.syncedAt))
      .map((record) => serializeAccountingSyncRecord(args.publicTeamId, record));
  },
});

export const serviceUpsertAccountingSyncRecord = mutation({
  args: {
    serviceKey: v.string(),
    publicSyncRecordId: v.optional(v.string()),
    publicTeamId: v.string(),
    transactionId: v.string(),
    provider: providerValidator,
    providerTenantId: v.string(),
    providerTransactionId: v.optional(v.string()),
    syncedAttachmentMapping: v.optional(v.any()),
    syncType: v.optional(v.literal("manual")),
    status: v.optional(statusValidator),
    errorMessage: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    providerEntityType: v.optional(v.string()),
    createdAt: v.optional(v.string()),
    syncedAt: v.optional(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamOrThrow(ctx, args.publicTeamId);
    const existing = await getAccountingSyncRecordByTransactionProvider(ctx, {
      teamId: team._id,
      transactionId: args.transactionId,
      provider: args.provider,
    });
    const timestamp = nowIso();
    const syncedAt = args.syncedAt ?? timestamp;
    const status = args.status ?? "synced";

    if (existing) {
      await ctx.db.patch(existing._id, {
        providerTenantId: args.providerTenantId,
        providerTransactionId: args.providerTransactionId,
        syncedAttachmentMapping:
          (args.syncedAttachmentMapping as Record<string, string | null> | undefined) ?? {},
        syncedAt,
        syncType: args.syncType,
        status,
        errorMessage: status === "synced" ? undefined : args.errorMessage,
        errorCode: status === "synced" ? undefined : args.errorCode,
        providerEntityType: args.providerEntityType,
      });

      const updated = await ctx.db.get(existing._id);

      if (!updated) {
        throw new ConvexError("Failed to update accounting sync record");
      }

      return serializeAccountingSyncRecord(args.publicTeamId, updated as AccountingSyncDocument);
    }

    const insertedId = await ctx.db.insert("accountingSyncRecords", {
      publicSyncRecordId: args.publicSyncRecordId ?? crypto.randomUUID(),
      transactionId: args.transactionId,
      teamId: team._id,
      provider: args.provider,
      providerTenantId: args.providerTenantId,
      providerTransactionId: args.providerTransactionId,
      syncedAttachmentMapping:
        (args.syncedAttachmentMapping as Record<string, string | null> | undefined) ?? {},
      syncedAt,
      syncType: args.syncType,
      status,
      errorMessage: status === "synced" ? undefined : args.errorMessage,
      errorCode: status === "synced" ? undefined : args.errorCode,
      providerEntityType: args.providerEntityType,
      createdAt: args.createdAt ?? timestamp,
    });

    const inserted = await ctx.db.get(insertedId);

    if (!inserted) {
      throw new ConvexError("Failed to create accounting sync record");
    }

    return serializeAccountingSyncRecord(args.publicTeamId, inserted as AccountingSyncDocument);
  },
});

export const serviceDeleteAccountingSyncRecords = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    transactionIds: v.array(v.string()),
    provider: v.optional(providerValidator),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    if (args.transactionIds.length === 0) {
      return { count: 0 };
    }

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return { count: 0 };
    }

    let count = 0;
    const transactionIds = [...new Set(args.transactionIds)];

    if (args.provider) {
      const existing = await Promise.all(
        transactionIds.map((transactionId) =>
          getAccountingSyncRecordByTransactionProvider(ctx, {
            teamId: team._id,
            transactionId,
            provider: args.provider!,
          }),
        ),
      );

      for (const record of existing) {
        if (!record) {
          continue;
        }

        await ctx.db.delete(record._id);
        count += 1;
      }

      return { count };
    }

    for (const transactionId of transactionIds) {
      const records = await ctx.db
        .query("accountingSyncRecords")
        .withIndex("by_team_transaction", (q) =>
          q.eq("teamId", team._id).eq("transactionId", transactionId),
        )
        .collect();

      for (const record of records) {
        await ctx.db.delete(record._id);
        count += 1;
      }
    }

    return { count };
  },
});

export const serviceUpdateSyncedAttachmentMapping = mutation({
  args: {
    serviceKey: v.string(),
    syncRecordId: v.string(),
    syncedAttachmentMapping: v.any(),
    status: v.optional(statusValidator),
    errorMessage: v.optional(v.union(v.string(), v.null())),
    errorCode: v.optional(v.union(v.string(), v.null())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const existing = await getAccountingSyncRecordByLegacyId(ctx, args.syncRecordId);

    if (!existing) {
      return null;
    }

    await ctx.db.patch(existing._id, {
      syncedAttachmentMapping:
        (args.syncedAttachmentMapping as Record<string, string | null> | undefined) ?? {},
      syncedAt: nowIso(),
      ...(args.status !== undefined ? { status: args.status } : {}),
      ...(args.errorMessage !== undefined ? { errorMessage: args.errorMessage ?? undefined } : {}),
      ...(args.errorCode !== undefined ? { errorCode: args.errorCode ?? undefined } : {}),
    });

    const updated = await ctx.db.get(existing._id);

    if (!updated) {
      throw new ConvexError("Failed to update accounting sync record");
    }

    const team = await ctx.db.get(updated.teamId);

    return serializeAccountingSyncRecord(
      team?.publicTeamId ?? "",
      updated as AccountingSyncDocument,
    );
  },
});
