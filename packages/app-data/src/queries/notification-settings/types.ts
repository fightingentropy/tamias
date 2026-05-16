export type NotificationChannel = "in_app" | "email" | "push";
export type UserId = string;

export interface NotificationSetting {
  id: string;
  userId: UserId | null;
  teamId: string;
  notificationType: string;
  channel: NotificationChannel;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertNotificationSettingParams {
  userId: UserId;
  teamId: string;
  notificationType: string;
  channel: NotificationChannel;
  enabled: boolean;
}

export interface GetNotificationSettingsParams {
  userId: UserId;
  teamId: string;
  notificationType?: string;
  channel?: NotificationChannel;
}

export interface UserSettingsNotificationType {
  type: string;
  channels: NotificationChannel[];
  category?: string;
  order?: number;
}

export type UserNotificationPreference = {
  type: string;
  channels: NotificationChannel[];
  settings: { channel: NotificationChannel; enabled: boolean }[];
  category?: string;
  order?: number;
};
