import type { ConvexUserId } from "./base";
import { api, createClient, serviceArgs } from "./base";

export type NotificationChannel = "in_app" | "email" | "push";
export type NotificationStatus = "unread" | "read" | "archived";

export type NotificationSetting = {
  id: string;
  userId: ConvexUserId | null;
  teamId: string;
  notificationType: string;
  channel: NotificationChannel;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export async function getNotificationSettingsFromConvex(args: {
  userId: ConvexUserId;
  teamId: string;
  notificationType?: string;
  channel?: NotificationChannel;
}) {
  return createClient().query(
    api.foundation.serviceGetNotificationSettings,
    serviceArgs({
      userId: args.userId,
      publicTeamId: args.teamId,
      notificationType: args.notificationType,
      channel: args.channel,
    }),
  ) as Promise<NotificationSetting[]>;
}

export async function upsertNotificationSettingInConvex(args: {
  userId: ConvexUserId;
  teamId: string;
  notificationType: string;
  channel: NotificationChannel;
  enabled: boolean;
}) {
  return createClient().mutation(
    api.foundation.serviceUpsertNotificationSetting,
    serviceArgs({
      userId: args.userId,
      publicTeamId: args.teamId,
      notificationType: args.notificationType,
      channel: args.channel,
      enabled: args.enabled,
    }),
  ) as Promise<NotificationSetting>;
}

export async function bulkUpsertNotificationSettingsInConvex(args: {
  userId: ConvexUserId;
  teamId: string;
  updates: {
    notificationType: string;
    channel: NotificationChannel;
    enabled: boolean;
  }[];
}) {
  return createClient().mutation(
    api.foundation.serviceBulkUpsertNotificationSettings,
    serviceArgs({
      userId: args.userId,
      publicTeamId: args.teamId,
      updates: args.updates,
    }),
  ) as Promise<NotificationSetting[]>;
}
