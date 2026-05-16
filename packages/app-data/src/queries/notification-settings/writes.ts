import type { Database } from "../../client";
import {
  bulkUpsertNotificationSettingsInD1,
  getNotificationSettingsD1,
  upsertNotificationSettingParamsInD1,
} from "./d1";
import { toNotificationSetting } from "./shared";
import type {
  NotificationChannel,
  NotificationSetting,
  UpsertNotificationSettingParams,
  UserId,
} from "./types";

export async function upsertNotificationSetting(
  db: Database,
  params: UpsertNotificationSettingParams,
): Promise<NotificationSetting> {
  const d1 = getNotificationSettingsD1(db);

  if (!d1) {
    throw new Error("Notification settings require Cloudflare D1");
  }

  return toNotificationSetting(await upsertNotificationSettingParamsInD1(d1, params));
}

export async function bulkUpdateNotificationSettings(
  db: Database,
  userId: UserId,
  teamId: string,
  updates: {
    notificationType: string;
    channel: NotificationChannel;
    enabled: boolean;
  }[],
): Promise<NotificationSetting[]> {
  const d1 = getNotificationSettingsD1(db);

  if (!d1) {
    throw new Error("Notification settings require Cloudflare D1");
  }

  return (
    await bulkUpsertNotificationSettingsInD1(d1, {
      userId,
      teamId,
      updates,
    })
  ).map(toNotificationSetting);
}
