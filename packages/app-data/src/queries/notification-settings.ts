export type {
  ConvexUserId,
  GetNotificationSettingsParams,
  NotificationChannel,
  NotificationSetting,
  UpsertNotificationSettingParams,
  UserNotificationPreference,
  UserSettingsNotificationType,
} from "./notification-settings/types";
export { USER_SETTINGS_NOTIFICATION_TYPES } from "./notification-settings/defaults";
export {
  getNotificationSettings,
  getUserNotificationPreferences,
  shouldSendNotification,
} from "./notification-settings/reads";
export {
  bulkUpdateNotificationSettings,
  upsertNotificationSetting,
} from "./notification-settings/writes";
