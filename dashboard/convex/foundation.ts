import { ConvexError, v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { normalizeOptionalString, nowIso } from "../../packages/domain/src/identity";
import {
  getAppUserById,
  getOAuthApplicationByPublicApplicationId,
  getTeamByPublicTeamId,
} from "./lib/identity";
import { requireServiceKey } from "./lib/service";

type DbCtx = QueryCtx | MutationCtx;

function publicId(value: string | undefined, fallback: string) {
  return value || fallback;
}

function normalizeStringArray(values: string[] | undefined) {
  return values?.filter(Boolean) ?? [];
}

async function getApiKeyByPublicApiKeyId(ctx: DbCtx, publicApiKeyId: string) {
  return ctx.db
    .query("apiKeys")
    .withIndex("by_public_api_key_id", (q) =>
      q.eq("publicApiKeyId", publicApiKeyId),
    )
    .unique();
}

async function getOAuthApplicationByClientId(ctx: DbCtx, clientId: string) {
  return ctx.db
    .query("oauthApplications")
    .withIndex("by_client_id", (q) => q.eq("clientId", clientId))
    .unique();
}

async function getOAuthAuthorizationCodeByCode(ctx: DbCtx, code: string) {
  return ctx.db
    .query("oauthAuthorizationCodes")
    .withIndex("by_code", (q) => q.eq("code", code))
    .unique();
}

async function getOAuthAccessTokenByTokenHash(ctx: DbCtx, tokenHash: string) {
  return ctx.db
    .query("oauthAccessTokens")
    .withIndex("by_token", (q) => q.eq("token", tokenHash))
    .unique();
}

async function getOAuthAccessTokenByRefreshTokenHash(
  ctx: DbCtx,
  refreshTokenHash: string,
) {
  return ctx.db
    .query("oauthAccessTokens")
    .withIndex("by_refresh_token", (q) => q.eq("refreshToken", refreshTokenHash))
    .unique();
}

async function getTeamSummaryByPublicTeamId(ctx: DbCtx, publicTeamId: string) {
  const team = await getTeamByPublicTeamId(ctx, publicTeamId);

  if (!team) {
    return null;
  }

  return {
    id: publicId(team.publicTeamId, team._id),
    name: team.name ?? null,
  };
}

async function getInstalledAppsByAppId(ctx: DbCtx, appId: string) {
  return ctx.db
    .query("installedApps")
    .withIndex("by_app_id", (q) => q.eq("appId", appId))
    .collect();
}

async function serializeInstalledApp(
  ctx: DbCtx,
  installedApp: Doc<"installedApps">,
) {
  const [team, createdBy] = await Promise.all([
    ctx.db.get(installedApp.teamId),
    installedApp.createdByAppUserId
      ? ctx.db.get(installedApp.createdByAppUserId)
      : null,
  ]);

  return {
    id: publicId(installedApp.publicAppRecordId, installedApp._id),
    teamId: team?.publicTeamId ?? null,
    createdBy: createdBy?._id ?? null,
    appId: installedApp.appId,
    config: installedApp.config ?? null,
    settings: installedApp.settings ?? null,
    createdAt: installedApp.createdAt,
    updatedAt: installedApp.updatedAt,
  };
}

async function serializeApiKey(
  ctx: DbCtx,
  apiKey: Doc<"apiKeys">,
) {
  const [appUser, team] = await Promise.all([
    ctx.db.get(apiKey.appUserId),
    ctx.db.get(apiKey.teamId),
  ]);

  return {
    id: publicId(apiKey.publicApiKeyId, apiKey._id),
    name: apiKey.name,
    userId: appUser?._id ?? null,
    teamId: team?.publicTeamId ?? null,
    convexTeamId: team?._id ?? null,
    createdAt: apiKey.createdAt,
    scopes: apiKey.scopes,
    lastUsedAt: apiKey.lastUsedAt ?? null,
    user: {
      id: appUser?._id ?? null,
      convexId: appUser?._id ?? null,
      email: appUser?.email ?? null,
      fullName: appUser?.fullName ?? null,
      avatarUrl: appUser?.avatarUrl ?? null,
    },
  };
}

async function serializeOAuthApplication(
  ctx: DbCtx,
  application: Doc<"oauthApplications">,
) {
  const createdByUser = await ctx.db.get(application.createdByAppUserId);

  return {
    id: publicId(application.publicApplicationId, application._id),
    name: application.name,
    slug: application.slug,
    description: application.description ?? null,
    overview: application.overview ?? null,
    developerName: application.developerName ?? null,
    logoUrl: application.logoUrl ?? null,
    website: application.website ?? null,
    installUrl: application.installUrl ?? null,
    screenshots: application.screenshots,
    redirectUris: application.redirectUris,
    clientId: application.clientId,
    clientSecret: application.clientSecret,
    scopes: application.scopes,
    teamId: publicId((await ctx.db.get(application.teamId))?.publicTeamId, application.teamId),
    createdBy: createdByUser?._id ?? null,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
    isPublic: application.isPublic,
    active: application.active,
    status: application.status,
    createdByUser: createdByUser
      ? {
          id: createdByUser._id ?? null,
          fullName: createdByUser.fullName ?? null,
          avatarUrl: createdByUser.avatarUrl ?? null,
        }
      : {
          id: null,
          fullName: null,
          avatarUrl: null,
        },
  };
}

async function serializeAuthorizedApplication(
  ctx: DbCtx,
  token: Doc<"oauthAccessTokens">,
) {
  const application = await ctx.db.get(token.applicationId);

  if (!application || !application.active) {
    return null;
  }

  return {
    id: publicId(application.publicApplicationId, application._id),
    name: application.name,
    description: application.description ?? null,
    overview: application.overview ?? null,
    developerName: application.developerName ?? null,
    logoUrl: application.logoUrl ?? null,
    website: application.website ?? null,
    installUrl: application.installUrl ?? null,
    screenshots: application.screenshots,
    scopes: token.scopes,
    lastUsedAt: token.lastUsedAt ?? null,
    createdAt: token.createdAt,
    expiresAt: token.expiresAt,
    refreshTokenExpiresAt: token.refreshTokenExpiresAt ?? null,
  };
}

async function getActivityByPublicActivityId(
  ctx: DbCtx,
  publicActivityId: string,
) {
  return ctx.db
    .query("activities")
    .withIndex("by_public_activity_id", (q) =>
      q.eq("publicActivityId", publicActivityId),
    )
    .unique();
}

async function serializeNotificationSetting(
  ctx: DbCtx,
  setting: Doc<"notificationSettings">,
) {
  const [appUser, team] = await Promise.all([
    ctx.db.get(setting.appUserId),
    ctx.db.get(setting.teamId),
  ]);

  return {
    id: publicId(
      setting.publicNotificationSettingId,
      setting._id,
    ),
    userId: appUser?._id ?? null,
    teamId: team?.publicTeamId ?? null,
    notificationType: setting.notificationType,
    channel: setting.channel as "in_app" | "email" | "push",
    enabled: setting.enabled,
    createdAt: setting.createdAt,
    updatedAt: setting.updatedAt,
  };
}

async function serializeActivity(
  ctx: DbCtx,
  activity: Doc<"activities">,
) {
  const [appUser, team] = await Promise.all([
    activity.appUserId ? ctx.db.get(activity.appUserId) : null,
    ctx.db.get(activity.teamId),
  ]);

  return {
    id: publicId(activity.publicActivityId, activity._id),
    createdAt: activity.createdAt,
    teamId: team?.publicTeamId ?? null,
    userId: appUser?._id ?? null,
    type: activity.type,
    priority: activity.priority,
    groupId: activity.groupId ?? null,
    source: activity.source as "system" | "user",
    metadata: activity.metadata as Record<string, unknown>,
    status: activity.status as "unread" | "read" | "archived",
    lastUsedAt: activity.lastUsedAt ?? null,
  };
}

async function upsertNotificationSettingRecord(
  ctx: MutationCtx,
  args: {
    userId: Id<"appUsers">;
    publicTeamId: string;
    notificationType: string;
    channel: "in_app" | "email" | "push";
    enabled: boolean;
  },
) {
  const [appUser, team] = await Promise.all([
    getAppUserById(ctx, args.userId),
    getTeamByPublicTeamId(ctx, args.publicTeamId),
  ]);

  if (!appUser || !team) {
    throw new ConvexError("Missing user or team for notification setting");
  }

  const existing = (
    await ctx.db
      .query("notificationSettings")
      .withIndex("by_app_user_and_team", (q) =>
        q.eq("appUserId", appUser._id).eq("teamId", team._id),
      )
      .collect()
  ).find(
    (setting) =>
      setting.notificationType === args.notificationType &&
      setting.channel === args.channel,
  );

  const timestamp = nowIso();

  if (existing) {
    await ctx.db.patch(existing._id, {
      enabled: args.enabled,
      updatedAt: timestamp,
    });

    const updated = await ctx.db.get(existing._id);

    if (!updated) {
      throw new ConvexError("Failed to update notification setting");
    }

    return serializeNotificationSetting(ctx, updated);
  }

  const insertedId = await ctx.db.insert("notificationSettings", {
    publicNotificationSettingId: undefined,
    appUserId: appUser._id,
    teamId: team._id,
    notificationType: args.notificationType,
    channel: args.channel,
    enabled: args.enabled,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const inserted = await ctx.db.get(insertedId);

  if (!inserted) {
    throw new ConvexError("Failed to create notification setting");
  }

  return serializeNotificationSetting(ctx, inserted);
}

async function findUniqueSlug(
  ctx: MutationCtx,
  name: string,
  excludeApplicationId?: Id<"oauthApplications">,
) {
  const baseSlug =
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "app";

  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await ctx.db
      .query("oauthApplications")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();

    if (!existing || existing._id === excludeApplicationId) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
}

export const serviceGetTeamByPublicTeamId = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);
    return getTeamSummaryByPublicTeamId(ctx, args.publicTeamId);
  },
});

