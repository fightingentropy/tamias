import {
  mergeInstalledAppConfigInConvex,
  setInstalledAppConfigInConvex,
} from "@tamias/app-data-convex";
import type { Database } from "../../client";
import { toAppRecord } from "./shared";

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
