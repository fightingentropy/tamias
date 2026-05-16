import { nanoid } from "nanoid";
import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "../../client";
import type { CreateReportParams, ReportLinkRecord, ReportType } from "./links";

type ReportLinkRow = {
  id: string;
  link_id: string;
  team_id: string;
  created_by_user_id: string | null;
  type: ReportType;
  from_date: string;
  to_date: string;
  currency: string | null;
  expire_at: string | null;
  created_at: string;
  updated_at: string;
};

export function getReportLinksD1(db: Database) {
  return requireCloudflareD1Database(db);
}

function toReportLinkRecord(row: ReportLinkRow): ReportLinkRecord {
  return {
    id: row.id,
    linkId: row.link_id,
    type: row.type,
    from: row.from_date,
    to: row.to_date,
    currency: row.currency,
    teamId: row.team_id,
    createdAt: row.created_at,
    expireAt: row.expire_at,
    teamName: null,
    teamLogoUrl: null,
  };
}

async function linkIdExists(d1: CloudflareD1DatabaseBinding, linkId: string) {
  const row = await d1
    .prepare("select link_id from report_links where link_id = ? limit 1")
    .bind(linkId)
    .first<{ link_id: string }>();

  return !!row;
}

export async function generateReportLinkIdInD1(d1: CloudflareD1DatabaseBinding) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const linkId = nanoid(21);

    if (!(await linkIdExists(d1, linkId))) {
      return linkId;
    }
  }

  throw new Error("Failed to generate a unique report link");
}

export async function insertReportLinkInD1(
  d1: CloudflareD1DatabaseBinding,
  params: CreateReportParams & { id: string; linkId: string },
) {
  const timestamp = new Date().toISOString();

  await d1
    .prepare(
      `insert into report_links (
        id,
        link_id,
        team_id,
        created_by_user_id,
        type,
        from_date,
        to_date,
        currency,
        expire_at,
        created_at,
        updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      params.id,
      params.linkId,
      params.teamId,
      params.createdByUserId,
      params.type,
      params.from,
      params.to,
      params.currency ?? null,
      params.expireAt ?? null,
      timestamp,
      timestamp,
    )
    .run();

  return getReportLinkByLinkIdFromD1(d1, params.linkId);
}

export async function getReportLinkByLinkIdFromD1(d1: CloudflareD1DatabaseBinding, linkId: string) {
  const row = await d1
    .prepare("select * from report_links where link_id = ? limit 1")
    .bind(linkId)
    .first<ReportLinkRow>();

  return row ? toReportLinkRecord(row) : null;
}
