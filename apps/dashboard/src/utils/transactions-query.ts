import type { TransactionFilters } from "./transaction-filters";

type TransactionTab = "all" | "review";

export function buildTransactionsQueryFilter(args: {
  filter: TransactionFilters;
  sort?: string[] | null;
  tab?: TransactionTab | null;
}) {
  if (args.tab === "review") {
    return {
      sort: args.sort,
      fulfilled: true,
      exported: false,
    };
  }

  return {
    ...args.filter,
    amountRange: args.filter.amount_range ?? null,
    q: args.filter.q ?? null,
    sort: args.sort,
  };
}