export const serviceGetApiKeyByHash = query({
  args: {
    serviceKey: v.string(),
    keyHash: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const apiKey = await ctx.db
      .query("apiKeys")
      .withIndex("by_key_hash", (q) => q.eq("keyHash", args.keyHash))
      .unique();

    if (!apiKey) {
      return null;
    }

    return serializeApiKey(ctx, apiKey);
  },
});

export const serviceListApiKeysByTeam = query({
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

    const apiKeys = await ctx.db
      .query("apiKeys")
      .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
      .collect();

    const serialized = await Promise.all(apiKeys.map((apiKey) => serializeApiKey(ctx, apiKey)));

    return serialized.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
});

export const serviceGetOAuthApplicationByClientId = query({
  args: {
    serviceKey: v.string(),
    clientId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const application = await getOAuthApplicationByClientId(ctx, args.clientId);

    if (!application) {
      return null;
    }

    return serializeOAuthApplication(ctx, application);
  },
});

export const serviceGetOAuthApplicationById = query({
  args: {
    serviceKey: v.string(),
    publicApplicationId: v.string(),
    publicTeamId: v.optional(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const application = await getOAuthApplicationByPublicApplicationId(
      ctx,
      args.publicApplicationId,
    );

    if (!application) {
      return null;
    }

    if (args.publicTeamId) {
      const team = await ctx.db.get(application.teamId);

      if (!team || team.publicTeamId !== args.publicTeamId) {
        return null;
      }
    }

    return serializeOAuthApplication(ctx, application);
  },
});

export const serviceListOAuthApplicationsByTeam = query({
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

    const applications = await ctx.db
      .query("oauthApplications")
      .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
      .collect();

    const serialized = await Promise.all(
      applications.map((application) => serializeOAuthApplication(ctx, application)),
    );

    return serialized.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
});

export const serviceGetAccessTokenByHash = query({
  args: {
    serviceKey: v.string(),
    tokenHash: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const token = await getOAuthAccessTokenByTokenHash(ctx, args.tokenHash);

    if (!token || token.revoked || token.expiresAt <= nowIso()) {
      return null;
    }

    const [application, appUser, team] = await Promise.all([
      ctx.db.get(token.applicationId),
      ctx.db.get(token.appUserId),
      ctx.db.get(token.teamId),
    ]);

    if (!application?.active) {
      return null;
    }

    return {
      id: publicId(token.publicAccessTokenId, token._id),
      applicationId: publicId(application.publicApplicationId, application._id),
      teamId: team?.publicTeamId ?? null,
      convexTeamId: team?._id ?? null,
      scopes: token.scopes,
      expiresAt: token.expiresAt,
      revoked: token.revoked,
      user: {
        id: appUser?._id ?? null,
        convexId: appUser?._id ?? null,
        fullName: appUser?.fullName ?? null,
        email: appUser?.email ?? null,
        avatarUrl: appUser?.avatarUrl ?? null,
      },
      application: {
        id: publicId(application.publicApplicationId, application._id),
        name: application.name,
        clientId: application.clientId,
        active: application.active,
      },
    };
  },
});

export const serviceGetUserAuthorizedApplications = query({
  args: {
    serviceKey: v.string(),
    userId: v.id("appUsers"),
    publicTeamId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const [appUser, team] = await Promise.all([
      getAppUserById(ctx, args.userId),
      getTeamByPublicTeamId(ctx, args.publicTeamId),
    ]);

    if (!appUser || !team) {
      return [];
    }

    const now = nowIso();
    const tokens = await ctx.db
      .query("oauthAccessTokens")
      .withIndex("by_app_user_id", (q) => q.eq("appUserId", appUser._id))
      .collect();

    const filtered = tokens.filter(
      (token) =>
        token.teamId === team._id && !token.revoked && token.expiresAt > now,
    );

    const serialized = (
      await Promise.all(filtered.map((token) => serializeAuthorizedApplication(ctx, token)))
    ).filter((value): value is NonNullable<typeof value> => Boolean(value));

    return serialized.sort((a, b) => {
      const aKey = a.lastUsedAt ?? a.createdAt;
      const bKey = b.lastUsedAt ?? b.createdAt;

      return bKey.localeCompare(aKey);
    });
  },
});

export const serviceHasUserEverAuthorizedApp = query({
  args: {
    serviceKey: v.string(),
    userId: v.id("appUsers"),
    publicTeamId: v.string(),
    publicApplicationId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const [appUser, team, application] = await Promise.all([
      getAppUserById(ctx, args.userId),
      getTeamByPublicTeamId(ctx, args.publicTeamId),
      getOAuthApplicationByPublicApplicationId(ctx, args.publicApplicationId),
    ]);

    if (!appUser || !team || !application) {
      return false;
    }

    const tokens = await ctx.db
      .query("oauthAccessTokens")
      .withIndex("by_app_user_id", (q) => q.eq("appUserId", appUser._id))
      .collect();

    return tokens.some(
      (token) =>
        token.teamId === team._id && token.applicationId === application._id,
    );
  },
});

export const serviceTouchApiKey = mutation({
  args: {
    serviceKey: v.string(),
    publicApiKeyId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const apiKey = await getApiKeyByPublicApiKeyId(ctx, args.publicApiKeyId);

    if (!apiKey) {
      return null;
    }

    const timestamp = nowIso();
    await ctx.db.patch(apiKey._id, {
      lastUsedAt: timestamp,
      updatedAt: timestamp,
    });

    return args.publicApiKeyId;
  },
});

export const serviceTouchOAuthAccessToken = mutation({
  args: {
    serviceKey: v.string(),
    publicAccessTokenId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const token = await ctx.db
      .query("oauthAccessTokens")
      .withIndex("by_public_access_token_id", (q) =>
        q.eq("publicAccessTokenId", args.publicAccessTokenId),
      )
      .unique();

    if (!token) {
      return null;
    }

    await ctx.db.patch(token._id, {
      lastUsedAt: nowIso(),
      updatedAt: nowIso(),
    });

    return args.publicAccessTokenId;
  },
});

export const serviceDeleteApiKey = mutation({
  args: {
    serviceKey: v.string(),
    publicApiKeyId: v.string(),
    publicTeamId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const [apiKey, team] = await Promise.all([
      getApiKeyByPublicApiKeyId(ctx, args.publicApiKeyId),
      getTeamByPublicTeamId(ctx, args.publicTeamId),
    ]);

    if (!apiKey || !team || apiKey.teamId !== team._id) {
      return null;
    }

    await ctx.db.delete(apiKey._id);

    return args.publicApiKeyId;
  },
});

export const serviceUpdateOAuthApplication = mutation({
  args: {
    serviceKey: v.string(),
    publicApplicationId: v.string(),
    publicTeamId: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    overview: v.optional(v.union(v.string(), v.null())),
    developerName: v.optional(v.union(v.string(), v.null())),
    logoUrl: v.optional(v.union(v.string(), v.null())),
    website: v.optional(v.union(v.string(), v.null())),
    installUrl: v.optional(v.union(v.string(), v.null())),
    screenshots: v.optional(v.array(v.string())),
    redirectUris: v.optional(v.array(v.string())),
    scopes: v.optional(v.array(v.string())),
    isPublic: v.optional(v.boolean()),
    active: v.optional(v.boolean()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const [application, team] = await Promise.all([
      getOAuthApplicationByPublicApplicationId(ctx, args.publicApplicationId),
      getTeamByPublicTeamId(ctx, args.publicTeamId),
    ]);

    if (!application || !team || application.teamId !== team._id) {
      return null;
    }

    const patch: Partial<Doc<"oauthApplications">> = {
      updatedAt: nowIso(),
    };

    if (args.name !== undefined) {
      patch.name = args.name;
      patch.slug = await findUniqueSlug(ctx, args.name, application._id);
    }

    if (args.description !== undefined) {
      patch.description = normalizeOptionalString(args.description) ?? undefined;
    }

    if (args.overview !== undefined) {
      patch.overview = normalizeOptionalString(args.overview) ?? undefined;
    }

    if (args.developerName !== undefined) {
      patch.developerName =
        normalizeOptionalString(args.developerName) ?? undefined;
    }

    if (args.logoUrl !== undefined) {
      patch.logoUrl = normalizeOptionalString(args.logoUrl) ?? undefined;
    }

    if (args.website !== undefined) {
      patch.website = normalizeOptionalString(args.website) ?? undefined;
    }

    if (args.installUrl !== undefined) {
      patch.installUrl = normalizeOptionalString(args.installUrl) ?? undefined;
    }

    if (args.screenshots !== undefined) {
      patch.screenshots = normalizeStringArray(args.screenshots);
    }

    if (args.redirectUris !== undefined) {
      patch.redirectUris = normalizeStringArray(args.redirectUris);
    }

    if (args.scopes !== undefined) {
      patch.scopes = normalizeStringArray(args.scopes);
    }

    if (args.isPublic !== undefined) {
      patch.isPublic = args.isPublic;
    }

    if (args.active !== undefined) {
      patch.active = args.active;
    }

    await ctx.db.patch(application._id, patch);

    const updated = await ctx.db.get(application._id);

    if (!updated) {
      return null;
    }

    return serializeOAuthApplication(ctx, updated);
  },
});

export const serviceDeleteOAuthApplication = mutation({
  args: {
    serviceKey: v.string(),
    publicApplicationId: v.string(),
    publicTeamId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const [application, team] = await Promise.all([
      getOAuthApplicationByPublicApplicationId(ctx, args.publicApplicationId),
      getTeamByPublicTeamId(ctx, args.publicTeamId),
    ]);

    if (!application || !team || application.teamId !== team._id) {
      return null;
    }

    await ctx.db.delete(application._id);

    return {
      id: args.publicApplicationId,
      name: application.name,
    };
  },
});

export const serviceUpdateOAuthApplicationStatus = mutation({
  args: {
    serviceKey: v.string(),
    publicApplicationId: v.string(),
    publicTeamId: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const [application, team] = await Promise.all([
      getOAuthApplicationByPublicApplicationId(ctx, args.publicApplicationId),
      getTeamByPublicTeamId(ctx, args.publicTeamId),
    ]);

    if (!application || !team || application.teamId !== team._id) {
      return null;
    }

    await ctx.db.patch(application._id, {
      status: args.status,
      updatedAt: nowIso(),
    });

    return {
      id: args.publicApplicationId,
      name: application.name,
      status: args.status,
    };
  },
});

export const serviceRevokeUserApplicationTokens = mutation({
  args: {
    serviceKey: v.string(),
    userId: v.id("appUsers"),
    publicApplicationId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const [appUser, application] = await Promise.all([
      getAppUserById(ctx, args.userId),
      getOAuthApplicationByPublicApplicationId(ctx, args.publicApplicationId),
    ]);

    if (!appUser || !application) {
      return { success: true };
    }

    const timestamp = nowIso();
    const tokens = await ctx.db
      .query("oauthAccessTokens")
      .withIndex("by_app_user_id", (q) => q.eq("appUserId", appUser._id))
      .collect();

    await Promise.all(
      tokens
        .filter(
          (token) => token.applicationId === application._id && !token.revoked,
        )
        .map((token) =>
          ctx.db.patch(token._id, {
            revoked: true,
            revokedAt: timestamp,
            updatedAt: timestamp,
          }),
        ),
    );

    return { success: true };
  },
});

export const serviceListInstalledAppsByTeam = query({
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

    const installedApps = await ctx.db
      .query("installedApps")
      .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
      .collect();

    const serialized = await Promise.all(
      installedApps.map((installedApp) => serializeInstalledApp(ctx, installedApp)),
    );

    return serialized.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
});

export const serviceGetInstalledAppByTeamAndAppId = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    appId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return null;
    }

    const installedApp = await ctx.db
      .query("installedApps")
      .withIndex("by_team_and_app_id", (q) =>
        q.eq("teamId", team._id).eq("appId", args.appId),
      )
      .unique();

    return installedApp ? serializeInstalledApp(ctx, installedApp) : null;
  },
});

