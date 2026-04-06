import {
  deleteInstalledAppInConvex,
  getInstalledAppBySlackTeamIdFromConvex,
  getInstalledAppFromConvex,
  listInstalledAppsFromConvex,
  type CurrentUserIdentityRecord,
  upsertInstalledAppInConvex,
} from "@tamias/app-data-convex";
import type { Database } from "../../client";
import { toAppRecord } from "./shared";

export type CreateAppParams = {
  teamId: string;
  createdByUserId: CurrentUserIdentityRecord["convexId"];
  appId: string;
  settings?: unknown;
  config?: unknown;
};

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

export const getAppByAppId = async (_db: Database, params: GetAppByAppIdParams) => {
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

export const getAppBySlackTeamId = async (_db: Database, params: GetAppBySlackTeamIdParams) => {
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

export const disconnectApp = async (_db: Database, params: DisconnectAppParams) => {
  const result = await deleteInstalledAppInConvex({
    appId: params.appId,
    teamId: params.teamId,
  });

  return result ? toAppRecord(result) : null;
};

export type DeleteAppParams = {
  appId: string;
  teamId: string;
};

export const deleteApp = async (_db: Database, params: DeleteAppParams) => {
  return disconnectApp(_db, params);
};
