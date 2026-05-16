import type { Database } from "../../client";
import { getNotificationSettingsD1, getNotificationSettingsFromD1 } from "./d1";
import { USER_SETTINGS_NOTIFICATION_TYPES } from "./defaults";
import { toNotificationSetting } from "./shared";
import type {
  GetNotificationSettingsParams,
  NotificationChannel,
  NotificationSetting,
  UserId,
  UserNotificationPreference,
} from "./types";

export async function getNotificationSettings(
  db: Database,
  params: GetNotificationSettingsParams,
): Promise<NotificationSetting[]> {
  const d1 = getNotificationSettingsD1(db);

  if (!d1) {
    throw new Error("Notification settings require Cloudflare D1");
  }

  return ((await getNotificationSettingsFromD1(d1, params)) ?? []).map(toNotificationSetting);
}

export async function shouldSendNotification(
  db: Database,
  userId: UserId,
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
  userId: UserId,
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