export const serviceGetInstalledAppBySlackTeamId = query({
  args: {
    serviceKey: v.string(),
    slackTeamId: v.string(),
    channelId: v.optional(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const installedApps = await getInstalledAppsByAppId(ctx, "slack");
    const matches = installedApps.filter((installedApp) => {
      const config =
        installedApp.config &&
        typeof installedApp.config === "object" &&
        !Array.isArray(installedApp.config)
          ? (installedApp.config as { team_id?: string; channel_id?: string })
          : undefined;

      if (config?.team_id !== args.slackTeamId) {
        return false;
      }

      if (args.channelId) {
        return config?.channel_id === args.channelId;
      }

      return true;
    });

    if (args.channelId) {
      const installedApp = [...matches].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      )[0];

      return installedApp ? serializeInstalledApp(ctx, installedApp) : null;
    }

    if (matches.length !== 1) {
      return null;
    }

    return serializeInstalledApp(ctx, matches[0]!);
  },
});

export const serviceGetInstalledAppByWhatsAppNumber = query({
  args: {
    serviceKey: v.string(),
    phoneNumber: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const installedApps = await getInstalledAppsByAppId(ctx, "whatsapp");
    const installedApp = installedApps.find((candidate) => {
      const config =
        candidate.config &&
        typeof candidate.config === "object" &&
        !Array.isArray(candidate.config)
          ? (candidate.config as {
              connections?: Array<{ phoneNumber?: string }>;
            })
          : undefined;

      return config?.connections?.some(
        (connection) => connection.phoneNumber === args.phoneNumber,
      );
    });

    return installedApp ? serializeInstalledApp(ctx, installedApp) : null;
  },
});

