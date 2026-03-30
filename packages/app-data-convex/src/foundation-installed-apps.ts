import type { ConvexUserId } from "./base";
import { api, createClient, serviceArgs } from "./base";

export type InstalledAppRecord = {
  id: string;
  teamId: string | null;
  createdBy: ConvexUserId | null;
  appId: string;
  config: unknown;
  settings: unknown;
  createdAt: string;
  updatedAt: string;
};

export async function listInstalledAppsFromConvex(args: { teamId: string }) {
  return createClient().query(
    api.foundation.serviceListInstalledAppsByTeam,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<InstalledAppRecord[]>;
}

export async function getInstalledAppFromConvex(args: {
  teamId: string;
  appId: string;
}) {
  return createClient().query(
    api.foundation.serviceGetInstalledAppByTeamAndAppId,
    serviceArgs({
      publicTeamId: args.teamId,
      appId: args.appId,
    }),
  ) as Promise<InstalledAppRecord | null>;
}

export async function getInstalledAppBySlackTeamIdFromConvex(args: {
  slackTeamId: string;
  channelId?: string;
}) {
  return createClient().query(
    api.foundation.serviceGetInstalledAppBySlackTeamId,
    serviceArgs({
      slackTeamId: args.slackTeamId,
      channelId: args.channelId,
    }),
  ) as Promise<InstalledAppRecord | null>;
}

export async function getInstalledAppByWhatsAppNumberFromConvex(args: {
  phoneNumber: string;
}) {
  return createClient().query(
    api.foundation.serviceGetInstalledAppByWhatsAppNumber,
    serviceArgs({
      phoneNumber: args.phoneNumber,
    }),
  ) as Promise<InstalledAppRecord | null>;
}

export async function upsertInstalledAppInConvex(args: {
  publicAppRecordId?: string;
  teamId: string;
  createdByUserId?: ConvexUserId;
  appId: string;
  config?: unknown;
  settings?: unknown;
  createdAt?: string;
}) {
  return createClient().mutation(
    api.foundation.serviceUpsertInstalledApp,
    serviceArgs({
      publicAppRecordId: args.publicAppRecordId,
      publicTeamId: args.teamId,
      createdByUserId: args.createdByUserId,
      appId: args.appId,
      config: args.config,
      settings: args.settings,
      createdAt: args.createdAt,
    }),
  ) as Promise<InstalledAppRecord>;
}

export async function deleteInstalledAppInConvex(args: {
  teamId: string;
  appId: string;
}) {
  return createClient().mutation(
    api.foundation.serviceDeleteInstalledApp,
    serviceArgs({
      publicTeamId: args.teamId,
      appId: args.appId,
    }),
  ) as Promise<InstalledAppRecord | null>;
}

export async function setInstalledAppSettingsInConvex(args: {
  teamId: string;
  appId: string;
  settings: unknown;
}) {
  return createClient().mutation(
    api.foundation.serviceSetInstalledAppSettings,
    serviceArgs({
      publicTeamId: args.teamId,
      appId: args.appId,
      settings: args.settings,
    }),
  ) as Promise<InstalledAppRecord>;
}

export async function setInstalledAppConfigInConvex(args: {
  teamId: string;
  appId: string;
  config: unknown;
}) {
  return createClient().mutation(
    api.foundation.serviceSetInstalledAppConfig,
    serviceArgs({
      publicTeamId: args.teamId,
      appId: args.appId,
      config: args.config,
    }),
  ) as Promise<InstalledAppRecord>;
}

export async function mergeInstalledAppConfigInConvex(args: {
  teamId: string;
  appId: string;
  configPatch: Record<string, unknown>;
}) {
  return createClient().mutation(
    api.foundation.serviceMergeInstalledAppConfig,
    serviceArgs({
      publicTeamId: args.teamId,
      appId: args.appId,
      configPatch: args.configPatch,
    }),
  ) as Promise<InstalledAppRecord>;
}

export async function addWhatsAppConnectionInConvex(args: {
  teamId: string;
  phoneNumber: string;
  displayName?: string;
}) {
  return createClient().mutation(
    api.foundation.serviceAddWhatsAppConnection,
    serviceArgs({
      publicTeamId: args.teamId,
      phoneNumber: args.phoneNumber,
      displayName: args.displayName,
    }),
  ) as Promise<InstalledAppRecord>;
}

export async function removeWhatsAppConnectionInConvex(args: {
  teamId: string;
  phoneNumber: string;
}) {
  return createClient().mutation(
    api.foundation.serviceRemoveWhatsAppConnection,
    serviceArgs({
      publicTeamId: args.teamId,
      phoneNumber: args.phoneNumber,
    }),
  ) as Promise<InstalledAppRecord | null>;
}
