import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "../client";
import { reuseQueryResult } from "../utils/request-cache";

type ShortLinkType = "redirect" | "download";

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

type ShortLinkRow = {
  id: string;
  short_id: string;
  url: string;
  team_id: string | null;
  user_id: string | null;
  team_name: string | null;
  type: ShortLinkType | null;
  size: number | null;
  mime_type: string | null;
  file_name: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

const SHORT_ID_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz-";

function generateShortId(length = 21) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);

  return Array.from(bytes, (byte) => SHORT_ID_ALPHABET[byte & 63]).join("");
}

function toShortLinkRecordFromD1(row: ShortLinkRow): ShortLink {
  return {
    id: row.id,
    shortId: row.short_id,
    url: row.url,
    teamId: row.team_id,
    userId: row.user_id,
    createdAt: row.created_at,
    fileName: row.file_name,
    teamName: row.team_name,
    type: row.type,
    size: row.size,
    mimeType: row.mime_type,
    expiresAt: row.expires_at,
  };
}

async function getShortLinkByShortIdFromD1(d1: CloudflareD1DatabaseBinding, shortId: string) {
  const row = await d1
    .prepare("select * from short_links where short_id = ? limit 1")
    .bind(shortId)
    .first<ShortLinkRow>();

  return row ? toShortLinkRecordFromD1(row) : null;
}

async function getShortLinkByShortIdImpl(db: Database, shortId: string) {
  return getShortLinkByShortIdFromD1(requireCloudflareD1Database(db), shortId);
}

export const getShortLinkByShortId = reuseQueryResult({
  keyPrefix: "short-link",
  keyFn: (shortId: string) => shortId,
  load: getShortLinkByShortIdImpl,
});

type CreateShortLinkData = {
  url: string;
  teamId: string;
  userId: string;
  type: ShortLinkType;
  fileName?: string;
  mimeType?: string;
  size?: number;
  expiresAt?: string;
  teamName?: string | null;
};

async function createShortLinkInD1(d1: CloudflareD1DatabaseBinding, data: CreateShortLinkData) {
  const timestamp = new Date().toISOString();

  for (let attempt = 0; attempt < 5; attempt++) {
    const id = crypto.randomUUID();
    const shortId = generateShortId();
    const existing = await getShortLinkByShortIdFromD1(d1, shortId);

    if (existing) {
      continue;
    }

    await d1
      .prepare(
        `insert into short_links (
          id,
          short_id,
          url,
          team_id,
          user_id,
          team_name,
          type,
          size,
          mime_type,
          file_name,
          expires_at,
          created_at,
          updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        shortId,
        data.url,
        data.teamId,
        data.userId,
        data.teamName ?? null,
        data.type,
        data.size ?? null,
        data.mimeType ?? null,
        data.fileName ?? null,
        data.expiresAt ?? null,
        timestamp,
        timestamp,
      )
      .run();

    const inserted = await getShortLinkByShortIdFromD1(d1, shortId);

    if (inserted) {
      return {
        id: inserted.id,
        shortId: inserted.shortId,
        url: inserted.url,
        type: inserted.type,
        fileName: inserted.fileName,
        mimeType: inserted.mimeType,
        size: inserted.size,
        createdAt: inserted.createdAt,
        expiresAt: inserted.expiresAt,
      };
    }
  }

  throw new Error("Failed to generate a unique short link");
}

export async function createShortLink(db: Database, data: CreateShortLinkData) {
  return createShortLinkInD1(requireCloudflareD1Database(db), data);
}