export const serviceUpsertInstalledApp = mutation({
  args: {
    serviceKey: v.string(),
    publicAppRecordId: v.optional(v.string()),
    publicTeamId: v.string(),
    createdByUserId: v.optional(v.id("appUsers")),
    appId: v.string(),
    config: v.optional(v.any()),
    settings: v.optional(v.any()),
    createdAt: v.optional(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const [team, createdBy] = await Promise.all([
      getTeamByPublicTeamId(ctx, args.publicTeamId),
      args.createdByUserId
        ? getAppUserById(ctx, args.createdByUserId)
        : Promise.resolve(null),
    ]);

    if (!team) {
      throw new ConvexError("Team not found");
    }

    if (args.createdByUserId && !createdBy) {
      throw new ConvexError("User not found");
    }

    const existing = await ctx.db
      .query("installedApps")
      .withIndex("by_team_and_app_id", (q) =>
        q.eq("teamId", team._id).eq("appId", args.appId),
      )
      .unique();

    const timestamp = nowIso();

    if (existing) {
      await ctx.db.patch(existing._id, {
        config: args.config ?? existing.config,
        settings: args.settings ?? existing.settings,
        createdByAppUserId: existing.createdByAppUserId ?? createdBy?._id,
        updatedAt: timestamp,
      });

      const updated = await ctx.db.get(existing._id);

      if (!updated) {
        throw new ConvexError("Failed to update installed app");
      }

      return serializeInstalledApp(ctx, updated);
    }

    const installedAppId = await ctx.db.insert("installedApps", {
      publicAppRecordId: args.publicAppRecordId,
      teamId: team._id,
      createdByAppUserId: createdBy?._id,
      appId: args.appId,
      config: args.config,
      settings: args.settings,
      createdAt: args.createdAt ?? timestamp,
      updatedAt: timestamp,
    });

    const installedApp = await ctx.db.get(installedAppId);

    if (!installedApp) {
      throw new ConvexError("Failed to create installed app");
    }

    return serializeInstalledApp(ctx, installedApp);
  },
});

export const serviceDeleteInstalledApp = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    appId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return null;
    }

    const installedApp = await ctx.db
      .query("installedApps")
      .withIndex("by_team_and_app_id", (q) =>
        q.eq("teamId", team._id).eq("appId", args.appId),
      )
      .unique();

    if (!installedApp) {
      return null;
    }

    const serialized = await serializeInstalledApp(ctx, installedApp);
    await ctx.db.delete(installedApp._id);

    return serialized;
  },
});

export const serviceSetInstalledAppSettings = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    appId: v.string(),
    settings: v.any(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      throw new ConvexError("Team not found");
    }

    const installedApp = await ctx.db
      .query("installedApps")
      .withIndex("by_team_and_app_id", (q) =>
        q.eq("teamId", team._id).eq("appId", args.appId),
      )
      .unique();

    if (!installedApp) {
      throw new ConvexError("Installed app not found");
    }

    await ctx.db.patch(installedApp._id, {
      settings: args.settings,
      updatedAt: nowIso(),
    });

    const updated = await ctx.db.get(installedApp._id);

    if (!updated) {
      throw new ConvexError("Failed to update installed app settings");
    }

    return serializeInstalledApp(ctx, updated);
  },
});

export const serviceSetInstalledAppConfig = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    appId: v.string(),
    config: v.any(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      throw new ConvexError("Team not found");
    }

    const installedApp = await ctx.db
      .query("installedApps")
      .withIndex("by_team_and_app_id", (q) =>
        q.eq("teamId", team._id).eq("appId", args.appId),
      )
      .unique();

    if (!installedApp) {
      throw new ConvexError("Installed app not found");
    }

    await ctx.db.patch(installedApp._id, {
      config: args.config,
      updatedAt: nowIso(),
    });

    const updated = await ctx.db.get(installedApp._id);

    if (!updated) {
      throw new ConvexError("Failed to update installed app config");
    }

    return serializeInstalledApp(ctx, updated);
  },
});

