import { ConvexError, v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { normalizeOptionalString } from "../../packages/domain/src/identity";
import { requireServiceKey } from "./lib/service";

const internalApi: any = internal;

function randomToken(prefix: string, bytes = 16) {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);

  return `${prefix}${Array.from(buffer, (value) => value.toString(16).padStart(2, "0")).join("")}`;
}

async function sha256Hex(value: string) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));

  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function toPkceChallenge(verifier: string) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));

  return toBase64Url(new Uint8Array(buffer));
}

export const serviceCreateApiKey = action({
  args: {
    serviceKey: v.string(),
    userId: v.id("appUsers"),
    publicTeamId: v.string(),
    name: v.string(),
    scopes: v.array(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const key = randomToken("mid_", 24);
    const keyHash = await sha256Hex(key);
    const data = await ctx.runMutation(internalApi.foundation.createApiKeyInternal, {
      publicApiKeyId: crypto.randomUUID(),
      userId: args.userId,
      publicTeamId: args.publicTeamId,
      name: args.name,
      keyEncrypted: keyHash,
      keyHash,
      scopes: args.scopes,
    });

    return {
      key,
      data,
    };
  },
});

export const serviceUpdateApiKey = action({
  args: {
    serviceKey: v.string(),
    publicApiKeyId: v.string(),
    publicTeamId: v.string(),
    name: v.string(),
    scopes: v.array(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    await ctx.runMutation(internalApi.foundation.updateApiKeyInternal, {
      publicApiKeyId: args.publicApiKeyId,
      publicTeamId: args.publicTeamId,
      name: args.name,
      scopes: args.scopes,
    });

    return {
      key: null,
      data: null,
    };
  },
});

export const serviceCreateOAuthApplication = action({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    createdByUserId: v.id("appUsers"),
    name: v.string(),
    description: v.optional(v.union(v.string(), v.null())),
    overview: v.optional(v.union(v.string(), v.null())),
    developerName: v.optional(v.union(v.string(), v.null())),
    logoUrl: v.optional(v.union(v.string(), v.null())),
    website: v.optional(v.union(v.string(), v.null())),
    installUrl: v.optional(v.union(v.string(), v.null())),
    screenshots: v.optional(v.array(v.string())),
    redirectUris: v.array(v.string()),
    scopes: v.array(v.string()),
    isPublic: v.boolean(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const clientId = randomToken("mid_client_", 12);
    const clientSecret = randomToken("mid_app_secret_", 16);
    const application = await ctx.runMutation(
      internalApi.foundation.createOAuthApplicationInternal,
      {
        publicApplicationId: crypto.randomUUID(),
        publicTeamId: args.publicTeamId,
        createdByUserId: args.createdByUserId,
        name: args.name,
        description: normalizeOptionalString(args.description) ?? undefined,
        overview: normalizeOptionalString(args.overview) ?? undefined,
        developerName: normalizeOptionalString(args.developerName) ?? undefined,
        logoUrl: normalizeOptionalString(args.logoUrl) ?? undefined,
        website: normalizeOptionalString(args.website) ?? undefined,
        installUrl: normalizeOptionalString(args.installUrl) ?? undefined,
        screenshots: args.screenshots?.filter(Boolean) ?? [],
        redirectUris: args.redirectUris.filter(Boolean),
        clientId,
        clientSecret: await sha256Hex(clientSecret),
        scopes: args.scopes.filter(Boolean),
        isPublic: args.isPublic,
        active: true,
        status: "draft",
      },
    );

    return {
      ...application,
      clientSecret,
    };
  },
});

export const serviceRegenerateOAuthClientSecret = action({
  args: {
    serviceKey: v.string(),
    publicApplicationId: v.string(),
    publicTeamId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const clientSecret = randomToken("mid_app_secret_", 16);
    const result = await ctx.runMutation(
      internalApi.foundation.regenerateOAuthClientSecretInternal,
      {
        publicApplicationId: args.publicApplicationId,
        publicTeamId: args.publicTeamId,
        clientSecret: await sha256Hex(clientSecret),
      },
    );

    return {
      ...result,
      clientSecret,
    };
  },
});

export const serviceCreateAuthorizationCode = action({
  args: {
    serviceKey: v.string(),
    publicApplicationId: v.string(),
    userId: v.id("appUsers"),
    publicTeamId: v.string(),
    scopes: v.array(v.string()),
    redirectUri: v.string(),
    codeChallenge: v.optional(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    return ctx.runMutation(internalApi.foundation.createOAuthAuthorizationCodeInternal, {
      publicAuthorizationCodeId: crypto.randomUUID(),
      publicApplicationId: args.publicApplicationId,
      userId: args.userId,
      publicTeamId: args.publicTeamId,
      code: randomToken("mid_authorization_code_", 16),
      scopes: args.scopes,
      redirectUri: args.redirectUri,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      codeChallenge: args.codeChallenge,
    });
  },
});

export const serviceExchangeAuthorizationCode = action({
  args: {
    serviceKey: v.string(),
    code: v.string(),
    redirectUri: v.string(),
    publicApplicationId: v.string(),
    codeVerifier: v.optional(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const authCode = await ctx.runQuery(
      internalApi.foundation.getOAuthAuthorizationCodeByCodeInternal,
      {
        code: args.code,
      },
    );

    if (!authCode) {
      throw new ConvexError("Invalid authorization code");
    }

    if (authCode.publicApplicationId !== args.publicApplicationId) {
      throw new ConvexError("Authorization code does not belong to this application");
    }

    if (authCode.used) {
      await ctx.runMutation(internalApi.foundation.revokeOAuthTokensByAuthorizationWindowInternal, {
        applicationId: authCode.applicationId,
        appUserId: authCode.appUserId,
        teamId: authCode.teamId,
        createdAt: authCode.createdAt,
      });

      throw new ConvexError(
        "Authorization code already used - all related tokens have been revoked for security",
      );
    }

    if (new Date() > new Date(authCode.expiresAt)) {
      throw new ConvexError("Authorization code expired");
    }

    if (authCode.redirectUri !== args.redirectUri) {
      throw new ConvexError("Invalid redirect URI");
    }

    if (authCode.codeChallenge) {
      if (!args.codeVerifier) {
        throw new ConvexError("Code verifier is required when code challenge is present");
      }

      if ((await toPkceChallenge(args.codeVerifier)) !== authCode.codeChallenge) {
        throw new ConvexError("Invalid code verifier");
      }
    }

    await ctx.runMutation(internalApi.foundation.markOAuthAuthorizationCodeUsedInternal, {
      code: args.code,
    });

    const accessToken = randomToken("mid_access_token_", 16);
    const refreshToken = randomToken("mid_refresh_token_", 16);
    const expiresIn = 7200;
    const refreshTokenExpiresIn = 86400 * 30;

    await ctx.runMutation(internalApi.foundation.createOAuthAccessTokenInternal, {
      publicAccessTokenId: crypto.randomUUID(),
      publicApplicationId: authCode.publicApplicationId!,
      userId: authCode.appUserId,
      publicTeamId: authCode.publicTeamId!,
      token: await sha256Hex(accessToken),
      refreshToken: await sha256Hex(refreshToken),
      scopes: authCode.scopes,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      refreshTokenExpiresAt: new Date(Date.now() + refreshTokenExpiresIn * 1000).toISOString(),
    });

    return {
      accessToken,
      refreshToken,
      expiresIn,
      refreshTokenExpiresIn,
      scopes: authCode.scopes,
      tokenType: "Bearer" as const,
    };
  },
});

export const serviceRefreshAccessToken = action({
  args: {
    serviceKey: v.string(),
    refreshTokenHash: v.string(),
    publicApplicationId: v.string(),
    scopes: v.optional(v.array(v.string())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const existingToken = await ctx.runQuery(
      internalApi.foundation.getOAuthAccessTokenByRefreshTokenHashInternal,
      {
        refreshTokenHash: args.refreshTokenHash,
      },
    );

    if (!existingToken) {
      throw new ConvexError("Invalid refresh token");
    }

    if (existingToken.publicApplicationId !== args.publicApplicationId) {
      throw new ConvexError("Invalid refresh token");
    }

    if (existingToken.revoked) {
      throw new ConvexError("Refresh token revoked");
    }

    if (
      existingToken.refreshTokenExpiresAt &&
      new Date() > new Date(existingToken.refreshTokenExpiresAt)
    ) {
      throw new ConvexError("Refresh token expired");
    }

    let scopes = existingToken.scopes;

    if (args.scopes && args.scopes.length > 0) {
      const granted = new Set(existingToken.scopes);

      for (const scope of args.scopes) {
        if (!granted.has(scope)) {
          throw new ConvexError(`Requested scope '${scope}' is not authorized for this token`);
        }
      }

      scopes = args.scopes;
    }

    await ctx.runMutation(internalApi.foundation.revokeOAuthAccessTokenByIdInternal, {
      id: existingToken._id,
    });

    const accessToken = randomToken("mid_access_token_", 16);
    const refreshToken = randomToken("mid_refresh_token_", 16);
    const expiresIn = 7200;
    const refreshTokenExpiresIn = 86400 * 30;

    await ctx.runMutation(internalApi.foundation.createOAuthAccessTokenInternal, {
      publicAccessTokenId: crypto.randomUUID(),
      publicApplicationId: existingToken.publicApplicationId!,
      userId: existingToken.appUserId,
      publicTeamId: existingToken.publicTeamId!,
      token: await sha256Hex(accessToken),
      refreshToken: await sha256Hex(refreshToken),
      scopes,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      refreshTokenExpiresAt: new Date(Date.now() + refreshTokenExpiresIn * 1000).toISOString(),
    });

    return {
      accessToken,
      refreshToken,
      expiresIn,
      refreshTokenExpiresIn,
      scopes,
      tokenType: "Bearer" as const,
    };
  },
});
