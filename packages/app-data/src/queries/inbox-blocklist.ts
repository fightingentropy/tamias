import type { Database } from "../client";
import { reuseQueryResult } from "../utils/request-cache";
import {
  createInboxBlocklistInD1,
  getInboxBlocklistD1,
  getInboxBlocklistFromD1,
  deleteInboxBlocklistRecordFromD1,
} from "./inbox-blocklist/d1";

export type GetInboxBlocklistParams = {
  teamId: string;
};

export type InboxBlocklistEntry = {
  id: string;
  teamId: string;
  type: "email" | "domain";
  value: string;
  createdAt: string;
};

export type InboxBlocklistRecord = InboxBlocklistEntry;

function toInboxBlocklistEntry(record: InboxBlocklistRecord): InboxBlocklistEntry {
  return {
    id: record.id,
    teamId: record.teamId,
    type: record.type,
    value: record.value,
    createdAt: record.createdAt,
  };
}

async function getInboxBlocklistImpl(db: Database, params: GetInboxBlocklistParams) {
  const d1 = getInboxBlocklistD1(db);

  if (!d1) {
    throw new Error("Inbox blocklist requires Cloudflare D1");
  }

  return (await getInboxBlocklistFromD1(d1, params)).map(toInboxBlocklistEntry);
}

export const getInboxBlocklist = reuseQueryResult({
  keyPrefix: "inbox-blocklist",
  keyFn: (params: GetInboxBlocklistParams) => params.teamId,
  load: getInboxBlocklistImpl,
});

export type CreateInboxBlocklistParams = {
  teamId: string;
  type: "email" | "domain";
  value: string;
};

export async function createInboxBlocklist(db: Database, params: CreateInboxBlocklistParams) {
  const d1 = getInboxBlocklistD1(db);

  if (!d1) {
    throw new Error("Inbox blocklist requires Cloudflare D1");
  }

  return toInboxBlocklistEntry(await createInboxBlocklistInD1(d1, params));
}

export type DeleteInboxBlocklistParams = {
  id: string;
  teamId: string;
};

export async function deleteInboxBlocklist(db: Database, params: DeleteInboxBlocklistParams) {
  const d1 = getInboxBlocklistD1(db);

  if (!d1) {
    throw new Error("Inbox blocklist requires Cloudflare D1");
  }

  const result = await deleteInboxBlocklistRecordFromD1(d1, params);
  return result ? { id: result.id } : undefined;
}
