import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";
import { nowIso } from "../../packages/domain/src/identity";

const inboxAccountProvider = v.union(v.literal("gmail"), v.literal("outlook"));
const inboxAccountStatus = v.union(
  v.literal("connected"),
  v.literal("disconnected"),
);

function serializeInboxAccountListRecord(record: {
  _id: string;
  publicInboxAccountId?: string;
  email: string;
  provider: "gmail" | "outlook";
  lastAccessed: string;
  status: "connected" | "disconnected";
  errorMessage?: string | null;
}) {
  return {
    id: record.publicInboxAccountId ?? record._id,
    email: record.email,
    provider: record.provider,
    lastAccessed: record.lastAccessed,
    status: record.status,
    errorMessage: record.errorMessage ?? null,
  };
}

function serializeInboxAccountDetailRecord(
  publicTeamId: string,
  record: {
    _id: string;
    publicInboxAccountId?: string;
    email: string;
    provider: "gmail" | "outlook";
    accessToken: string;
    refreshToken: string;
    expiryDate: string;
    lastAccessed: string;
  },
) {
  return {
    id: record.publicInboxAccountId ?? record._id,
    teamId: publicTeamId,
    email: record.email,
    provider: record.provider,
    accessToken: record.accessToken,
    refreshToken: record.refreshToken,
    expiryDate: record.expiryDate,
    lastAccessed: record.lastAccessed,
  };
}

export const serviceGetInboxAccounts = query({
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

    const records = await ctx.db
      .query("inboxAccounts")
      .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
      .collect();

    return records
      .sort((a, b) => a.email.localeCompare(b.email))
      .map((record) =>
        serializeInboxAccountListRecord({
          _id: record._id,
          publicInboxAccountId: record.publicInboxAccountId,
          email: record.email,
          provider: record.provider,
          lastAccessed: record.lastAccessed,
          status: record.status,
          errorMessage: record.errorMessage,
        }),
      );
  },
});

export const serviceGetInboxAccountsByIds = query({
  args: {
    serviceKey: v.string(),
    ids: v.array(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    if (args.ids.length === 0) {
      return [];
    }

    const records = await Promise.all(
      args.ids.map((id) =>
        ctx.db
          .query("inboxAccounts")
          .withIndex("by_public_inbox_account_id", (q) =>
            q.eq("publicInboxAccountId", id),
          )
          .unique(),
      ),
    );

    return records.flatMap((record) =>
      record
        ? [
            serializeInboxAccountListRecord({
              _id: record._id,
              publicInboxAccountId: record.publicInboxAccountId,
              email: record.email,
              provider: record.provider,
              lastAccessed: record.lastAccessed,
              status: record.status,
              errorMessage: record.errorMessage,
            }),
          ]
        : [],
    );
  },
});

export const serviceGetInboxAccountById = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    inboxAccountId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const [team, record] = await Promise.all([
      getTeamByPublicTeamId(ctx, args.publicTeamId),
      ctx.db
        .query("inboxAccounts")
        .withIndex("by_public_inbox_account_id", (q) =>
          q.eq("publicInboxAccountId", args.inboxAccountId),
        )
        .unique(),
    ]);

    if (!team || !record || record.teamId !== team._id) {
      return null;
    }

    return serializeInboxAccountDetailRecord(args.publicTeamId, {
      _id: record._id,
      publicInboxAccountId: record.publicInboxAccountId,
      email: record.email,
      provider: record.provider,
      accessToken: record.accessToken,
      refreshToken: record.refreshToken,
      expiryDate: record.expiryDate,
      lastAccessed: record.lastAccessed,
    });
  },
});

export const serviceDeleteInboxAccount = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    inboxAccountId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const [team, record] = await Promise.all([
      getTeamByPublicTeamId(ctx, args.publicTeamId),
      ctx.db
        .query("inboxAccounts")
        .withIndex("by_public_inbox_account_id", (q) =>
          q.eq("publicInboxAccountId", args.inboxAccountId),
        )
        .unique(),
    ]);

    if (!team || !record || record.teamId !== team._id) {
      return null;
    }

    const deleted = {
      id: record.publicInboxAccountId ?? record._id,
      scheduleId: record.scheduleId ?? null,
    };

    await ctx.db.delete(record._id);

    return deleted;
  },
});

