import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "../../client";
import type {
  GetNotificationSettingsParams,
  NotificationChannel,
  NotificationSetting,
  UpsertNotificationSettingParams,
  UserId,
} from "./types";

type NotificationSettingRow = {
  id: string;
  user_id: string;
  team_id: string;
  notification_type: string;
  channel: NotificationChannel;
  enabled: number;
  created_at: string;
  updated_at: string;
};

export function getNotificationSettingsD1(db: Database) {
  return requireCloudflareD1Database(db);
}

function toBoolean(value: number | boolean) {
  return value === true || value === 1;
}

function toNotificationSetting(row: NotificationSettingRow): NotificationSetting {
  return {
    id: row.id,
    userId: row.user_id,
    teamId: row.team_id,
    notificationType: row.notification_type,
    channel: row.channel,
    enabled: toBoolean(row.enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function upsertNotificationSettingInD1(
  d1: CloudflareD1DatabaseBinding,
  setting: NotificationSetting,
) {
  if (!setting.userId) {
    return;
  }

  await d1
    .prepare(
      `insert into notification_settings (
        id,
        user_id,
        team_id,
        notification_type,
        channel,
        enabled,
        created_at,
        updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(user_id, team_id, notification_type, channel) do update set
        id = excluded.id,
        enabled = excluded.enabled,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at`,
    )
    .bind(
      setting.id,
      setting.userId,
      setting.teamId,
      setting.notificationType,
      setting.channel,
      setting.enabled ? 1 : 0,
      setting.createdAt,
      setting.updatedAt,
    )
    .run();
}

export async function upsertNotificationSettingParamsInD1(
  d1: CloudflareD1DatabaseBinding,
  params: UpsertNotificationSettingParams,
) {
  const existing = (
    await getNotificationSettingsFromD1(d1, {
      userId: params.userId,
      teamId: params.teamId,
      notificationType: params.notificationType,
      channel: params.channel,
    })
  )?.[0];
  const timestamp = new Date().toISOString();
  const setting: NotificationSetting = {
    id: existing?.id ?? crypto.randomUUID(),
    userId: params.userId,
    teamId: params.teamId,
    notificationType: params.notificationType,
    channel: params.channel,
    enabled: params.enabled,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };

  await upsertNotificationSettingInD1(d1, setting);

  return setting;
}

export async function bulkUpsertNotificationSettingsInD1(
  d1: CloudflareD1DatabaseBinding,
  params: {
    userId: UserId;
    teamId: string;
    updates: {
      notificationType: string;
      channel: NotificationChannel;
      enabled: boolean;
    }[];
  },
) {
  const results: NotificationSetting[] = [];

  for (const update of params.updates) {
    results.push(
      await upsertNotificationSettingParamsInD1(d1, {
        userId: params.userId,
        teamId: params.teamId,
        ...update,
      }),
    );
  }

  return results;
}

export async function getNotificationSettingsFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: GetNotificationSettingsParams,
) {
  const filters = ["user_id = ?", "team_id = ?"];
  const values: unknown[] = [params.userId, params.teamId];

  if (params.notificationType) {
    filters.push("notification_type = ?");
    values.push(params.notificationType);
  }

  if (params.channel) {
    filters.push("channel = ?");
    values.push(params.channel);
  }

  const { results = [] } = await d1
    .prepare(
      `select *
       from notification_settings
       where ${filters.join(" and ")}
       order by notification_type asc, channel asc`,
    )
    .bind(...values)
    .all<NotificationSettingRow>();

  return results.map(toNotificationSetting);
}
