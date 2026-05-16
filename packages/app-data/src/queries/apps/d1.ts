import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "../../client";

export type InstalledAppRecord = {
  id: string;
  teamId: string | null;
  createdBy: string | null;
  appId: string;
  config: unknown;
  settings: unknown;
  createdAt: string;
  updatedAt: string;
};

type InstalledAppRow = {
  id: string;
  team_id: string | null;
  created_by: string | null;
  app_id: string;
  config_json: string | null;
  settings_json: string | null;
  created_at: string;
  updated_at: string;
};

function getInstalledAppsD1(db: Database) {
  return requireCloudflareD1Database(db);
}

function serializeJson(value: unknown) {
  return value === undefined ? null : JSON.stringify(value);
}

function parseJson(value: string | null) {
  if (value === null) {
    return null;
  }

  return JSON.parse(value) as unknown;
}

function toInstalledAppRecord(row: InstalledAppRow): InstalledAppRecord {
  return {
    id: row.id,
    teamId: row.team_id,
    createdBy: row.created_by,
    appId: row.app_id,
    config: parseJson(row.config_json),
    settings: parseJson(row.settings_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

async function insertInstalledAppInD1(d1: CloudflareD1DatabaseBinding, app: InstalledAppRecord) {
  await d1
    .prepare(
      `insert into installed_apps (
        id,
        team_id,
        created_by,
        app_id,
        config_json,
        settings_json,
        created_at,
        updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(id) do update set
        team_id = excluded.team_id,
        created_by = excluded.created_by,
        app_id = excluded.app_id,
        config_json = excluded.config_json,
        settings_json = excluded.settings_json,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at`,
    )
    .bind(
      app.id,
      app.teamId,
      app.createdBy,
      app.appId,
      serializeJson(app.config),
      serializeJson(app.settings),
      app.createdAt,
      app.updatedAt,
    )
    .run();
}

async function updateInstalledAppInD1(d1: CloudflareD1DatabaseBinding, app: InstalledAppRecord) {
  await d1
    .prepare(
      `update installed_apps
       set team_id = ?,
           created_by = ?,
           app_id = ?,
           config_json = ?,
           settings_json = ?,
           created_at = ?,
           updated_at = ?
       where id = ?`,
    )
    .bind(
      app.teamId,
      app.createdBy,
      app.appId,
      serializeJson(app.config),
      serializeJson(app.settings),
      app.createdAt,
      app.updatedAt,
      app.id,
    )
    .run();
}

export async function upsertInstalledAppInD1(
  d1: CloudflareD1DatabaseBinding,
  input: {
    id?: string;
    teamId: string;
    createdBy?: string | null;
    appId: string;
    config?: unknown;
    settings?: unknown;
    createdAt?: string;
  },
) {
  const existing = await getInstalledAppFromD1(d1, {
    teamId: input.teamId,
    appId: input.appId,
  });
  const timestamp = new Date().toISOString();

  if (existing) {
    const app: InstalledAppRecord = {
      ...existing,
      createdBy: existing.createdBy ?? input.createdBy ?? null,
      config: input.config ?? existing.config,
      settings: input.settings ?? existing.settings,
      updatedAt: timestamp,
    };

    await updateInstalledAppInD1(d1, app);
    return app;
  }

  const app: InstalledAppRecord = {
    id: input.id ?? crypto.randomUUID(),
    teamId: input.teamId,
    createdBy: input.createdBy ?? null,
    appId: input.appId,
    config: input.config ?? null,
    settings: input.settings ?? null,
    createdAt: input.createdAt ?? timestamp,
    updatedAt: timestamp,
  };

  await insertInstalledAppInD1(d1, app);
  return app;
}

export async function getInstalledAppsFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: { teamId: string },
) {
  const { results = [] } = await d1
    .prepare(
      `select *
       from installed_apps
       where team_id = ?
       order by created_at asc`,
    )
    .bind(params.teamId)
    .all<InstalledAppRow>();

  return results.map(toInstalledAppRecord);
}

export async function getInstalledAppFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: { teamId: string; appId: string },
) {
  const row = await d1
    .prepare("select * from installed_apps where team_id = ? and app_id = ? limit 1")
    .bind(params.teamId, params.appId)
    .first<InstalledAppRow>();

  return row ? toInstalledAppRecord(row) : null;
}

export async function getInstalledAppBySlackTeamIdFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: { slackTeamId: string; channelId?: string },
) {
  const { results = [] } = await d1
    .prepare("select * from installed_apps where app_id = ?")
    .bind("slack")
    .all<InstalledAppRow>();

  const matches = results.map(toInstalledAppRecord).filter((app) => {
    const config = asObject(app.config);

    if (config?.team_id !== params.slackTeamId) {
      return false;
    }

    if (params.channelId) {
      return config?.channel_id === params.channelId;
    }

    return true;
  });

  if (params.channelId) {
    return [...matches].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
  }

  return matches.length === 1 ? matches[0]! : null;
}

export async function getInstalledAppByWhatsAppNumberFromD1(
  d1: CloudflareD1DatabaseBinding,
  phoneNumber: string,
) {
  const { results = [] } = await d1
    .prepare("select * from installed_apps where app_id = ?")
    .bind("whatsapp")
    .all<InstalledAppRow>();

  const app = results.map(toInstalledAppRecord).find((candidate) => {
    const config = asObject(candidate.config);
    const connections = Array.isArray(config?.connections) ? config.connections : [];

    return connections.some((connection) => {
      const value = asObject(connection);
      return value?.phoneNumber === phoneNumber;
    });
  });

  return app ?? null;
}

export async function deleteInstalledAppFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: { teamId: string; appId: string },
) {
  const app = await getInstalledAppFromD1(d1, params);

  await d1
    .prepare("delete from installed_apps where team_id = ? and app_id = ?")
    .bind(params.teamId, params.appId)
    .run();

  return app;
}

export async function setInstalledAppConfigInD1(
  d1: CloudflareD1DatabaseBinding,
  params: { teamId: string; appId: string; config: unknown },
) {
  const app = await getInstalledAppFromD1(d1, params);

  if (!app) {
    throw new Error("Installed app not found");
  }

  const updated = {
    ...app,
    config: params.config,
    updatedAt: new Date().toISOString(),
  };

  await updateInstalledAppInD1(d1, updated);
  return updated;
}

export async function mergeInstalledAppConfigInD1(
  d1: CloudflareD1DatabaseBinding,
  params: { teamId: string; appId: string; configPatch: Record<string, unknown> },
) {
  const app = await getInstalledAppFromD1(d1, params);

  if (!app) {
    throw new Error("Installed app not found");
  }

  const currentConfig = asObject(app.config) ?? {};
  const updated = {
    ...app,
    config: {
      ...currentConfig,
      ...params.configPatch,
    },
    updatedAt: new Date().toISOString(),
  };

  await updateInstalledAppInD1(d1, updated);
  return updated;
}

export async function setInstalledAppSettingsInD1(
  d1: CloudflareD1DatabaseBinding,
  params: { teamId: string; appId: string; settings: unknown },
) {
  const app = await getInstalledAppFromD1(d1, params);

  if (!app) {
    throw new Error("Installed app not found");
  }

  const updated = {
    ...app,
    settings: params.settings,
    updatedAt: new Date().toISOString(),
  };

  await updateInstalledAppInD1(d1, updated);
  return updated;
}

export function requireInstalledAppsD1(db: Database) {
  return getInstalledAppsD1(db);
}
