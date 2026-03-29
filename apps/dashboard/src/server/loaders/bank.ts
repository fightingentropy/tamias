import "server-only";

import {
  getBankAccountsForTeam,
  getBankConnectionsForTeam,
} from "@tamias/app-services/bank";
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

  return getBankConnectionsForTeam({
    db: requestDb,
    teamId: session.teamId,
    input: { enabled },
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

    return getBankAccountsForTeam({
      db: requestDb,
      teamId: session.teamId,
      input: {
        enabled,
        manual,
      },
    });
  },
);
