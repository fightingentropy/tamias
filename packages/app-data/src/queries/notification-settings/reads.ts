import { getNotificationSettingsFromConvex } from "@tamias/app-data-convex";
import type { Database } from "../../client";
import { USER_SETTINGS_NOTIFICATION_TYPES } from "./defaults";
import { toNotificationSetting } from "./shared";
import type {
  ConvexUserId,
  GetNotificationSettingsParams,
  NotificationChannel,
  NotificationSetting,
  UserNotificationPreference,
} from "./types";

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

  return results.map(toNotificationSetting);
}

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

  if (settings.length === 0) {
    return true;
  }

  return settings[0]?.enabled ?? true;
}

export async function getUserNotificationPreferences(
  db: Database,
  userId: ConvexUserId,
  teamId: string,
): Promise<UserNotificationPreference[]> {
  const userSettings = await getNotificationSettings(db, { userId, teamId });

  return USER_SETTINGS_NOTIFICATION_TYPES.map((notificationType) => ({
    type: notificationType.type,
    channels: notificationType.channels,
    category: notificationType.category,
    order: notificationType.order,
    settings: notificationType.channels.map((channel) => {
      const setting = userSettings.find(
        (userSetting) =>
          userSetting.notificationType === notificationType.type && userSetting.channel === channel,
      );

      return {
        channel,
        enabled: setting?.enabled ?? true,
      };
    }),
  }));
}
