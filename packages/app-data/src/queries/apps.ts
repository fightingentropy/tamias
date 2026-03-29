import {
  addWhatsAppConnectionInConvex,
  deleteInstalledAppInConvex,
  getInstalledAppBySlackTeamIdFromConvex,
  getInstalledAppByWhatsAppNumberFromConvex,
  getInstalledAppFromConvex,
  listInstalledAppsFromConvex,
  mergeInstalledAppConfigInConvex,
  removeWhatsAppConnectionInConvex,
  setInstalledAppConfigInConvex,
  setInstalledAppSettingsInConvex,
  type CurrentUserIdentityRecord,
  type InstalledAppRecord,
  upsertInstalledAppInConvex,
} from "@tamias/app-data-convex";
import type { Database } from "../client";

export class WhatsAppAlreadyConnectedToAnotherTeamError extends Error {
  code = "WHATSAPP_ALREADY_CONNECTED_TO_ANOTHER_TEAM" as const;

  constructor() {
    super("Phone number already connected to another team");
    this.name = "WhatsAppAlreadyConnectedToAnotherTeamError";
  }
}

export type CreateAppParams = {
  teamId: string;
  createdByUserId: CurrentUserIdentityRecord["convexId"];
  appId: string;
  settings?: unknown;
  config?: unknown;
};

type AppSetting = {
  id: string;
  value: string | number | boolean;
  [key: string]: unknown;
};

export type AppRecord = {
  id: string;
  teamId: string | null;
  createdBy: CurrentUserIdentityRecord["convexId"] | null;
  appId: string;
  config: unknown;
  settings: unknown;
  createdAt: string;
  updatedAt: string;
};

