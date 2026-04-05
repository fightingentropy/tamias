import type {
  CurrentUserIdentityRecord,
  NotificationChannel as FoundationNotificationChannel,
} from "@tamias/app-data-convex";

export type NotificationChannel = FoundationNotificationChannel;
export type ConvexUserId = CurrentUserIdentityRecord["convexId"];

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
