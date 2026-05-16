import { hash } from "@tamias/encryption";
import {
  createDatabase,
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "@tamias/app-data/client";

type ApiKeyRow = {
  id: string;
  name: string;
  key_hash: string;
  scopes_json: string;
  team_id: string;
  user_id: string;
  created_at: string;
  last_used_at: string | null;
  updated_at: string;
  user_email: string | null;
  user_full_name: string | null;
  user_avatar_url: string | null;
};

type SerializedApiKey = {
  id: string;
  name: string;
  userId: string | null;
  teamId: string | null;
  createdAt: string;
  scopes: string[];
  lastUsedAt: string | null;
  user: {
    id: string | null;
    email: string | null;
    fullName: string | null;
    avatarUrl: string | null;
  };
};

function getFoundationD1(db: Database = createDatabase()) {
  return requireCloudflareD1Database(db);
}

function nowIso() {
  return new Date().toISOString();
}

function randomToken(prefix: string, bytes = 24) {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);

  return `${prefix}${Array.from(buffer, (value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function parseScopes(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;

    if (Array.isArray(parsed)) {
      return parsed.filter((scope): scope is string => typeof scope === "string");
    }
  } catch {
    // Treat malformed persisted scopes as no scopes rather than failing auth lookup.
  }

  return [];
}

function serializeApiKey(row: ApiKeyRow): SerializedApiKey {
  return {
    id: row.id,
    name: row.name,
    userId: row.user_id,
    teamId: row.team_id,
    createdAt: row.created_at,
    scopes: parseScopes(row.scopes_json),
    lastUsedAt: row.last_used_at,
    user: {
      id: row.user_id,
      email: row.user_email,
      fullName: row.user_full_name,
      avatarUrl: row.user_avatar_url,
    },
  };
}

function apiKeySelect(where: string) {
  return `
    select
      api_keys.id,
      api_keys.name,
      api_keys.key_hash,
      api_keys.scopes_json,
      api_keys.team_id,
      api_keys.user_id,
      api_keys.created_at,
      api_keys.last_used_at,
      api_keys.updated_at,
      users.email as user_email,
      users.full_name as user_full_name,
      users.avatar_url as user_avatar_url
    from api_keys
    left join users on users.id = api_keys.user_id
    ${where}
  `;
}

async function getApiKeyByIdAndTeamFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: { publicApiKeyId: string; publicTeamId: string },
) {
  const row = await d1
    .prepare(`${apiKeySelect("where api_keys.id = ? and api_keys.team_id = ?")} limit 1`)
    .bind(args.publicApiKeyId, args.publicTeamId)
    .first<ApiKeyRow>();

  return row ? serializeApiKey(row) : null;
}

export async function getApiKeyByTokenFromD1(token: string, db?: Database) {
  const row = await getFoundationD1(db)
    .prepare(`${apiKeySelect("where api_keys.key_hash = ?")} limit 1`)
    .bind(hash(token))
    .first<ApiKeyRow>();

  return row ? serializeApiKey(row) : null;
}

export async function getApiKeysByTeamFromD1(publicTeamId: string, db?: Database) {
  const result = await getFoundationD1(db)
    .prepare(`${apiKeySelect("where api_keys.team_id = ?")} order by api_keys.created_at asc`)
    .bind(publicTeamId)
    .all<ApiKeyRow>();

  return (result.results ?? []).map(serializeApiKey);
}

export async function touchApiKeyInD1(publicApiKeyId: string, db?: Database) {
  const d1 = getFoundationD1(db);
  const existing = await d1
    .prepare("select id from api_keys where id = ? limit 1")
    .bind(publicApiKeyId)
    .first<{ id: string }>();

  if (!existing) {
    return null;
  }

  const timestamp = nowIso();
  await d1
    .prepare("update api_keys set last_used_at = ?, updated_at = ? where id = ?")
    .bind(timestamp, timestamp, publicApiKeyId)
    .run();

  return publicApiKeyId;
}

export async function createApiKeyInD1(args: {
  db: Database;
  userId: string;
  publicTeamId: string;
  name: string;
  scopes: string[];
}) {
  const d1 = getFoundationD1(args.db);
  const [user, team] = await Promise.all([
    d1
      .prepare("select id from users where id = ? limit 1")
      .bind(args.userId)
      .first<{ id: string }>(),
    d1
      .prepare("select id from teams where id = ? limit 1")
      .bind(args.publicTeamId)
      .first<{ id: string }>(),
  ]);

  if (!user || !team) {
    throw new Error("Missing team or user for API key");
  }

  const key = randomToken("mid_");
  const keyHash = hash(key);
  const timestamp = nowIso();
  const publicApiKeyId = crypto.randomUUID();

  await d1
    .prepare(
      `
        insert into api_keys (
          id,
          name,
          key_hash,
          scopes_json,
          team_id,
          user_id,
          created_at,
          last_used_at,
          updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, null, ?)
      `,
    )
    .bind(
      publicApiKeyId,
      args.name,
      keyHash,
      JSON.stringify(args.scopes),
      args.publicTeamId,
      args.userId,
      timestamp,
      timestamp,
    )
    .run();

  return {
    key,
    data: await getApiKeyByIdAndTeamFromD1(d1, {
      publicApiKeyId,
      publicTeamId: args.publicTeamId,
    }),
  };
}

export async function updateApiKeyInD1(args: {
  db: Database;
  publicApiKeyId: string;
  publicTeamId: string;
  name: string;
  scopes: string[];
}) {
  const d1 = getFoundationD1(args.db);
  const existing = await getApiKeyByIdAndTeamFromD1(d1, args);

  if (!existing) {
    throw new Error("API key not found");
  }

  await d1
    .prepare(
      "update api_keys set name = ?, scopes_json = ?, updated_at = ? where id = ? and team_id = ?",
    )
    .bind(args.name, JSON.stringify(args.scopes), nowIso(), args.publicApiKeyId, args.publicTeamId)
    .run();

  return {
    key: null,
    data: null,
  };
}

export async function deleteApiKeyInD1(args: {
  db: Database;
  publicApiKeyId: string;
  publicTeamId: string;
}) {
  const d1 = getFoundationD1(args.db);
  const existing = await getApiKeyByIdAndTeamFromD1(d1, args);

  if (!existing) {
    return null;
  }

  await d1
    .prepare("delete from api_keys where id = ? and team_id = ?")
    .bind(args.publicApiKeyId, args.publicTeamId)
    .run();

  return args.publicApiKeyId;
}
