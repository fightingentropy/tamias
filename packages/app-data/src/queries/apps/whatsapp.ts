import type { Database } from "../../client";
import { getAppByAppId } from "./core";
import {
  deleteInstalledAppFromD1,
  getInstalledAppByWhatsAppNumberFromD1,
  requireInstalledAppsD1,
  setInstalledAppConfigInD1,
  upsertInstalledAppInD1,
} from "./d1";
import { toAppRecord, type WhatsAppConfig, type WhatsAppConnection } from "./shared";

export class WhatsAppAlreadyConnectedToAnotherTeamError extends Error {
  code = "WHATSAPP_ALREADY_CONNECTED_TO_ANOTHER_TEAM" as const;

  constructor() {
    super("Phone number already connected to another team");
    this.name = "WhatsAppAlreadyConnectedToAnotherTeamError";
  }
}

export const getAppByWhatsAppNumber = async (db: Database, phoneNumber: string) => {
  const result = await getInstalledAppByWhatsAppNumberFromD1(
    requireInstalledAppsD1(db),
    phoneNumber,
  );

  return result ? toAppRecord(result) : null;
};

export type AddWhatsAppConnectionParams = {
  teamId: string;
  phoneNumber: string;
  displayName?: string;
};

export const addWhatsAppConnection = async (db: Database, params: AddWhatsAppConnectionParams) => {
  const d1 = requireInstalledAppsD1(db);
  const existingConnection = await getInstalledAppByWhatsAppNumberFromD1(d1, params.phoneNumber);

  if (existingConnection) {
    if (existingConnection.teamId === params.teamId) {
      return toAppRecord(existingConnection);
    }

    throw new WhatsAppAlreadyConnectedToAnotherTeamError();
  }

  const existingTeamApp = await getAppByAppId(db, {
    appId: "whatsapp",
    teamId: params.teamId,
  });
  const displayName = params.displayName?.trim();
  const newConnection: WhatsAppConnection = {
    phoneNumber: params.phoneNumber,
    ...(displayName ? { displayName } : {}),
    connectedAt: new Date().toISOString(),
  };

  if (existingTeamApp) {
    const config = (
      existingTeamApp.config &&
      typeof existingTeamApp.config === "object" &&
      !Array.isArray(existingTeamApp.config)
        ? (existingTeamApp.config as WhatsAppConfig)
        : {}
    ) as WhatsAppConfig;
    const connections = config.connections ?? [];
    const result = await setInstalledAppConfigInD1(d1, {
      teamId: params.teamId,
      appId: "whatsapp",
      config: {
        ...config,
        connections: [...connections, newConnection],
      },
    });

    return toAppRecord(result);
  }

  const result = await upsertInstalledAppInD1(d1, {
    teamId: params.teamId,
    appId: "whatsapp",
    config: {
      connections: [newConnection],
    },
    settings: [
      { id: "receipts", label: "Receipt Processing", value: true },
      { id: "matches", label: "Match Notifications", value: true },
    ],
  });

  return toAppRecord(result);
};

export type RemoveWhatsAppConnectionParams = {
  teamId: string;
  phoneNumber: string;
};

export const removeWhatsAppConnection = async (
  db: Database,
  params: RemoveWhatsAppConnectionParams,
) => {
  const d1 = requireInstalledAppsD1(db);
  const app = await getAppByAppId(db, {
    appId: "whatsapp",
    teamId: params.teamId,
  });

  if (!app) {
    throw new Error("WhatsApp app not found for this team");
  }

  const config = (
    app.config && typeof app.config === "object" && !Array.isArray(app.config)
      ? (app.config as WhatsAppConfig)
      : {}
  ) as WhatsAppConfig;
  const connections = config.connections ?? [];
  const updatedConnections = connections.filter(
    (connection) => connection.phoneNumber !== params.phoneNumber,
  );

  if (updatedConnections.length === 0) {
    await deleteInstalledAppFromD1(d1, {
      teamId: params.teamId,
      appId: "whatsapp",
    });

    return null;
  }

  const result = await setInstalledAppConfigInD1(d1, {
    teamId: params.teamId,
    appId: "whatsapp",
    config: {
      ...config,
      connections: updatedConnections,
    },
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

export type { WhatsAppConnection };
