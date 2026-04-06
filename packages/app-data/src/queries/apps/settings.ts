import { setInstalledAppSettingsInConvex } from "@tamias/app-data-convex";
import type { Database } from "../../client";
import { getAppByAppId } from "./core";
import { toAppRecord, type AppSetting } from "./shared";

export type UpdateAppSettingsParams = {
  appId: string;
  teamId: string;
  option: {
    id: string;
    value: string | number | boolean;
  };
};

export const updateAppSettings = async (db: Database, params: UpdateAppSettingsParams) => {
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

export const updateAppSettingsBulk = async (_db: Database, params: UpdateAppSettingsBulkParams) => {
  const result = await setInstalledAppSettingsInConvex({
    appId: params.appId,
    teamId: params.teamId,
    settings: params.settings,
  });

  return toAppRecord(result);
};
