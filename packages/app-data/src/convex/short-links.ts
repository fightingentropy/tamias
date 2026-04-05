import type { ConvexUserId } from "./base";
import { api, createClient, serviceArgs } from "./base";

export type ShortLinkRecord = {
  id: string;
  shortId: string;
  url: string;
  teamId: string | null;
  userId: ConvexUserId | null;
  createdAt: string;
  fileName: string | null;
  teamName: string | null;
  type: "redirect" | "download" | null;
  size: number | null;
  mimeType: string | null;
  expiresAt: string | null;
};

export type CreatedShortLinkRecord = {
  id: string;
  shortId: string;
  url: string;
  type: "redirect" | "download" | null;
  fileName: string | null;
  mimeType: string | null;
  size: number | null;
  createdAt: string;
  expiresAt: string | null;
};

export async function getShortLinkByShortIdFromConvex(args: {
  shortId: string;
}) {
  return createClient().query(
    api.shortLinks.serviceGetShortLinkByShortId,
    serviceArgs({
      shortId: args.shortId,
    }),
  ) as Promise<ShortLinkRecord | null>;
}

export async function createShortLinkInConvex(args: {
  teamId: string;
  userId: ConvexUserId;
  url: string;
  type: "redirect" | "download";
  fileName?: string;
  mimeType?: string;
  size?: number;
  expiresAt?: string;
}) {
  return createClient().mutation(
    api.shortLinks.serviceCreateShortLink,
    serviceArgs({
      publicTeamId: args.teamId,
      userId: args.userId,
      url: args.url,
      type: args.type,
      fileName: args.fileName,
      mimeType: args.mimeType,
      size: args.size,
      expiresAt: args.expiresAt,
    }),
  ) as Promise<CreatedShortLinkRecord>;
}
