import { getTransactionsPageFromConvex } from "@tamias/app-data-convex";
import type { Database } from "../../../client";
import type { GetInsightActivityDataParams } from "./types";

const ACTIVITY_PAGE_SIZE = 200;

type TransactionActivityStats = {
  categorizedCount: number;
};

async function countCategorizedTransactionsByDateRange(args: {
  teamId: string;
  from: string;
  to: string;
}) {
  let cursor: string | null = null;
  let categorizedCount = 0;

  while (true) {
    const page = await getTransactionsPageFromConvex({
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
  _db: Database,
  params: GetInsightActivityDataParams,
): Promise<TransactionActivityStats> {
  const { teamId, from, to } = params;

  return {
    categorizedCount: await countCategorizedTransactionsByDateRange({
      teamId,
      from,
      to,
    }),
  };
}
