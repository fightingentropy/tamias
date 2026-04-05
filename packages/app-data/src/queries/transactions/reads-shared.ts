import type { TransactionStatus } from "../../convex";

export type GetTransactionsParams = {
  teamId: string;
  cursor?: string | null;
  sort?: string[] | null;
  pageSize?: number;
  q?: string | null;
  statuses?:
    | (
        | "blank"
        | "receipt_match"
        | "in_review"
        | "export_error"
        | "exported"
        | "excluded"
        | "archived"
      )[]
    | null;
  attachments?: "include" | "exclude" | null;
  categories?: string[] | null;
  tags?: string[] | null;
  accounts?: string[] | null;
  assignees?: string[] | null;
  type?: "income" | "expense" | null;
  start?: string | null;
  end?: string | null;
  recurring?: string[] | null;
  amountRange?: number[] | null;
  amount?: string[] | null;
  manual?: "include" | "exclude" | null;
  exported?: boolean | null;
  fulfilled?: boolean | null;
};

export function buildTransactionsPageMeta(args: {
  cursor: string | null | undefined;
  nextCursor: string | null | undefined;
  hasNextPage: boolean;
}) {
  return {
    cursor: args.nextCursor ?? undefined,
    hasPreviousPage: Boolean(args.cursor),
    hasNextPage: args.hasNextPage,
  };
}

export function buildEmptyProcessedTransactionPage(args?: {
  cursor?: string | null;
  nextCursor?: string | null;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
}) {
  return {
    meta: {
      cursor: args?.nextCursor ?? undefined,
      hasPreviousPage: args?.hasPreviousPage ?? Boolean(args?.cursor),
      hasNextPage: args?.hasNextPage ?? false,
    },
    data: [],
  };
}

export function getConvexStatusesNotIn(args: {
  statuses?: GetTransactionsParams["statuses"];
  exported?: boolean | null;
}): TransactionStatus[] {
  const requestedStatuses = new Set(args.statuses ?? []);
  const statusesNotIn: TransactionStatus[] = [];

  if (!requestedStatuses.has("excluded")) {
    statusesNotIn.push("excluded");
  }

  if (!requestedStatuses.has("archived")) {
    statusesNotIn.push("archived");
  }

  if (args.exported !== true && !requestedStatuses.has("exported")) {
    statusesNotIn.push("exported");
  }

  return statusesNotIn;
}

export function getIndexedPageOrder(sort: GetTransactionsParams["sort"]) {
  if (!sort || sort.length === 0) {
    return "desc" as const;
  }

  if (sort.length !== 2) {
    return null;
  }

  const [column, direction] = sort;

  if (column !== "date" || (direction !== "asc" && direction !== "desc")) {
    return null;
  }

  return direction;
}

export function canUseIndexedTransactionPage(args: {
  sort: GetTransactionsParams["sort"];
  q: GetTransactionsParams["q"];
  statuses: GetTransactionsParams["statuses"];
  attachments: GetTransactionsParams["attachments"];
  categories: GetTransactionsParams["categories"];
  tags: GetTransactionsParams["tags"];
  accounts: GetTransactionsParams["accounts"];
  assignees: GetTransactionsParams["assignees"];
  type: GetTransactionsParams["type"];
  end: GetTransactionsParams["end"];
  recurring: GetTransactionsParams["recurring"];
  amountRange: GetTransactionsParams["amountRange"];
  amount: GetTransactionsParams["amount"];
  manual: GetTransactionsParams["manual"];
  exported: GetTransactionsParams["exported"];
  fulfilled: GetTransactionsParams["fulfilled"];
}) {
  return (
    getIndexedPageOrder(args.sort) !== null &&
    !args.q &&
    !args.statuses?.length &&
    !args.attachments &&
    !args.categories?.length &&
    !args.tags?.length &&
    !args.accounts?.length &&
    !args.assignees?.length &&
    !args.type &&
    !args.end &&
    !args.recurring?.length &&
    !args.amountRange?.length &&
    !args.amount?.length &&
    !args.manual &&
    args.exported !== true &&
    args.fulfilled == null
  );
}

export function canUseIndexedTaggedTransactionPage(args: {
  sort: GetTransactionsParams["sort"];
  q: GetTransactionsParams["q"];
  statuses: GetTransactionsParams["statuses"];
  attachments: GetTransactionsParams["attachments"];
  categories: GetTransactionsParams["categories"];
  tags: GetTransactionsParams["tags"];
  accounts: GetTransactionsParams["accounts"];
  assignees: GetTransactionsParams["assignees"];
  type: GetTransactionsParams["type"];
  recurring: GetTransactionsParams["recurring"];
  amountRange: GetTransactionsParams["amountRange"];
  amount: GetTransactionsParams["amount"];
  manual: GetTransactionsParams["manual"];
  exported: GetTransactionsParams["exported"];
  fulfilled: GetTransactionsParams["fulfilled"];
}) {
  return (
    getIndexedPageOrder(args.sort) !== null &&
    !args.q &&
    !args.statuses?.length &&
    !args.attachments &&
    !args.categories?.length &&
    Boolean(args.tags?.length) &&
    !args.accounts?.length &&
    !args.assignees?.length &&
    !args.type &&
    !args.recurring?.length &&
    !args.amountRange?.length &&
    !args.amount?.length &&
    !args.manual &&
    args.exported !== true &&
    args.fulfilled == null
  );
}

export function canUseIndexedReviewTransactionPage(args: {
  sort: GetTransactionsParams["sort"];
  q: GetTransactionsParams["q"];
  statuses: GetTransactionsParams["statuses"];
  attachments: GetTransactionsParams["attachments"];
  categories: GetTransactionsParams["categories"];
  tags: GetTransactionsParams["tags"];
  accounts: GetTransactionsParams["accounts"];
  assignees: GetTransactionsParams["assignees"];
  type: GetTransactionsParams["type"];
  start: GetTransactionsParams["start"];
  end: GetTransactionsParams["end"];
  recurring: GetTransactionsParams["recurring"];
  amountRange: GetTransactionsParams["amountRange"];
  amount: GetTransactionsParams["amount"];
  manual: GetTransactionsParams["manual"];
  exported: GetTransactionsParams["exported"];
  fulfilled: GetTransactionsParams["fulfilled"];
}) {
  return (
    getIndexedPageOrder(args.sort) !== null &&
    !args.q &&
    !args.statuses?.length &&
    !args.attachments &&
    !args.categories?.length &&
    !args.tags?.length &&
    !args.accounts?.length &&
    !args.assignees?.length &&
    !args.type &&
    !args.start &&
    !args.end &&
    !args.recurring?.length &&
    !args.amountRange?.length &&
    !args.amount?.length &&
    !args.manual &&
    args.exported === false &&
    args.fulfilled === true
  );
}
