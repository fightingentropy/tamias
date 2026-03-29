import {
  bulkUpsertNotificationSettingsInConvex,
  type CurrentUserIdentityRecord,
  getNotificationSettingsFromConvex,
  type NotificationChannel as FoundationNotificationChannel,
  upsertNotificationSettingInConvex,
} from "@tamias/app-data-convex";
import { getUserSettingsNotificationTypes } from "@tamias/notifications";
import type { Database } from "../client";

export type NotificationChannel = FoundationNotificationChannel;
type ConvexUserId = CurrentUserIdentityRecord["convexId"];

export interface NotificationSetting {
  id: string;
  userId: ConvexUserId | null;
  teamId: string;
  notificationType: string;
  channel: NotificationChannel;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertNotificationSettingParams {
  userId: ConvexUserId;
  teamId: string;
  notificationType: string;
  channel: NotificationChannel;
  enabled: boolean;
}

export interface GetNotificationSettingsParams {
  userId: ConvexUserId;
  teamId: string;
  notificationType?: string;
  channel?: NotificationChannel;
}

export async function getNotificationSettings(
  _db: Database,
  params: GetNotificationSettingsParams,
): Promise<NotificationSetting[]> {
  const results = await getNotificationSettingsFromConvex({
    userId: params.userId,
    teamId: params.teamId,
    notificationType: params.notificationType,
    channel: params.channel,
  });

  return results.map((result) => ({
    id: result.id,
    userId: result.userId,
    teamId: result.teamId,
    notificationType: result.notificationType,
    channel: result.channel,
    enabled: result.enabled,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  }));
}

export async function upsertNotificationSetting(
  _db: Database,
  params: UpsertNotificationSettingParams,
): Promise<NotificationSetting> {
  const result = await upsertNotificationSettingInConvex({
    userId: params.userId,
    teamId: params.teamId,
    notificationType: params.notificationType,
    channel: params.channel,
    enabled: params.enabled,
  });

  return {
    id: result.id,
    userId: result.userId,
    teamId: result.teamId,
    notificationType: result.notificationType,
    channel: result.channel,
    enabled: result.enabled,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  };
}

// Helper to check if a specific notification should be sent
export async function shouldSendNotification(
  db: Database,
  userId: ConvexUserId,
  teamId: string,
  notificationType: string,
  channel: NotificationChannel,
): Promise<boolean> {
  const settings = await getNotificationSettings(db, {
    userId,
    teamId,
    notificationType,
    channel,
  });

  // If no setting exists, default to enabled
  if (settings.length === 0) {
    return true;
  }

  return settings[0]?.enabled ?? true;
}

// Get all notification types with their current settings for a user
// Note: This only returns the backend data (type, channels, settings)
// Frontend should handle name/description via i18n
export async function getUserNotificationPreferences(
  db: Database,
  userId: ConvexUserId,
  teamId: string,
): Promise<
  {
    type: string;
    channels: NotificationChannel[];
    settings: { channel: NotificationChannel; enabled: boolean }[];
    category?: string;
    order?: number;
  }[]
> {
  const userSettings = await getNotificationSettings(db, { userId, teamId });

  // Get notification types that should appear in user settings
  const notificationTypes = getUserSettingsNotificationTypes();

  return notificationTypes.map((notificationType) => ({
    type: notificationType.type,
    channels: notificationType.channels,
    category: notificationType.category,
    order: notificationType.order,
    settings: notificationType.channels.map((channel) => {
      const setting = userSettings.find(
        (s) =>
          s.notificationType === notificationType.type && s.channel === channel,
      );
      return {
        channel,
        enabled: setting?.enabled ?? true, // Default to enabled if no setting exists
      };
    }),
  }));
}

// Bulk update multiple notification settings
export async function bulkUpdateNotificationSettings(
  _db: Database,
  userId: ConvexUserId,
  teamId: string,
  updates: {
    notificationType: string;
    channel: NotificationChannel;
    enabled: boolean;
  }[],
): Promise<NotificationSetting[]> {
  const results = await bulkUpsertNotificationSettingsInConvex({
    userId,
    teamId,
    updates,
  });

  return results.map((result) => ({
    id: result.id,
    userId: result.userId,
    teamId: result.teamId,
    notificationType: result.notificationType,
    channel: result.channel,
    enabled: result.enabled,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  }));
}
