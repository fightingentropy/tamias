import type { Database } from "../../../client";
import { getTransactionsPageFromD1, requireTransactionsD1 } from "../../transactions/d1";
import type { GetInsightActivityDataParams } from "./types";

const ACTIVITY_PAGE_SIZE = 200;

type TransactionActivityStats = {
  categorizedCount: number;
};

async function countCategorizedTransactionsByDateRange(args: {
  db: Database;
  teamId: string;
  from: string;
  to: string;
}) {
  let cursor: string | null = null;
  let categorizedCount = 0;

  while (true) {
    const page = await getTransactionsPageFromD1(requireTransactionsD1(args.db), {
      teamId: args.teamId,
      cursor,
      pageSize: ACTIVITY_PAGE_SIZE,
      order: "desc",
      dateGte: args.from,
    });

    for (const transaction of page.page) {
      if (transaction.date > args.to) {
        continue;
      }

      if (transaction.date < args.from) {
        return categorizedCount;
      }

      if (transaction.categorySlug !== null) {
        categorizedCount += 1;
      }
    }

    if (page.isDone) {
      return categorizedCount;
    }

    cursor = page.continueCursor;
  }
}

export async function getTransactionActivityStats(
  db: Database,
  params: GetInsightActivityDataParams,
): Promise<TransactionActivityStats> {
  const { teamId, from, to } = params;

  return {
    categorizedCount: await countCategorizedTransactionsByDateRange({
      db,
      teamId,
      from,
      to,
    }),
  };
}
