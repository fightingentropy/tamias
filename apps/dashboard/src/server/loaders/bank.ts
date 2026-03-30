import "server-only";

import { getBankAccounts } from "@tamias/app-data/queries/bank-accounts";
import { getBankConnections } from "@tamias/app-data/queries/bank-connections";
import { cache } from "react";
import { getCurrentSession, getRequestDb } from "./context";

export const getBankConnectionsLocally = cache(async (enabled?: boolean) => {
  const [session, requestDb] = await Promise.all([
    getCurrentSession(),
    getRequestDb(),
  ]);

  if (!session?.teamId) {
    return [];
  }

  return getBankConnections(requestDb, {
    teamId: session.teamId,
    enabled,
  });
});

export const getBankAccountsLocally = cache(
  async ({ enabled, manual }: { enabled?: boolean; manual?: boolean } = {}) => {
    const [session, requestDb] = await Promise.all([
      getCurrentSession(),
      getRequestDb(),
    ]);

    if (!session?.teamId) {
      return [];
    }

    return getBankAccounts(requestDb, {
      teamId: session.teamId,
      enabled,
      manual,
    });
  },
);
