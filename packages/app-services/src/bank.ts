import type { Database } from "@tamias/app-data/client";
import {
  type GetBankAccountsParams,
  getBankAccounts,
} from "@tamias/app-data/queries/bank-accounts";
import {
  type GetBankConnectionsParams,
  getBankConnections,
} from "@tamias/app-data/queries/bank-connections";

export async function getBankAccountsForTeam(args: {
  db: Database;
  teamId: string;
  input?: Omit<GetBankAccountsParams, "teamId">;
}) {
  return getBankAccounts(args.db, {
    teamId: args.teamId,
    ...args.input,
  });
}

export async function getBankConnectionsForTeam(args: {
  db: Database;
  teamId: string;
  input?: Omit<GetBankConnectionsParams, "teamId">;
}) {
  return getBankConnections(args.db, {
    teamId: args.teamId,
    ...args.input,
  });
}