function toAppRecord(record: InstalledAppRecord): AppRecord {
  return {
    id: record.id,
    teamId: record.teamId,
    createdBy: record.createdBy,
    appId: record.appId,
    config: record.config,
    settings: record.settings,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function isConvexMessage(error: unknown, message: string) {
  return error instanceof Error && error.message.includes(message);
}

export const createApp = async (_db: Database, params: CreateAppParams) => {
  const result = await upsertInstalledAppInConvex({
    publicAppRecordId: crypto.randomUUID(),
    teamId: params.teamId,
    createdByUserId: params.createdByUserId,
    appId: params.appId,
    settings: params.settings,
    config: params.config,
    createdAt: new Date().toISOString(),
  });

  return toAppRecord(result);
};

export const getApps = async (_db: Database, teamId: string) => {
  const results = await listInstalledAppsFromConvex({ teamId });

  return results.map((result) => ({
    app_id: result.appId,
    settings: result.settings,
    config: result.config,
    createdAt: result.createdAt,
  }));
};

export type GetAppByAppIdParams = {
  appId: string;
  teamId: string;
};

export const getAppByAppId = async (
  _db: Database,
  params: GetAppByAppIdParams,
) => {
  const result = await getInstalledAppFromConvex({
    teamId: params.teamId,
    appId: params.appId,
  });

  return result ? toAppRecord(result) : null;
};

export type GetAppBySlackTeamIdParams = {
  slackTeamId: string;
  channelId?: string;
};

export const getAppBySlackTeamId = async (
  _db: Database,
  params: GetAppBySlackTeamIdParams,
) => {
  const result = await getInstalledAppBySlackTeamIdFromConvex({
    slackTeamId: params.slackTeamId,
    channelId: params.channelId,
  });

  return result ? toAppRecord(result) : null;
};

export type DisconnectAppParams = {
  appId: string;
  teamId: string;
};

export const disconnectApp = async (
  _db: Database,
  params: DisconnectAppParams,
) => {
  const result = await deleteInstalledAppInConvex({
    appId: params.appId,
    teamId: params.teamId,
  });

  return result ? toAppRecord(result) : null;
};

export type UpdateAppSettingsParams = {
  appId: string;
  teamId: string;
  option: {
    id: string;
    value: string | number | boolean;
  };
};

export const updateAppSettings = async (
  db: Database,
  params: UpdateAppSettingsParams,
) => {
  const existingApp = await getAppByAppId(db, {
    appId: params.appId,
    teamId: params.teamId,
  });

  if (!existingApp) {
    throw new Error("App not found");
  }

  const settings = (existingApp.settings as AppSetting[]) || [];
  const updatedSettings = settings.map((setting: AppSetting) => {
    if (setting.id === params.option.id) {
      return { ...setting, value: params.option.value };
    }

    return setting;
  });

  const result = await setInstalledAppSettingsInConvex({
    appId: params.appId,
    teamId: params.teamId,
    settings: updatedSettings,
  });

  return toAppRecord(result);
};

export type UpdateAppSettingsBulkParams = {
  appId: string;
  teamId: string;
  settings: Array<{
    id: string;
    value: unknown;
    [key: string]: unknown;
  }>;
};

export const updateAppSettingsBulk = async (
  _db: Database,
  params: UpdateAppSettingsBulkParams,
) => {
  const result = await setInstalledAppSettingsInConvex({
    appId: params.appId,
    teamId: params.teamId,
    settings: params.settings,
  });

  return toAppRecord(result);
};

export type DeleteAppParams = {
  appId: string;
  teamId: string;
};

export const deleteApp = async (_db: Database, params: DeleteAppParams) => {
  return disconnectApp(_db, params);
};

export type WhatsAppConnection = {
  phoneNumber: string;
  displayName?: string;
  connectedAt: string;
};

type WhatsAppConfig = {
  connections?: WhatsAppConnection[];
};

export const getAppByWhatsAppNumber = async (
  _db: Database,
  phoneNumber: string,
) => {
  const result = await getInstalledAppByWhatsAppNumberFromConvex({
    phoneNumber,
  });

  return result ? toAppRecord(result) : null;
};

export type AddWhatsAppConnectionParams = {
  teamId: string;
  phoneNumber: string;
  displayName?: string;
};

export const addWhatsAppConnection = async (
  _db: Database,
  params: AddWhatsAppConnectionParams,
) => {
  try {
    const result = await addWhatsAppConnectionInConvex({
      teamId: params.teamId,
      phoneNumber: params.phoneNumber,
      displayName: params.displayName,
    });

    return toAppRecord(result);
  } catch (error) {
    if (
      isConvexMessage(error, "WHATSAPP_ALREADY_CONNECTED_TO_ANOTHER_TEAM")
    ) {
      throw new WhatsAppAlreadyConnectedToAnotherTeamError();
    }

    throw error;
  }
};

export type RemoveWhatsAppConnectionParams = {
  teamId: string;
  phoneNumber: string;
};

export const removeWhatsAppConnection = async (
  _db: Database,
  params: RemoveWhatsAppConnectionParams,
) => {
  const result = await removeWhatsAppConnectionInConvex({
    teamId: params.teamId,
    phoneNumber: params.phoneNumber,
  });

  return result ? toAppRecord(result) : null;
};

export const getWhatsAppConnections = async (_db: Database, teamId: string) => {
  const app = await getAppByAppId(_db, { appId: "whatsapp", teamId });

  if (!app) {
    return [];
  }

  const config = (app.config as WhatsAppConfig) || {};
  return config.connections || [];
};

export type UpdateAppTokensParams = {
  teamId: string;
  appId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
};

export const updateAppTokens = async (
  _db: Database,
  params: UpdateAppTokensParams,
) => {
  const result = await mergeInstalledAppConfigInConvex({
    teamId: params.teamId,
    appId: params.appId,
    configPatch: {
      accessToken: params.accessToken,
      refreshToken: params.refreshToken,
      expiresAt: params.expiresAt,
    },
  });

  return toAppRecord(result);
};

export type SetAppConfigParams = {
  teamId: string;
  appId: string;
  config: unknown;
};

export const setAppConfig = async (_db: Database, params: SetAppConfigParams) => {
  const result = await setInstalledAppConfigInConvex({
    teamId: params.teamId,
    appId: params.appId,
    config: params.config,
  });

  return toAppRecord(result);
};
