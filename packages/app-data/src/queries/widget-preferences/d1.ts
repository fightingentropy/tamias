import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "../../client";
import type { StoredWidgetPreferences, WidgetPreferencesParams } from "../widget-preferences";

type WidgetPreferencesRow = {
  user_id: string;
  team_id: string;
  primary_widgets_json: string;
  available_widgets_json: string;
  created_at: string;
  updated_at: string;
};

export function getWidgetPreferencesD1(db: Database) {
  return requireCloudflareD1Database(db);
}

function parseWidgets(value: string) {
  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed)
    ? parsed.filter((item): item is string => typeof item === "string")
    : [];
}

function toWidgetPreferences(row: WidgetPreferencesRow): StoredWidgetPreferences {
  return {
    primaryWidgets: parseWidgets(row.primary_widgets_json),
    availableWidgets: parseWidgets(row.available_widgets_json),
  };
}

export async function getWidgetPreferencesFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: WidgetPreferencesParams,
) {
  const row = await d1
    .prepare(
      `select *
       from widget_preferences
       where user_id = ? and team_id = ?
       limit 1`,
    )
    .bind(params.userId, params.teamId)
    .first<WidgetPreferencesRow>();

  return row ? toWidgetPreferences(row) : null;
}

export async function upsertWidgetPreferencesInD1(
  d1: CloudflareD1DatabaseBinding,
  params: WidgetPreferencesParams & { preferences: StoredWidgetPreferences },
) {
  const timestamp = new Date().toISOString();

  await d1
    .prepare(
      `insert into widget_preferences (
        user_id,
        team_id,
        primary_widgets_json,
        available_widgets_json,
        created_at,
        updated_at
      ) values (?, ?, ?, ?, ?, ?)
      on conflict(user_id, team_id) do update set
        primary_widgets_json = excluded.primary_widgets_json,
        available_widgets_json = excluded.available_widgets_json,
        updated_at = excluded.updated_at`,
    )
    .bind(
      params.userId,
      params.teamId,
      JSON.stringify(params.preferences.primaryWidgets),
      JSON.stringify(params.preferences.availableWidgets),
      timestamp,
      timestamp,
    )
    .run();
}
