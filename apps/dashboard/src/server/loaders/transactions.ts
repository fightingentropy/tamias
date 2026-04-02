
import {
  getTransactionCategoriesForTeam,
  getTransactionsPage,
  getTransactionsReviewCount,
} from "@tamias/app-services/transactions";
import type { GetCategoriesParams } from "@tamias/app-data/queries";
import type { GetTransactionsParams } from "@tamias/app-data/queries/transactions";
import { cache } from "react";
import { getCurrentSession, getRequestDb } from "./context";

export const getTransactionCategoriesLocally = cache(
  async (input?: Omit<GetCategoriesParams, "teamId">) => {
    const [session, requestDb] = await Promise.all([
      getCurrentSession(),
      getRequestDb(),
    ]);

    if (!session?.teamId) {
      return [];
    }

    return getTransactionCategoriesForTeam({
      db: requestDb,
      teamId: session.teamId,
      input,
    });
  },
);

export const getTransactionsLocally = cache(
  async (input: Omit<GetTransactionsParams, "teamId"> = {}) => {
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

    return getTransactionsPage({
      db: requestDb,
      teamId: session.teamId,
      input,
    });
  },
);

export const getTransactionsReviewCountLocally = cache(async () => {
  const [session, requestDb] = await Promise.all([
    getCurrentSession(),
    getRequestDb(),
  ]);

  if (!session?.teamId) {
    return 0;
  }

  return getTransactionsReviewCount({
    db: requestDb,
    teamId: session.teamId,
  });
});
