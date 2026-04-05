import {
  bulkUpsertNotificationSettingsInConvex,
  upsertNotificationSettingInConvex,
} from "../../convex";
import type { Database } from "../../client";
import { toNotificationSetting } from "./shared";
import type {
  ConvexUserId,
  NotificationChannel,
  NotificationSetting,
  UpsertNotificationSettingParams,
} from "./types";

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

  return toNotificationSetting(result);
}

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

  return results.map(toNotificationSetting);
}
