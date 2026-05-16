import type { Database } from "../../client";
import { toAppRecord } from "./shared";
import {
  deleteInstalledAppFromD1,
  getInstalledAppBySlackTeamIdFromD1,
  getInstalledAppFromD1,
  getInstalledAppsFromD1,
  requireInstalledAppsD1,
  upsertInstalledAppInD1,
} from "./d1";

export type CreateAppParams = {
  teamId: string;
  createdByUserId: string;
  appId: string;
  settings?: unknown;
  config?: unknown;
};

export const createApp = async (db: Database, params: CreateAppParams) => {
  const result = await upsertInstalledAppInD1(requireInstalledAppsD1(db), {
    teamId: params.teamId,
    createdBy: params.createdByUserId,
    appId: params.appId,
    settings: params.settings,
    config: params.config,
    createdAt: new Date().toISOString(),
  });

  return toAppRecord(result);
};

export const getApps = async (db: Database, teamId: string) => {
  const results = await getInstalledAppsFromD1(requireInstalledAppsD1(db), { teamId });

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

export const getAppByAppId = async (db: Database, params: GetAppByAppIdParams) => {
  const result = await getInstalledAppFromD1(requireInstalledAppsD1(db), params);

  return result ? toAppRecord(result) : null;
};

export type GetAppBySlackTeamIdParams = {
  slackTeamId: string;
  channelId?: string;
};

export const getAppBySlackTeamId = async (db: Database, params: GetAppBySlackTeamIdParams) => {
  const result = await getInstalledAppBySlackTeamIdFromD1(requireInstalledAppsD1(db), params);

  return result ? toAppRecord(result) : null;
};

export type DisconnectAppParams = {
  appId: string;
  teamId: string;
};

export const disconnectApp = async (db: Database, params: DisconnectAppParams) => {
  const result = await deleteInstalledAppFromD1(requireInstalledAppsD1(db), params);

  return result ? toAppRecord(result) : null;
};

export type DeleteAppParams = {
  appId: string;
  teamId: string;
};

export const deleteApp = async (_db: Database, params: DeleteAppParams) => {
  return disconnectApp(_db, params);
};
