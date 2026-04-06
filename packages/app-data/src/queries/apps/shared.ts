import type {
  CurrentUserIdentityRecord,
  InstalledAppRecord,
} from "@tamias/app-data-convex";

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

export type AppSetting = {
  id: string;
  value: string | number | boolean;
  [key: string]: unknown;
};

export type WhatsAppConnection = {
  phoneNumber: string;
  displayName?: string;
  connectedAt: string;
};

export type WhatsAppConfig = {
  connections?: WhatsAppConnection[];
};

export function toAppRecord(record: InstalledAppRecord): AppRecord {
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

export function isConvexMessage(error: unknown, message: string) {
  return error instanceof Error && error.message.includes(message);
}