export const serviceMergeInstalledAppConfig = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    appId: v.string(),
    configPatch: v.any(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      throw new ConvexError("Team not found");
    }

    const installedApp = await ctx.db
      .query("installedApps")
      .withIndex("by_team_and_app_id", (q) =>
        q.eq("teamId", team._id).eq("appId", args.appId),
      )
      .unique();

    if (!installedApp) {
      throw new ConvexError("Installed app not found");
    }

    const currentConfig =
      installedApp.config &&
      typeof installedApp.config === "object" &&
      !Array.isArray(installedApp.config)
        ? (installedApp.config as Record<string, unknown>)
        : {};
    const configPatch =
      args.configPatch &&
      typeof args.configPatch === "object" &&
      !Array.isArray(args.configPatch)
        ? (args.configPatch as Record<string, unknown>)
        : {};

    await ctx.db.patch(installedApp._id, {
      config: {
        ...currentConfig,
        ...configPatch,
      },
      updatedAt: nowIso(),
    });

    const updated = await ctx.db.get(installedApp._id);

    if (!updated) {
      throw new ConvexError("Failed to merge installed app config");
    }

    return serializeInstalledApp(ctx, updated);
  },
});

export const serviceAddWhatsAppConnection = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    phoneNumber: v.string(),
    displayName: v.optional(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      throw new ConvexError("Team not found");
    }

    const installedApps = await getInstalledAppsByAppId(ctx, "whatsapp");
    const existingConnection = installedApps.find((installedApp) => {
      const config =
        installedApp.config &&
        typeof installedApp.config === "object" &&
        !Array.isArray(installedApp.config)
          ? (installedApp.config as {
              connections?: Array<{ phoneNumber?: string }>;
            })
          : undefined;

      return config?.connections?.some(
        (connection) => connection.phoneNumber === args.phoneNumber,
      );
    });

    if (existingConnection) {
      if (existingConnection.teamId === team._id) {
        return serializeInstalledApp(ctx, existingConnection);
      }

      throw new ConvexError("WHATSAPP_ALREADY_CONNECTED_TO_ANOTHER_TEAM");
    }

    const existingTeamApp = await ctx.db
      .query("installedApps")
      .withIndex("by_team_and_app_id", (q) =>
        q.eq("teamId", team._id).eq("appId", "whatsapp"),
      )
      .unique();
    const newConnection = {
      phoneNumber: args.phoneNumber,
      displayName: normalizeOptionalString(args.displayName) ?? undefined,
      connectedAt: nowIso(),
    };

    if (existingTeamApp) {
      const config =
        existingTeamApp.config &&
        typeof existingTeamApp.config === "object" &&
        !Array.isArray(existingTeamApp.config)
          ? (existingTeamApp.config as {
              connections?: Array<{
                phoneNumber: string;
                displayName?: string;
                connectedAt: string;
              }>;
            })
          : {};
      const connections = config.connections ?? [];

      await ctx.db.patch(existingTeamApp._id, {
        config: {
          ...config,
          connections: [...connections, newConnection],
        },
        updatedAt: nowIso(),
      });

      const updated = await ctx.db.get(existingTeamApp._id);

      if (!updated) {
        throw new ConvexError("Failed to update WhatsApp connections");
      }

      return serializeInstalledApp(ctx, updated);
    }

    const memberships = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
      .collect();
    const timestamp = nowIso();
    const installedAppId = await ctx.db.insert("installedApps", {
      publicAppRecordId: crypto.randomUUID(),
      teamId: team._id,
      createdByAppUserId: memberships[0]?.appUserId,
      appId: "whatsapp",
      config: {
        connections: [newConnection],
      },
      settings: [
        { id: "receipts", label: "Receipt Processing", value: true },
        { id: "matches", label: "Match Notifications", value: true },
      ],
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const installedApp = await ctx.db.get(installedAppId);

    if (!installedApp) {
      throw new ConvexError("Failed to create WhatsApp app");
    }

    return serializeInstalledApp(ctx, installedApp);
  },
});

export const serviceRemoveWhatsAppConnection = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    phoneNumber: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      throw new ConvexError("Team not found");
    }

    const installedApp = await ctx.db
      .query("installedApps")
      .withIndex("by_team_and_app_id", (q) =>
        q.eq("teamId", team._id).eq("appId", "whatsapp"),
      )
      .unique();

    if (!installedApp) {
      throw new ConvexError("WhatsApp app not found for this team");
    }

    const config =
      installedApp.config &&
      typeof installedApp.config === "object" &&
      !Array.isArray(installedApp.config)
        ? (installedApp.config as {
            connections?: Array<{
              phoneNumber: string;
              displayName?: string;
              connectedAt: string;
            }>;
          })
        : {};
    const connections = config.connections ?? [];
    const updatedConnections = connections.filter(
      (connection) => connection.phoneNumber !== args.phoneNumber,
    );

    if (updatedConnections.length === 0) {
      await ctx.db.delete(installedApp._id);
      return null;
    }

    await ctx.db.patch(installedApp._id, {
      config: {
        ...config,
        connections: updatedConnections,
      },
      updatedAt: nowIso(),
    });

    const updated = await ctx.db.get(installedApp._id);

    if (!updated) {
      throw new ConvexError("Failed to update WhatsApp connections");
    }

    return serializeInstalledApp(ctx, updated);
  },
});

export const serviceGetNotificationSettings = query({
  args: {
    serviceKey: v.string(),
    userId: v.id("appUsers"),
    publicTeamId: v.string(),
    notificationType: v.optional(v.string()),
    channel: v.optional(
      v.union(v.literal("in_app"), v.literal("email"), v.literal("push")),
    ),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const [appUser, team] = await Promise.all([
      getAppUserById(ctx, args.userId),
      getTeamByPublicTeamId(ctx, args.publicTeamId),
    ]);

    if (!appUser || !team) {
      return [];
    }

    const settings = await ctx.db
      .query("notificationSettings")
      .withIndex("by_app_user_and_team", (q) =>
        q.eq("appUserId", appUser._id).eq("teamId", team._id),
      )
      .collect();

    const filtered = settings.filter((setting) => {
      if (args.notificationType && setting.notificationType !== args.notificationType) {
        return false;
      }

      if (args.channel && setting.channel !== args.channel) {
        return false;
      }

      return true;
    });

    return Promise.all(filtered.map((setting) => serializeNotificationSetting(ctx, setting)));
  },
});

export const serviceUpsertNotificationSetting = mutation({
  args: {
    serviceKey: v.string(),
    userId: v.id("appUsers"),
    publicTeamId: v.string(),
    notificationType: v.string(),
    channel: v.union(v.literal("in_app"), v.literal("email"), v.literal("push")),
    enabled: v.boolean(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);
    return upsertNotificationSettingRecord(ctx, args);
  },
});

export const serviceBulkUpsertNotificationSettings = mutation({
  args: {
    serviceKey: v.string(),
    userId: v.id("appUsers"),
    publicTeamId: v.string(),
    updates: v.array(
      v.object({
        notificationType: v.string(),
        channel: v.union(
          v.literal("in_app"),
          v.literal("email"),
          v.literal("push"),
        ),
        enabled: v.boolean(),
      }),
    ),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const results = [];

    for (const update of args.updates) {
      results.push(
        await upsertNotificationSettingRecord(ctx, {
          userId: args.userId,
          publicTeamId: args.publicTeamId,
          ...update,
        }),
      );
    }

    return results;
  },
});

