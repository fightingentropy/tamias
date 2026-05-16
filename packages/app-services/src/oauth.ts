import { hash } from "@tamias/encryption";
import {
  createDatabase,
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "@tamias/app-data/client";

type OAuthApplicationStatus = "draft" | "pending" | "approved" | "rejected";

type OAuthApplicationRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  overview: string | null;
  developer_name: string | null;
  logo_url: string | null;
  website: string | null;
  install_url: string | null;
  screenshots_json: string;
  redirect_uris_json: string;
  client_id: string;
  client_secret_hash: string;
  scopes_json: string;
  team_id: string;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  is_public: number;
  active: number;
  status: OAuthApplicationStatus;
  created_by_full_name: string | null;
  created_by_avatar_url: string | null;
};

type OAuthAuthorizationCodeRow = {
  id: string;
  application_id: string;
  user_id: string;
  team_id: string;
  code_hash: string;
  scopes_json: string;
  redirect_uri: string;
  expires_at: string;
  created_at: string;
  used: number;
  used_at: string | null;
  code_challenge: string | null;
  code_challenge_method: string | null;
  updated_at: string;
  public_application_id: string | null;
};

type OAuthAccessTokenRow = {
  id: string;
  application_id: string;
  user_id: string;
  team_id: string;
  authorization_code_id: string | null;
  token_hash: string;
  refresh_token_hash: string | null;
  scopes_json: string;
  expires_at: string;
  refresh_token_expires_at: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked: number;
  revoked_at: string | null;
  updated_at: string;
  application_name: string | null;
  application_description: string | null;
  application_overview: string | null;
  application_developer_name: string | null;
  application_logo_url: string | null;
  application_website: string | null;
  application_install_url: string | null;
  application_screenshots_json: string | null;
  application_client_id: string | null;
  application_active: number | null;
  user_email: string | null;
  user_full_name: string | null;
  user_avatar_url: string | null;
};

function getOAuthD1(db: Database = createDatabase()) {
  return requireCloudflareD1Database(db);
}

function nowIso() {
  return new Date().toISOString();
}

