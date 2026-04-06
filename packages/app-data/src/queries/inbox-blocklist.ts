import {
  createInboxBlocklistInConvex,
  deleteInboxBlocklistInConvex,
  getInboxBlocklistFromConvex,
  type InboxBlocklistRecord,
} from "@tamias/app-data-convex";
import type { Database } from "../client";
import { reuseQueryResult } from "../utils/request-cache";

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

function toInboxBlocklistEntry(
  record: InboxBlocklistRecord,
): InboxBlocklistEntry {
  return {
    id: record.id,
    teamId: record.teamId,
    type: record.type,
    value: record.value,
    createdAt: record.createdAt,
  };
}

async function getInboxBlocklistImpl(
  _db: Database,
  params: GetInboxBlocklistParams,
) {
  const results = await getInboxBlocklistFromConvex({
    teamId: params.teamId,
  });

  return results.map(toInboxBlocklistEntry);
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

export async function createInboxBlocklist(
  _db: Database,
  params: CreateInboxBlocklistParams,
) {
  const result = await createInboxBlocklistInConvex({
    teamId: params.teamId,
    type: params.type,
    value: params.value,
  });

  return toInboxBlocklistEntry(result);
}

export type DeleteInboxBlocklistParams = {
  id: string;
  teamId: string;
};

export async function deleteInboxBlocklist(
  _db: Database,
  params: DeleteInboxBlocklistParams,
) {
  const result = await deleteInboxBlocklistInConvex({
    id: params.id,
    teamId: params.teamId,
  });

  return result ? { id: result.id } : undefined;
}