export const serviceUpdateInboxAccount = mutation({
  args: {
    serviceKey: v.string(),
    id: v.string(),
    refreshToken: v.optional(v.string()),
    accessToken: v.optional(v.string()),
    expiryDate: v.optional(v.string()),
    scheduleId: v.optional(v.string()),
    lastAccessed: v.optional(v.string()),
    status: v.optional(inboxAccountStatus),
    errorMessage: v.optional(v.union(v.string(), v.null())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const record = await ctx.db
      .query("inboxAccounts")
      .withIndex("by_public_inbox_account_id", (q) =>
        q.eq("publicInboxAccountId", args.id),
      )
      .unique();

    if (!record) {
      return null;
    }

    const updates: {
      refreshToken?: string;
      accessToken?: string;
      expiryDate?: string;
      scheduleId?: string;
      lastAccessed?: string;
      status?: "connected" | "disconnected";
      errorMessage?: string | null;
      updatedAt: string;
    } = {
      updatedAt: nowIso(),
    };

    if (args.refreshToken !== undefined) {
      updates.refreshToken = args.refreshToken;
    }

    if (args.accessToken !== undefined) {
      updates.accessToken = args.accessToken;
    }

    if (args.expiryDate !== undefined) {
      updates.expiryDate = args.expiryDate;
    }

    if (args.scheduleId !== undefined) {
      updates.scheduleId = args.scheduleId;
    }

    if (args.lastAccessed !== undefined) {
      updates.lastAccessed = args.lastAccessed;
    }

    if (args.status !== undefined) {
      updates.status = args.status;
    }

    if (args.errorMessage !== undefined) {
      updates.errorMessage = args.errorMessage;
    }

    await ctx.db.patch(record._id, updates);

    return {
      id: record.publicInboxAccountId ?? record._id,
    };
  },
});

export const serviceUpsertInboxAccount = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    provider: inboxAccountProvider,
    accessToken: v.string(),
    refreshToken: v.string(),
    email: v.string(),
    lastAccessed: v.string(),
    externalId: v.string(),
    expiryDate: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      throw new ConvexError("Convex inbox account team not found");
    }

    const existing = await ctx.db
      .query("inboxAccounts")
      .withIndex("by_external_id", (q) => q.eq("externalId", args.externalId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        lastAccessed: args.lastAccessed,
        expiryDate: args.expiryDate,
        status: "connected",
        errorMessage: null,
        updatedAt: nowIso(),
      });

      return {
        id: existing.publicInboxAccountId ?? existing._id,
        provider: existing.provider,
        external_id: existing.externalId,
      };
    }

    const timestamp = nowIso();
    const insertedId = await ctx.db.insert("inboxAccounts", {
      publicInboxAccountId: crypto.randomUUID(),
      teamId: team._id,
      provider: args.provider,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      email: args.email,
      lastAccessed: args.lastAccessed,
      externalId: args.externalId,
      expiryDate: args.expiryDate,
      status: "connected",
      errorMessage: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const inserted = await ctx.db.get(insertedId);

    if (!inserted) {
      throw new ConvexError("Failed to create inbox account");
    }

    return {
      id: inserted.publicInboxAccountId ?? inserted._id,
      provider: inserted.provider,
      external_id: inserted.externalId,
    };
  },
});

export const serviceGetInboxAccountInfo = query({
  args: {
    serviceKey: v.string(),
    id: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const record = await ctx.db
      .query("inboxAccounts")
      .withIndex("by_public_inbox_account_id", (q) =>
        q.eq("publicInboxAccountId", args.id),
      )
      .unique();

    if (!record) {
      return null;
    }

    const team = await ctx.db.get(record.teamId);

    if (!team?.publicTeamId) {
      return null;
    }

    return {
      id: record.publicInboxAccountId ?? record._id,
      provider: record.provider,
      teamId: team.publicTeamId,
      lastAccessed: record.lastAccessed,
    };
  },
});