function randomToken(prefix: string, bytes = 16) {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);

  return `${prefix}${Array.from(buffer, (value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function normalizeOptionalString(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeStringArray(value: string[] | undefined) {
  return value?.map((entry) => entry.trim()).filter(Boolean) ?? [];
}

function parseStringArray(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "application"
  );
}

async function findUniqueSlug(
  d1: CloudflareD1DatabaseBinding,
  name: string,
  excludeApplicationId?: string,
) {
  const base = slugify(name);
  let candidate = base;
  let suffix = 1;

  for (;;) {
    const existing = excludeApplicationId
      ? await d1
          .prepare("select id from oauth_applications where slug = ? and id != ? limit 1")
          .bind(candidate, excludeApplicationId)
          .first<{ id: string }>()
      : await d1
          .prepare("select id from oauth_applications where slug = ? limit 1")
          .bind(candidate)
          .first<{ id: string }>();

    if (!existing) {
      return candidate;
    }

    candidate = `${base}-${suffix++}`;
  }
}

function serializeOAuthApplication(row: OAuthApplicationRow) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    overview: row.overview,
    developerName: row.developer_name,
    logoUrl: row.logo_url,
    website: row.website,
    installUrl: row.install_url,
    screenshots: parseStringArray(row.screenshots_json),
    redirectUris: parseStringArray(row.redirect_uris_json),
    clientId: row.client_id,
    clientSecret: row.client_secret_hash,
    scopes: parseStringArray(row.scopes_json),
    teamId: row.team_id,
    createdBy: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isPublic: row.is_public === 1,
    active: row.active === 1,
    status: row.status,
    createdByUser: {
      id: row.created_by_user_id,
      fullName: row.created_by_full_name,
      avatarUrl: row.created_by_avatar_url,
    },
  };
}

function applicationSelect(where: string) {
  return `
    select
      oauth_applications.*,
      users.full_name as created_by_full_name,
      users.avatar_url as created_by_avatar_url
    from oauth_applications
    left join users on users.id = oauth_applications.created_by_user_id
    ${where}
  `;
}

async function getApplicationRowById(d1: CloudflareD1DatabaseBinding, id: string) {
  return d1
    .prepare(`${applicationSelect("where oauth_applications.id = ?")} limit 1`)
    .bind(id)
    .first<OAuthApplicationRow>();
}

async function teamExists(d1: CloudflareD1DatabaseBinding, teamId: string) {
  return d1
    .prepare("select id from teams where id = ? limit 1")
    .bind(teamId)
    .first<{ id: string }>();
}

async function userExists(d1: CloudflareD1DatabaseBinding, userId: string) {
  return d1
    .prepare("select id from users where id = ? limit 1")
    .bind(userId)
    .first<{ id: string }>();
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

function tokenSelect(where: string) {
  return `
    select
      oauth_access_tokens.*,
      oauth_applications.name as application_name,
      oauth_applications.description as application_description,
      oauth_applications.overview as application_overview,
      oauth_applications.developer_name as application_developer_name,
      oauth_applications.logo_url as application_logo_url,
      oauth_applications.website as application_website,
      oauth_applications.install_url as application_install_url,
      oauth_applications.screenshots_json as application_screenshots_json,
      oauth_applications.client_id as application_client_id,
      oauth_applications.active as application_active,
      users.email as user_email,
      users.full_name as user_full_name,
      users.avatar_url as user_avatar_url
    from oauth_access_tokens
    join oauth_applications on oauth_applications.id = oauth_access_tokens.application_id
    left join users on users.id = oauth_access_tokens.user_id
    ${where}
  `;
}

async function insertAccessToken(
  d1: CloudflareD1DatabaseBinding,
  args: {
    applicationId: string;
    userId: string;
    teamId: string;
    authorizationCodeId?: string | null;
    tokenHash: string;
    refreshTokenHash: string;
    scopes: string[];
    expiresAt: string;
    refreshTokenExpiresAt: string;
  },
) {
  const timestamp = nowIso();
  const id = crypto.randomUUID();

  await d1
    .prepare(
      `insert into oauth_access_tokens (
        id,
        application_id,
        user_id,
        team_id,
        authorization_code_id,
        token_hash,
        refresh_token_hash,
        scopes_json,
        expires_at,
        refresh_token_expires_at,
        created_at,
        last_used_at,
        revoked,
        revoked_at,
        updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, null, 0, null, ?)`,
    )
    .bind(
      id,
      args.applicationId,
      args.userId,
      args.teamId,
      args.authorizationCodeId ?? null,
      args.tokenHash,
      args.refreshTokenHash,
      JSON.stringify(args.scopes),
      args.expiresAt,
      args.refreshTokenExpiresAt,
      timestamp,
      timestamp,
    )
    .run();

  return id;
}

function serializeAuthorizedApplication(row: OAuthAccessTokenRow) {
  if (row.application_active !== 1) {
    return null;
  }

  return {
    id: row.application_id,
    name: row.application_name ?? "",
    description: row.application_description,
    overview: row.application_overview,
    developerName: row.application_developer_name,
    logoUrl: row.application_logo_url,
    website: row.application_website,
    installUrl: row.application_install_url,
    screenshots: row.application_screenshots_json
      ? parseStringArray(row.application_screenshots_json)
      : [],
    scopes: parseStringArray(row.scopes_json),
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    refreshTokenExpiresAt: row.refresh_token_expires_at,
  };
}

export async function getOAuthApplicationByClientIdFromD1(clientId: string, db?: Database) {
  const row = await getOAuthD1(db)
    .prepare(`${applicationSelect("where oauth_applications.client_id = ?")} limit 1`)
    .bind(clientId)
    .first<OAuthApplicationRow>();

  return row ? serializeOAuthApplication(row) : null;
}

export async function getOAuthApplicationByIdFromD1(
  args: { publicApplicationId: string; publicTeamId?: string },
  db?: Database,
) {
  const row = await getApplicationRowById(getOAuthD1(db), args.publicApplicationId);

  if (!row) {
    return null;
  }

  if (args.publicTeamId && row.team_id !== args.publicTeamId) {
    return null;
  }

  return serializeOAuthApplication(row);
}

export async function getOAuthApplicationsByTeamFromD1(publicTeamId: string, db?: Database) {
  const { results = [] } = await getOAuthD1(db)
    .prepare(
      `${applicationSelect("where oauth_applications.team_id = ?")} order by created_at desc`,
    )
    .bind(publicTeamId)
    .all<OAuthApplicationRow>();

  return results.map(serializeOAuthApplication);
}

export async function createOAuthApplicationInD1(args: {
  db?: Database;
  publicTeamId: string;
  createdByUserId: string;
  name: string;
  description?: string;
  overview?: string;
  developerName?: string;
  logoUrl?: string;
  website?: string;
  installUrl?: string;
  screenshots?: string[];
  redirectUris: string[];
  scopes: string[];
  isPublic: boolean;
}) {
  const d1 = getOAuthD1(args.db);
  const [team, user] = await Promise.all([
    teamExists(d1, args.publicTeamId),
    userExists(d1, args.createdByUserId),
  ]);

  if (!team || !user) {
    throw new Error("Missing team or user for OAuth application");
  }

  const clientId = randomToken("mid_client_", 12);
  const clientSecret = randomToken("mid_app_secret_", 16);
  const timestamp = nowIso();
  const publicApplicationId = crypto.randomUUID();

  await d1
    .prepare(
      `insert into oauth_applications (
        id,
        name,
        slug,
        description,
        overview,
        developer_name,
        logo_url,
        website,
        install_url,
        screenshots_json,
        redirect_uris_json,
        client_id,
        client_secret_hash,
        scopes_json,
        team_id,
        created_by_user_id,
        created_at,
        updated_at,
        is_public,
        active,
        status
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'draft')`,
    )
    .bind(
      publicApplicationId,
      args.name,
      await findUniqueSlug(d1, args.name),
      normalizeOptionalString(args.description),
      normalizeOptionalString(args.overview),
      normalizeOptionalString(args.developerName),
      normalizeOptionalString(args.logoUrl),
      normalizeOptionalString(args.website),
      normalizeOptionalString(args.installUrl),
      JSON.stringify(normalizeStringArray(args.screenshots)),
      JSON.stringify(normalizeStringArray(args.redirectUris)),
      clientId,
      hash(clientSecret),
      JSON.stringify(normalizeStringArray(args.scopes)),
      args.publicTeamId,
      args.createdByUserId,
      timestamp,
      timestamp,
      args.isPublic ? 1 : 0,
    )
    .run();

  const created = await getApplicationRowById(d1, publicApplicationId);

  if (!created) {
    throw new Error("Failed to create OAuth application");
  }

  return {
    ...serializeOAuthApplication(created),
    clientSecret,
  };
}

export async function updateOAuthApplicationInD1(args: {
  db?: Database;
  publicApplicationId: string;
  publicTeamId: string;
  name?: string;
  description?: string | null;
  overview?: string | null;
  developerName?: string | null;
  logoUrl?: string | null;
  website?: string | null;
  installUrl?: string | null;
  screenshots?: string[];
  redirectUris?: string[];
  scopes?: string[];
  isPublic?: boolean;
  active?: boolean;
}) {
  const d1 = getOAuthD1(args.db);
  const existing = await getApplicationRowById(d1, args.publicApplicationId);

  if (!existing || existing.team_id !== args.publicTeamId) {
    return null;
  }

  const assignments = ["updated_at = ?"];
  const values: unknown[] = [nowIso()];
  const add = (column: string, value: unknown) => {
    assignments.push(`${column} = ?`);
    values.push(value);
  };

  if (args.name !== undefined) {
    add("name", args.name);
    add("slug", await findUniqueSlug(d1, args.name, args.publicApplicationId));
  }
  if (args.description !== undefined) add("description", normalizeOptionalString(args.description));
  if (args.overview !== undefined) add("overview", normalizeOptionalString(args.overview));
  if (args.developerName !== undefined) {
    add("developer_name", normalizeOptionalString(args.developerName));
  }
  if (args.logoUrl !== undefined) add("logo_url", normalizeOptionalString(args.logoUrl));
  if (args.website !== undefined) add("website", normalizeOptionalString(args.website));
  if (args.installUrl !== undefined) add("install_url", normalizeOptionalString(args.installUrl));
  if (args.screenshots !== undefined) {
    add("screenshots_json", JSON.stringify(normalizeStringArray(args.screenshots)));
  }
  if (args.redirectUris !== undefined) {
    add("redirect_uris_json", JSON.stringify(normalizeStringArray(args.redirectUris)));
  }
  if (args.scopes !== undefined) {
    add("scopes_json", JSON.stringify(normalizeStringArray(args.scopes)));
  }
  if (args.isPublic !== undefined) add("is_public", args.isPublic ? 1 : 0);
  if (args.active !== undefined) add("active", args.active ? 1 : 0);

  values.push(args.publicApplicationId, args.publicTeamId);
  await d1
    .prepare(
      `update oauth_applications
       set ${assignments.join(", ")}
       where id = ? and team_id = ?`,
    )
    .bind(...values)
    .run();

  const updated = await getApplicationRowById(d1, args.publicApplicationId);
  return updated ? serializeOAuthApplication(updated) : null;
}

export async function deleteOAuthApplicationInD1(args: {
  db?: Database;
  publicApplicationId: string;
  publicTeamId: string;
}) {
  const d1 = getOAuthD1(args.db);
  const application = await getApplicationRowById(d1, args.publicApplicationId);

  if (!application || application.team_id !== args.publicTeamId) {
    return null;
  }

  await d1
    .prepare("delete from oauth_applications where id = ? and team_id = ?")
    .bind(args.publicApplicationId, args.publicTeamId)
    .run();

  return {
    id: args.publicApplicationId,
    name: application.name,
  };
}

export async function regenerateOAuthClientSecretInD1(args: {
  db?: Database;
  publicApplicationId: string;
  publicTeamId: string;
}) {
  const d1 = getOAuthD1(args.db);
  const application = await getApplicationRowById(d1, args.publicApplicationId);

  if (!application || application.team_id !== args.publicTeamId) {
    return null;
  }

  const clientSecret = randomToken("mid_app_secret_", 16);
  await d1
    .prepare(
      "update oauth_applications set client_secret_hash = ?, updated_at = ? where id = ? and team_id = ?",
    )
    .bind(hash(clientSecret), nowIso(), args.publicApplicationId, args.publicTeamId)
    .run();

  return {
    id: args.publicApplicationId,
    clientId: application.client_id,
    clientSecret,
  };
}

export async function updateOAuthApplicationStatusInD1(args: {
  db?: Database;
  publicApplicationId: string;
  publicTeamId: string;
  status: OAuthApplicationStatus;
}) {
  const d1 = getOAuthD1(args.db);
  const application = await getApplicationRowById(d1, args.publicApplicationId);

  if (!application || application.team_id !== args.publicTeamId) {
    return null;
  }

  await d1
    .prepare(
      "update oauth_applications set status = ?, updated_at = ? where id = ? and team_id = ?",
    )
    .bind(args.status, nowIso(), args.publicApplicationId, args.publicTeamId)
    .run();

  return {
    id: args.publicApplicationId,
    name: application.name,
    status: args.status,
  };
}

export async function createAuthorizationCodeInD1(args: {
  db?: Database;
  publicApplicationId: string;
  userId: string;
  publicTeamId: string;
  scopes: string[];
  redirectUri: string;
  codeChallenge?: string;
}) {
  const d1 = getOAuthD1(args.db);
  const [application, team, user] = await Promise.all([
    getApplicationRowById(d1, args.publicApplicationId),
    teamExists(d1, args.publicTeamId),
    userExists(d1, args.userId),
  ]);

  if (!application || !team || !user || application.team_id !== args.publicTeamId) {
    throw new Error("Missing OAuth authorization code dependencies");
  }

  const id = crypto.randomUUID();
  const code = randomToken("mid_authorization_code_", 16);
  const timestamp = nowIso();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  await d1
    .prepare(
      `insert into oauth_authorization_codes (
        id,
        application_id,
        user_id,
        team_id,
        code_hash,
        scopes_json,
        redirect_uri,
        expires_at,
        created_at,
        used,
        used_at,
        code_challenge,
        code_challenge_method,
        updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, null, ?, ?, ?)`,
    )
    .bind(
      id,
      args.publicApplicationId,
      args.userId,
      args.publicTeamId,
      hash(code),
      JSON.stringify(normalizeStringArray(args.scopes)),
      args.redirectUri,
      expiresAt,
      timestamp,
      args.codeChallenge ?? null,
      args.codeChallenge ? "S256" : null,
      timestamp,
    )
    .run();

  return {
    id,
    code,
    expiresAt,
  };
}

async function getAuthorizationCodeByCode(d1: CloudflareD1DatabaseBinding, code: string) {
  return d1
    .prepare(
      `select
        oauth_authorization_codes.*,
        oauth_applications.id as public_application_id
       from oauth_authorization_codes
       join oauth_applications on oauth_applications.id = oauth_authorization_codes.application_id
       where oauth_authorization_codes.code_hash = ?
       limit 1`,
    )
    .bind(hash(code))
    .first<OAuthAuthorizationCodeRow>();
}

export async function exchangeAuthorizationCodeInD1(args: {
  db?: Database;
  code: string;
  redirectUri: string;
  publicApplicationId: string;
  codeVerifier?: string;
}) {
  const d1 = getOAuthD1(args.db);
  const authCode = await getAuthorizationCodeByCode(d1, args.code);

  if (!authCode) {
    throw new Error("Invalid authorization code");
  }

  if (authCode.public_application_id !== args.publicApplicationId) {
    throw new Error("Authorization code does not belong to this application");
  }

  if (authCode.used === 1) {
    const timestamp = nowIso();
    await d1
      .prepare(
        `update oauth_access_tokens
         set revoked = 1, revoked_at = ?, updated_at = ?
         where authorization_code_id = ? and revoked = 0`,
      )
      .bind(timestamp, timestamp, authCode.id)
      .run();

    throw new Error(
      "Authorization code already used - all related tokens have been revoked for security",
    );
  }

  if (new Date() > new Date(authCode.expires_at)) {
    throw new Error("Authorization code expired");
  }

  if (authCode.redirect_uri !== args.redirectUri) {
    throw new Error("Invalid redirect URI");
  }

  if (authCode.code_challenge) {
    if (!args.codeVerifier) {
      throw new Error("Code verifier is required when code challenge is present");
    }

    if ((await toPkceChallenge(args.codeVerifier)) !== authCode.code_challenge) {
      throw new Error("Invalid code verifier");
    }
  }

  const timestamp = nowIso();
  await d1
    .prepare(
      "update oauth_authorization_codes set used = 1, used_at = ?, updated_at = ? where id = ?",
    )
    .bind(timestamp, timestamp, authCode.id)
    .run();

  const accessToken = randomToken("mid_access_token_", 16);
  const refreshToken = randomToken("mid_refresh_token_", 16);
  const expiresIn = 7200;
  const refreshTokenExpiresIn = 86400 * 30;
  const scopes = parseStringArray(authCode.scopes_json);

  await insertAccessToken(d1, {
    applicationId: authCode.application_id,
    userId: authCode.user_id,
    teamId: authCode.team_id,
    authorizationCodeId: authCode.id,
    tokenHash: hash(accessToken),
    refreshTokenHash: hash(refreshToken),
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
}

async function getAccessTokenByRefreshTokenHash(
  d1: CloudflareD1DatabaseBinding,
  refreshTokenHash: string,
) {
  return d1
    .prepare(`${tokenSelect("where oauth_access_tokens.refresh_token_hash = ?")} limit 1`)
    .bind(refreshTokenHash)
    .first<OAuthAccessTokenRow>();
}

export async function refreshAccessTokenInD1(args: {
  db?: Database;
  refreshToken: string;
  publicApplicationId: string;
  scopes?: string[];
}) {
  const d1 = getOAuthD1(args.db);
  const existingToken = await getAccessTokenByRefreshTokenHash(d1, hash(args.refreshToken));

  if (!existingToken || existingToken.application_id !== args.publicApplicationId) {
    throw new Error("Invalid refresh token");
  }

  if (existingToken.revoked === 1) {
    throw new Error("Refresh token revoked");
  }

  if (
    existingToken.refresh_token_expires_at &&
    new Date() > new Date(existingToken.refresh_token_expires_at)
  ) {
    throw new Error("Refresh token expired");
  }

  let scopes = parseStringArray(existingToken.scopes_json);

  if (args.scopes && args.scopes.length > 0) {
    const granted = new Set(scopes);

    for (const scope of args.scopes) {
      if (!granted.has(scope)) {
        throw new Error(`Requested scope '${scope}' is not authorized for this token`);
      }
    }

    scopes = args.scopes;
  }

  const timestamp = nowIso();
  await d1
    .prepare(
      "update oauth_access_tokens set revoked = 1, revoked_at = ?, updated_at = ? where id = ?",
    )
    .bind(timestamp, timestamp, existingToken.id)
    .run();

  const accessToken = randomToken("mid_access_token_", 16);
  const refreshToken = randomToken("mid_refresh_token_", 16);
  const expiresIn = 7200;
  const refreshTokenExpiresIn = 86400 * 30;

  await insertAccessToken(d1, {
    applicationId: existingToken.application_id,
    userId: existingToken.user_id,
    teamId: existingToken.team_id,
    authorizationCodeId: null,
    tokenHash: hash(accessToken),
    refreshTokenHash: hash(refreshToken),
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
}

export async function getOAuthAccessTokenByTokenFromD1(token: string, db?: Database) {
  const row = await getOAuthD1(db)
    .prepare(`${tokenSelect("where oauth_access_tokens.token_hash = ?")} limit 1`)
    .bind(hash(token))
    .first<OAuthAccessTokenRow>();

  if (!row || row.revoked === 1 || row.expires_at <= nowIso() || row.application_active !== 1) {
    return null;
  }

  return {
    id: row.id,
    applicationId: row.application_id,
    teamId: row.team_id,
    scopes: parseStringArray(row.scopes_json),
    expiresAt: row.expires_at,
    revoked: row.revoked === 1,
    user: {
      id: row.user_id,
      fullName: row.user_full_name,
      email: row.user_email,
      avatarUrl: row.user_avatar_url,
    },
    application: {
      id: row.application_id,
      name: row.application_name,
      clientId: row.application_client_id,
      active: row.application_active === 1,
    },
  };
}

export async function touchOAuthAccessTokenInD1(publicAccessTokenId: string, db?: Database) {
  const timestamp = nowIso();
  const result = await getOAuthD1(db)
    .prepare("update oauth_access_tokens set last_used_at = ?, updated_at = ? where id = ?")
    .bind(timestamp, timestamp, publicAccessTokenId)
    .run();

  return result;
}

export async function revokeAccessTokenInD1(args: {
  db?: Database;
  token: string;
  publicApplicationId?: string;
}) {
  const d1 = getOAuthD1(args.db);
  const tokenHash = hash(args.token);
  const row = await d1
    .prepare(
      `${tokenSelect(
        "where oauth_access_tokens.token_hash = ? or oauth_access_tokens.refresh_token_hash = ?",
      )} limit 1`,
    )
    .bind(tokenHash, tokenHash)
    .first<OAuthAccessTokenRow>();

  if (!row || row.revoked === 1) {
    return null;
  }

  if (args.publicApplicationId && row.application_id !== args.publicApplicationId) {
    return null;
  }

  const timestamp = nowIso();
  await d1
    .prepare(
      "update oauth_access_tokens set revoked = 1, revoked_at = ?, updated_at = ? where id = ?",
    )
    .bind(timestamp, timestamp, row.id)
    .run();

  return {
    id: row.id,
    token: row.token_hash,
  };
}

export async function getUserAuthorizedApplicationsFromD1(args: {
  db?: Database;
  userId: string;
  publicTeamId: string;
}) {
  const { results = [] } = await getOAuthD1(args.db)
    .prepare(
      `${tokenSelect(
        "where oauth_access_tokens.user_id = ? and oauth_access_tokens.team_id = ? and oauth_access_tokens.revoked = 0 and oauth_access_tokens.expires_at > ?",
      )}
       order by coalesce(oauth_access_tokens.last_used_at, oauth_access_tokens.created_at) desc`,
    )
    .bind(args.userId, args.publicTeamId, nowIso())
    .all<OAuthAccessTokenRow>();

  return results
    .map(serializeAuthorizedApplication)
    .filter((value): value is NonNullable<typeof value> => Boolean(value));
}

export async function hasUserEverAuthorizedAppInD1(args: {
  db?: Database;
  publicApplicationId: string;
  userId: string;
  publicTeamId: string;
}) {
  const row = await getOAuthD1(args.db)
    .prepare(
      `select id
       from oauth_access_tokens
       where user_id = ? and team_id = ? and application_id = ?
       limit 1`,
    )
    .bind(args.userId, args.publicTeamId, args.publicApplicationId)
    .first<{ id: string }>();

  return Boolean(row);
}

export async function revokeUserApplicationTokensInD1(args: {
  db?: Database;
  publicApplicationId: string;
  userId: string;
}) {
  const timestamp = nowIso();
  await getOAuthD1(args.db)
    .prepare(
      `update oauth_access_tokens
       set revoked = 1, revoked_at = ?, updated_at = ?
       where user_id = ? and application_id = ? and revoked = 0`,
    )
    .bind(timestamp, timestamp, args.userId, args.publicApplicationId)
    .run();

  return { success: true };
}

export async function getOAuthTeamNameFromD1(publicTeamId: string, db?: Database) {
  const row = await getOAuthD1(db)
    .prepare("select name from teams where id = ? limit 1")
    .bind(publicTeamId)
    .first<{ name: string | null }>();

  return row?.name ?? null;
}