export const serviceCreateActivity = mutation({
  args: {
    serviceKey: v.string(),
    publicActivityId: v.string(),
    publicTeamId: v.string(),
    userId: v.optional(v.id("appUsers")),
    type: v.string(),
    source: v.union(v.literal("system"), v.literal("user")),
    status: v.optional(
      v.union(v.literal("unread"), v.literal("read"), v.literal("archived")),
    ),
    priority: v.optional(v.number()),
    groupId: v.optional(v.string()),
    metadata: v.any(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const [team, appUser] = await Promise.all([
      getTeamByPublicTeamId(ctx, args.publicTeamId),
      args.userId ? getAppUserById(ctx, args.userId) : null,
    ]);

    if (!team) {
      throw new ConvexError("Missing team for activity");
    }

    const insertedId = await ctx.db.insert("activities", {
      publicActivityId: args.publicActivityId,
      teamId: team._id,
      appUserId: appUser?._id,
      type: args.type,
      priority: args.priority ?? 5,
      groupId: args.groupId,
      source: args.source,
      metadata: args.metadata,
      status: args.status ?? "unread",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    const inserted = await ctx.db.get(insertedId);

    if (!inserted) {
      throw new ConvexError("Failed to create activity");
    }

    return serializeActivity(ctx, inserted);
  },
});

export const serviceUpdateActivityStatus = mutation({
  args: {
    serviceKey: v.string(),
    publicActivityId: v.string(),
    publicTeamId: v.string(),
    status: v.union(v.literal("unread"), v.literal("read"), v.literal("archived")),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const [activity, team] = await Promise.all([
      getActivityByPublicActivityId(ctx, args.publicActivityId),
      getTeamByPublicTeamId(ctx, args.publicTeamId),
    ]);

    if (!activity || !team || activity.teamId !== team._id) {
      return null;
    }

    await ctx.db.patch(activity._id, {
      status: args.status,
      updatedAt: nowIso(),
    });

    const updated = await ctx.db.get(activity._id);

    return updated ? serializeActivity(ctx, updated) : null;
  },
});

export const serviceUpdateAllActivitiesStatus = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    userId: v.id("appUsers"),
    status: v.union(v.literal("unread"), v.literal("read"), v.literal("archived")),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const [team, appUser] = await Promise.all([
      getTeamByPublicTeamId(ctx, args.publicTeamId),
      getAppUserById(ctx, args.userId),
    ]);

    if (!team || !appUser) {
      return [];
    }

    const activities = await ctx.db
      .query("activities")
      .withIndex("by_app_user_id", (q) => q.eq("appUserId", appUser._id))
      .collect();

    const filtered = activities.filter((activity) => {
      if (activity.teamId !== team._id) {
        return false;
      }

      if (args.status === "archived") {
        return activity.status === "unread" || activity.status === "read";
      }

      if (args.status === "read") {
        return activity.status === "unread";
      }

      return activity.status !== args.status && activity.status !== "archived";
    });

    await Promise.all(
      filtered.map((activity) =>
        ctx.db.patch(activity._id, {
          status: args.status,
          updatedAt: nowIso(),
        }),
      ),
    );

    return Promise.all(filtered.map((activity) => serializeActivity(ctx, {
      ...activity,
      status: args.status,
    } as Doc<"activities">)));
  },
});

export const serviceGetActivities = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    cursor: v.optional(v.string()),
    pageSize: v.optional(v.number()),
    statuses: v.optional(
      v.array(v.union(v.literal("unread"), v.literal("read"), v.literal("archived"))),
    ),
    userId: v.optional(v.id("appUsers")),
    priority: v.optional(v.number()),
    maxPriority: v.optional(v.number()),
    createdAfter: v.optional(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const [team, appUser] = await Promise.all([
      getTeamByPublicTeamId(ctx, args.publicTeamId),
      args.userId ? getAppUserById(ctx, args.userId) : null,
    ]);

    if (!team) {
      return {
        meta: {
          cursor: null,
          hasPreviousPage: false,
          hasNextPage: false,
        },
        data: [],
      };
    }

    const baseActivities = appUser
      ? await ctx.db
          .query("activities")
          .withIndex("by_app_user_id", (q) => q.eq("appUserId", appUser._id))
          .collect()
      : await ctx.db
          .query("activities")
          .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
          .collect();

    const filtered = baseActivities
      .filter((activity) => {
        if (activity.teamId !== team._id) {
          return false;
        }

        if (args.statuses && !args.statuses.includes(activity.status as "unread" | "read" | "archived")) {
          return false;
        }

        if (args.priority !== undefined && activity.priority !== args.priority) {
          return false;
        }

        if (
          args.maxPriority !== undefined &&
          (activity.priority ?? 5) > args.maxPriority
        ) {
          return false;
        }

        if (args.createdAfter && activity.createdAt < args.createdAfter) {
          return false;
        }

        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const offset = args.cursor ? Number.parseInt(args.cursor, 10) : 0;
    const pageSize = args.pageSize ?? 20;
    const page = filtered.slice(offset, offset + pageSize);
    const nextCursor =
      page.length === pageSize ? String(offset + pageSize) : null;

    return {
      meta: {
        cursor: nextCursor,
        hasPreviousPage: offset > 0,
        hasNextPage: page.length === pageSize,
      },
      data: await Promise.all(page.map((activity) => serializeActivity(ctx, activity))),
    };
  },
});

export const serviceFindRecentActivity = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    userId: v.optional(v.id("appUsers")),
    type: v.string(),
    timeWindowMinutes: v.optional(v.number()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const [team, appUser] = await Promise.all([
      getTeamByPublicTeamId(ctx, args.publicTeamId),
      args.userId ? getAppUserById(ctx, args.userId) : null,
    ]);

    if (!team) {
      return null;
    }

    const activities = appUser
      ? await ctx.db
          .query("activities")
          .withIndex("by_app_user_id", (q) => q.eq("appUserId", appUser._id))
          .collect()
      : await ctx.db
          .query("activities")
          .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
          .collect();

    const timeWindowAgo = new Date(
      Date.now() - (args.timeWindowMinutes ?? 5) * 60 * 1000,
    ).toISOString();

    const latest = activities
      .filter(
        (activity) =>
          activity.teamId === team._id &&
          activity.type === args.type &&
          activity.status === "unread" &&
          activity.createdAt >= timeWindowAgo,
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

    return latest ? serializeActivity(ctx, latest) : null;
  },
});

