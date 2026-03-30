import {
  createShortLinkInConvex,
  getShortLinkByShortIdFromConvex,
  type CreatedShortLinkRecord,
  type CurrentUserIdentityRecord,
  type ShortLinkRecord,
} from "@tamias/app-data-convex";
import type { Database } from "../client";
import { cacheAcrossRequests } from "../utils/short-lived-cache";

type ConvexUserId = CurrentUserIdentityRecord["convexId"];

export type ShortLink = {
  id: string;
  shortId: string;
  url: string;
  teamId: string | null;
  userId: string | null;
  createdAt: string;
  fileName: string | null;
  teamName: string | null;
  type: "redirect" | "download" | null;
  size: number | null;
  mimeType: string | null;
  expiresAt: string | null;
};

function toShortLinkRecord(record: ShortLinkRecord) {
  return {
    id: record.id,
    shortId: record.shortId,
    url: record.url,
    teamId: record.teamId,
    userId: record.userId,
    createdAt: record.createdAt,
    fileName: record.fileName,
    teamName: record.teamName,
    type: record.type,
    size: record.size,
    mimeType: record.mimeType,
    expiresAt: record.expiresAt,
  };
}

function toCreatedShortLink(record: CreatedShortLinkRecord) {
  return {
    id: record.id,
    shortId: record.shortId,
    url: record.url,
    type: record.type,
    fileName: record.fileName,
    mimeType: record.mimeType,
    size: record.size,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
  };
}

async function getShortLinkByShortIdImpl(_db: Database, shortId: string) {
  const result = await getShortLinkByShortIdFromConvex({ shortId });

  return result ? toShortLinkRecord(result) : null;
}

export const getShortLinkByShortId = cacheAcrossRequests({
  keyPrefix: "short-link",
  keyFn: (shortId: string) => shortId,
  load: getShortLinkByShortIdImpl,
});

type CreateShortLinkData = {
  url: string;
  teamId: string;
  userId: ConvexUserId;
  type: "redirect" | "download";
  fileName?: string;
  mimeType?: string;
  size?: number;
  expiresAt?: string;
};

export async function createShortLink(_db: Database, data: CreateShortLinkData) {
  const result = await createShortLinkInConvex({
    url: data.url,
    teamId: data.teamId,
    userId: data.userId,
    type: data.type,
    fileName: data.fileName,
    mimeType: data.mimeType,
    size: data.size,
    expiresAt: data.expiresAt,
  });

  return toCreatedShortLink(result);
}
