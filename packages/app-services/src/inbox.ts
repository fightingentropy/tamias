import type { Database } from "@tamias/app-data/client";
import {
  getInbox,
  type GetInboxParams,
} from "@tamias/app-data/queries/inbox";
import { getInboxAccounts } from "@tamias/app-data/queries/inbox-accounts";
import { getInboxBlocklist } from "@tamias/app-data/queries/inbox-blocklist";

export async function getInboxPage(args: {
  db: Database;
  teamId: string;
  input?: Omit<GetInboxParams, "teamId">;
}) {
  return getInbox(args.db, {
    teamId: args.teamId,
    ...args.input,
  });
}

export async function getInboxAccountsForTeam(teamId: string) {
  return getInboxAccounts(teamId);
}

export async function getInboxBlocklistForTeam(args: {
  db: Database;
  teamId: string;
}) {
  return getInboxBlocklist(args.db, {
    teamId: args.teamId,
  });
}