export const serviceUpdateActivityMetadata = mutation({
  args: {
    serviceKey: v.string(),
    publicActivityId: v.string(),
    publicTeamId: v.string(),
    metadata: v.any(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const [activity, team] = await Promise.all([
      getActivityByPublicActivityId(ctx, args.publicActivityId),
      getTeamByPublicTeamId(ctx, args.publicTeamId),
    ]);

    if (!activity || !team || activity.teamId !== team._id) {
      return null;
    }

    const timestamp = nowIso();
    await ctx.db.patch(activity._id, {
      metadata: args.metadata,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const updated = await ctx.db.get(activity._id);

    return updated ? serializeActivity(ctx, updated) : null;
  },
});

export const serviceRevokeAccessTokenByHash = mutation({
  args: {
    serviceKey: v.string(),
    tokenHash: v.string(),
    publicApplicationId: v.optional(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const token = await getOAuthAccessTokenByTokenHash(ctx, args.tokenHash);

    if (!token || token.revoked) {
      return null;
    }

    if (args.publicApplicationId) {
      const application = await ctx.db.get(token.applicationId);

      if (!application || application.publicApplicationId !== args.publicApplicationId) {
        return null;
      }
    }

    await ctx.db.patch(token._id, {
      revoked: true,
      revokedAt: nowIso(),
      updatedAt: nowIso(),
    });

    return {
      id: publicId(token.publicAccessTokenId, token._id),
      token: token.token,
    };
  },
});

export const getOAuthApplicationByClientIdInternal = internalQuery({
  args: {
    clientId: v.string(),
  },
  async handler(ctx, args) {
    const application = await getOAuthApplicationByClientId(ctx, args.clientId);

    if (!application) {
      return null;
    }

    const team = await ctx.db.get(application.teamId);

    return {
      _id: application._id,
      publicApplicationId: application.publicApplicationId ?? null,
      name: application.name,
      slug: application.slug,
      description: application.description ?? null,
      overview: application.overview ?? null,
      developerName: application.developerName ?? null,
      logoUrl: application.logoUrl ?? null,
      website: application.website ?? null,
      installUrl: application.installUrl ?? null,
      screenshots: application.screenshots,
      redirectUris: application.redirectUris,
      clientId: application.clientId,
      clientSecret: application.clientSecret,
      scopes: application.scopes,
      publicTeamId: team?.publicTeamId ?? null,
      createdByAppUserId: application.createdByAppUserId,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
      isPublic: application.isPublic,
      active: application.active,
      status: application.status,
    };
  },
});

export const getOAuthAuthorizationCodeByCodeInternal = internalQuery({
  args: {
    code: v.string(),
  },
  async handler(ctx, args) {
    const authCode = await getOAuthAuthorizationCodeByCode(ctx, args.code);

    if (!authCode) {
      return null;
    }

    const [application, appUser, team] = await Promise.all([
      ctx.db.get(authCode.applicationId),
      ctx.db.get(authCode.appUserId),
      ctx.db.get(authCode.teamId),
    ]);

    if (!application || !appUser || !team) {
      return null;
    }

    return {
      _id: authCode._id,
      publicAuthorizationCodeId: authCode.publicAuthorizationCodeId ?? null,
      applicationId: authCode.applicationId,
      publicApplicationId: application.publicApplicationId ?? null,
      appUserId: authCode.appUserId,
      teamId: authCode.teamId,
      publicTeamId: team.publicTeamId ?? null,
      code: authCode.code,
      scopes: authCode.scopes,
      redirectUri: authCode.redirectUri,
      expiresAt: authCode.expiresAt,
      createdAt: authCode.createdAt,
      used: authCode.used,
      codeChallenge: authCode.codeChallenge ?? null,
    };
  },
});

export const getOAuthAccessTokenByRefreshTokenHashInternal = internalQuery({
  args: {
    refreshTokenHash: v.string(),
  },
  async handler(ctx, args) {
    const token = await getOAuthAccessTokenByRefreshTokenHash(
      ctx,
      args.refreshTokenHash,
    );

    if (!token) {
      return null;
    }

    const [application, appUser, team] = await Promise.all([
      ctx.db.get(token.applicationId),
      ctx.db.get(token.appUserId),
      ctx.db.get(token.teamId),
    ]);

    if (!application || !appUser || !team) {
      return null;
    }

    return {
      _id: token._id,
      publicAccessTokenId: token.publicAccessTokenId ?? null,
      applicationId: token.applicationId,
      publicApplicationId: application.publicApplicationId ?? null,
      appUserId: token.appUserId,
      teamId: token.teamId,
      publicTeamId: team.publicTeamId ?? null,
      scopes: token.scopes,
      refreshTokenExpiresAt: token.refreshTokenExpiresAt ?? null,
      revoked: token.revoked,
      createdAt: token.createdAt,
    };
  },
});

export const createApiKeyInternal = internalMutation({
  args: {
    publicApiKeyId: v.string(),
    userId: v.id("appUsers"),
    publicTeamId: v.string(),
    name: v.string(),
    keyEncrypted: v.string(),
    keyHash: v.string(),
    scopes: v.array(v.string()),
  },
  async handler(ctx, args) {
    const [appUser, team] = await Promise.all([
      getAppUserById(ctx, args.userId),
      getTeamByPublicTeamId(ctx, args.publicTeamId),
    ]);

    if (!appUser || !team) {
      throw new ConvexError("Missing team or user for API key");
    }

    const timestamp = nowIso();
    const apiKeyId = await ctx.db.insert("apiKeys", {
      publicApiKeyId: args.publicApiKeyId,
      name: args.name,
      keyEncrypted: args.keyEncrypted,
      keyHash: args.keyHash,
      scopes: args.scopes,
      teamId: team._id,
      appUserId: appUser._id,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const apiKey = await ctx.db.get(apiKeyId);

    if (!apiKey) {
      throw new ConvexError("Failed to create API key");
    }

    return serializeApiKey(ctx, apiKey);
  },
});

export const updateApiKeyInternal = internalMutation({
  args: {
    publicApiKeyId: v.string(),
    publicTeamId: v.string(),
    name: v.string(),
    scopes: v.array(v.string()),
  },
  async handler(ctx, args) {
    const [apiKey, team] = await Promise.all([
      getApiKeyByPublicApiKeyId(ctx, args.publicApiKeyId),
      getTeamByPublicTeamId(ctx, args.publicTeamId),
    ]);

    if (!apiKey || !team || apiKey.teamId !== team._id) {
      throw new ConvexError("API key not found");
    }

    await ctx.db.patch(apiKey._id, {
      name: args.name,
      scopes: args.scopes,
      updatedAt: nowIso(),
    });

    return null;
  },
});

export const createOAuthApplicationInternal = internalMutation({
  args: {
    publicApplicationId: v.string(),
    publicTeamId: v.string(),
    createdByUserId: v.id("appUsers"),
    name: v.string(),
    description: v.optional(v.string()),
    overview: v.optional(v.string()),
    developerName: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    website: v.optional(v.string()),
    installUrl: v.optional(v.string()),
    screenshots: v.array(v.string()),
    redirectUris: v.array(v.string()),
    clientId: v.string(),
    clientSecret: v.string(),
    scopes: v.array(v.string()),
    isPublic: v.boolean(),
    active: v.boolean(),
    status: v.union(
      v.literal("draft"),
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
  },
  async handler(ctx, args) {
    const [team, createdByUser] = await Promise.all([
      getTeamByPublicTeamId(ctx, args.publicTeamId),
      getAppUserById(ctx, args.createdByUserId),
    ]);

    if (!team || !createdByUser) {
      throw new ConvexError("Missing team or user for OAuth application");
    }

    const timestamp = nowIso();
    const applicationId = await ctx.db.insert("oauthApplications", {
      publicApplicationId: args.publicApplicationId,
      name: args.name,
      slug: await findUniqueSlug(ctx, args.name),
      description: args.description,
      overview: args.overview,
      developerName: args.developerName,
      logoUrl: args.logoUrl,
      website: args.website,
      installUrl: args.installUrl,
      screenshots: args.screenshots,
      redirectUris: args.redirectUris,
      clientId: args.clientId,
      clientSecret: args.clientSecret,
      scopes: args.scopes,
      teamId: team._id,
      createdByAppUserId: createdByUser._id,
      createdAt: timestamp,
      updatedAt: timestamp,
      isPublic: args.isPublic,
      active: args.active,
      status: args.status,
    });

    const application = await ctx.db.get(applicationId);

    if (!application) {
      throw new ConvexError("Failed to create OAuth application");
    }

    return serializeOAuthApplication(ctx, application);
  },
});

export const regenerateOAuthClientSecretInternal = internalMutation({
  args: {
    publicApplicationId: v.string(),
    publicTeamId: v.string(),
    clientSecret: v.string(),
  },
  async handler(ctx, args) {
    const [application, team] = await Promise.all([
      getOAuthApplicationByPublicApplicationId(ctx, args.publicApplicationId),
      getTeamByPublicTeamId(ctx, args.publicTeamId),
    ]);

    if (!application || !team || application.teamId !== team._id) {
      throw new ConvexError("OAuth application not found");
    }

    await ctx.db.patch(application._id, {
      clientSecret: args.clientSecret,
      updatedAt: nowIso(),
    });

    return {
      id: args.publicApplicationId,
      clientId: application.clientId,
    };
  },
});

export const createOAuthAuthorizationCodeInternal = internalMutation({
  args: {
    publicAuthorizationCodeId: v.string(),
    publicApplicationId: v.string(),
    userId: v.id("appUsers"),
    publicTeamId: v.string(),
    code: v.string(),
    scopes: v.array(v.string()),
    redirectUri: v.string(),
    expiresAt: v.string(),
    codeChallenge: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const [application, appUser, team] = await Promise.all([
      getOAuthApplicationByPublicApplicationId(ctx, args.publicApplicationId),
      getAppUserById(ctx, args.userId),
      getTeamByPublicTeamId(ctx, args.publicTeamId),
    ]);

    if (!application || !appUser || !team) {
      throw new ConvexError("Missing OAuth authorization code dependencies");
    }

    const timestamp = nowIso();
    const authorizationCodeId = await ctx.db.insert("oauthAuthorizationCodes", {
      publicAuthorizationCodeId: args.publicAuthorizationCodeId,
      applicationId: application._id,
      appUserId: appUser._id,
      teamId: team._id,
      code: args.code,
      scopes: args.scopes,
      redirectUri: args.redirectUri,
      expiresAt: args.expiresAt,
      createdAt: timestamp,
      used: false,
      codeChallenge: args.codeChallenge,
      codeChallengeMethod: args.codeChallenge ? "S256" : undefined,
      updatedAt: timestamp,
    });

    const authorizationCode = await ctx.db.get(authorizationCodeId);

    if (!authorizationCode) {
      throw new ConvexError("Failed to create OAuth authorization code");
    }

    return {
      id: publicId(
        authorizationCode.publicAuthorizationCodeId,
        authorizationCode._id,
      ),
      code: authorizationCode.code,
      expiresAt: authorizationCode.expiresAt,
    };
  },
});

export const markOAuthAuthorizationCodeUsedInternal = internalMutation({
  args: {
    code: v.string(),
  },
  async handler(ctx, args) {
    const authCode = await getOAuthAuthorizationCodeByCode(ctx, args.code);

    if (!authCode) {
      throw new ConvexError("Authorization code not found");
    }

    await ctx.db.patch(authCode._id, {
      used: true,
      updatedAt: nowIso(),
    });

    return true;
  },
});

export const createOAuthAccessTokenInternal = internalMutation({
  args: {
    publicAccessTokenId: v.string(),
    publicApplicationId: v.string(),
    userId: v.id("appUsers"),
    publicTeamId: v.string(),
    token: v.string(),
    refreshToken: v.optional(v.string()),
    scopes: v.array(v.string()),
    expiresAt: v.string(),
    refreshTokenExpiresAt: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const [application, appUser, team] = await Promise.all([
      getOAuthApplicationByPublicApplicationId(ctx, args.publicApplicationId),
      getAppUserById(ctx, args.userId),
      getTeamByPublicTeamId(ctx, args.publicTeamId),
    ]);

    if (!application || !appUser || !team) {
      throw new ConvexError("Missing OAuth access token dependencies");
    }

    const timestamp = nowIso();
    await ctx.db.insert("oauthAccessTokens", {
      publicAccessTokenId: args.publicAccessTokenId,
      applicationId: application._id,
      appUserId: appUser._id,
      teamId: team._id,
      token: args.token,
      refreshToken: args.refreshToken,
      scopes: args.scopes,
      expiresAt: args.expiresAt,
      refreshTokenExpiresAt: args.refreshTokenExpiresAt,
      createdAt: timestamp,
      revoked: false,
      updatedAt: timestamp,
    });

    return true;
  },
});

export const revokeOAuthAccessTokenByIdInternal = internalMutation({
  args: {
    id: v.id("oauthAccessTokens"),
  },
  async handler(ctx, args) {
    await ctx.db.patch(args.id, {
      revoked: true,
      revokedAt: nowIso(),
      updatedAt: nowIso(),
    });

    return true;
  },
});

export const revokeOAuthTokensByAuthorizationWindowInternal = internalMutation({
  args: {
    applicationId: v.id("oauthApplications"),
    appUserId: v.id("appUsers"),
    teamId: v.id("teams"),
    createdAt: v.optional(v.string()),
  },
  async handler(ctx, args) {
    const authCodeTime = args.createdAt ? new Date(args.createdAt) : new Date();
    const windowStart = new Date(authCodeTime.getTime() - 10 * 60 * 1000).toISOString();
    const windowEnd = new Date(authCodeTime.getTime() + 10 * 60 * 1000).toISOString();
    const tokens = await ctx.db
      .query("oauthAccessTokens")
      .withIndex("by_app_user_id", (q) => q.eq("appUserId", args.appUserId))
      .collect();
    const timestamp = nowIso();
    const related = tokens.filter(
      (token) =>
        token.applicationId === args.applicationId &&
        token.teamId === args.teamId &&
        !token.revoked &&
        token.createdAt >= windowStart &&
        token.createdAt <= windowEnd,
    );

    await Promise.all(
      related.map((token) =>
        ctx.db.patch(token._id, {
          revoked: true,
          revokedAt: timestamp,
          updatedAt: timestamp,
        }),
      ),
    );

    return related.length;
  },
});
