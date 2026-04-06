import {
  addWhatsAppConnectionInConvex,
  getInstalledAppByWhatsAppNumberFromConvex,
  removeWhatsAppConnectionInConvex,
} from "@tamias/app-data-convex";
import type { Database } from "../../client";
import { getAppByAppId } from "./core";
import {
  isConvexMessage,
  toAppRecord,
  type WhatsAppConfig,
  type WhatsAppConnection,
} from "./shared";

export class WhatsAppAlreadyConnectedToAnotherTeamError extends Error {
  code = "WHATSAPP_ALREADY_CONNECTED_TO_ANOTHER_TEAM" as const;

  constructor() {
    super("Phone number already connected to another team");
    this.name = "WhatsAppAlreadyConnectedToAnotherTeamError";
  }
}

export const getAppByWhatsAppNumber = async (_db: Database, phoneNumber: string) => {
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

export const addWhatsAppConnection = async (_db: Database, params: AddWhatsAppConnectionParams) => {
  try {
    const result = await addWhatsAppConnectionInConvex({
      teamId: params.teamId,
      phoneNumber: params.phoneNumber,
      displayName: params.displayName,
    });

    return toAppRecord(result);
  } catch (error) {
    if (isConvexMessage(error, "WHATSAPP_ALREADY_CONNECTED_TO_ANOTHER_TEAM")) {
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

export type { WhatsAppConnection };
