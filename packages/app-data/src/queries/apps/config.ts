import type { Database } from "../../client";
import {
  mergeInstalledAppConfigInD1,
  requireInstalledAppsD1,
  setInstalledAppConfigInD1,
} from "./d1";
import { toAppRecord } from "./shared";

export type UpdateAppTokensParams = {
  teamId: string;
  appId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
};

export const updateAppTokens = async (db: Database, params: UpdateAppTokensParams) => {
  const result = await mergeInstalledAppConfigInD1(requireInstalledAppsD1(db), {
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

export const setAppConfig = async (db: Database, params: SetAppConfigParams) => {
  const result = await setInstalledAppConfigInD1(requireInstalledAppsD1(db), {
    teamId: params.teamId,
    appId: params.appId,
    config: params.config,
  });

  return toAppRecord(result);
};
