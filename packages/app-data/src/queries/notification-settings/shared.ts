import type { NotificationSetting } from "./types";

export function toNotificationSetting(
  setting: NotificationSetting,
): NotificationSetting {
  return {
    id: setting.id,
    userId: setting.userId,
    teamId: setting.teamId,
    notificationType: setting.notificationType,
    channel: setting.channel,
    enabled: setting.enabled,
    createdAt: setting.createdAt,
    updatedAt: setting.updatedAt,
  };
}
