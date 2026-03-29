import "server-only";

import {
  getInboxAccountsForTeam,
  getInboxBlocklistForTeam,
  getInboxPage,
} from "@tamias/app-services/inbox";
import type { GetInboxParams } from "@tamias/app-data/queries/inbox";
import { cache } from "react";
import { getCurrentSession, getRequestDb } from "./context";

export const getInboxLocally = cache(
  async (input: Omit<GetInboxParams, "teamId"> = {}) => {
    const [session, requestDb] = await Promise.all([
      getCurrentSession(),
      getRequestDb(),
    ]);

    if (!session?.teamId) {
      return {
        meta: {
          cursor: undefined,
          hasPreviousPage: false,
          hasNextPage: false,
        },
        data: [],
      };
    }

    return getInboxPage({
      db: requestDb,
      teamId: session.teamId,
      input,
    });
  },
);

export const getInboxAccountsLocally = cache(async () => {
  const session = await getCurrentSession();

  if (!session?.teamId) {
    return [];
  }

  return getInboxAccountsForTeam(session.teamId);
});

export const getInboxBlocklistLocally = cache(async () => {
  const [session, requestDb] = await Promise.all([
    getCurrentSession(),
    getRequestDb(),
  ]);

  if (!session?.teamId) {
    return [];
  }

  return getInboxBlocklistForTeam({
    db: requestDb,
    teamId: session.teamId,
  });
});
