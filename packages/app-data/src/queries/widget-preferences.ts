import {
  buildWidgetPreferencesFromPrimaryWidgets,
  DEFAULT_WIDGET_PREFERENCES,
  normalizeWidgetPreferences,
  validateWidgetPreferences,
  type WidgetPreferences,
  type WidgetType,
} from "@tamias/domain";
import type { Database } from "../client";
import {
  getWidgetPreferencesD1,
  getWidgetPreferencesFromD1,
  upsertWidgetPreferencesInD1,
} from "./widget-preferences/d1";

export type { WidgetPreferences };

export type StoredWidgetPreferences = {
  primaryWidgets: string[];
  availableWidgets: string[];
};

export type WidgetPreferencesParams = {
  userId: string;
  teamId: string;
};

export type GetWidgetPreferencesParams = {
  userId: string | null | undefined;
  teamId: string;
  accessToken?: string | null;
};

function normalizePreferences(preferences: {
  primaryWidgets?: readonly string[];
  availableWidgets?: readonly string[];
}) {
  return normalizeWidgetPreferences({
    primaryWidgets: Array.from(preferences.primaryWidgets ?? []),
    availableWidgets: Array.from(preferences.availableWidgets ?? []),
  });
}

function requireWidgetPreferencesD1(db: Database) {
  const d1 = getWidgetPreferencesD1(db);

  if (!d1) {
    throw new Error("Widget preferences require Cloudflare D1");
  }

  return d1;
}

export async function getWidgetPreferences(
  db: Database,
  params: GetWidgetPreferencesParams,
): Promise<WidgetPreferences> {
  if (!params.userId) {
    return DEFAULT_WIDGET_PREFERENCES;
  }

  const preferences = await getWidgetPreferencesFromD1(requireWidgetPreferencesD1(db), {
    userId: params.userId,
    teamId: params.teamId,
  });

  return preferences ? normalizePreferences(preferences) : DEFAULT_WIDGET_PREFERENCES;
}

export async function updateWidgetPreferences(
  db: Database,
  params: WidgetPreferencesParams & { primaryWidgets: WidgetType[] },
): Promise<WidgetPreferences> {
  const preferences = buildWidgetPreferencesFromPrimaryWidgets(params.primaryWidgets);
  validateWidgetPreferences(preferences);

  await upsertWidgetPreferencesInD1(requireWidgetPreferencesD1(db), {
    userId: params.userId,
    teamId: params.teamId,
    preferences,
  });

  return preferences;
}
