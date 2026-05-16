import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "../../client";

export type InboxItemStatus =
  | "new"
  | "archived"
  | "processing"
  | "done"
  | "pending"
  | "analyzing"
  | "suggested_match"
  | "no_match"
  | "other"
  | "deleted";

export type InboxItemType = "invoice" | "expense" | "other";

export type InboxItemRecord = {
  id: string;
  teamId: string;
  createdAt: string;
  updatedAt: string;
  filePath: string[];
  fileName: string | null;
  transactionId: string | null;
  amount: number | null;
  currency: string | null;
  contentType: string | null;
  size: number | null;
  attachmentId: string | null;
  date: string | null;
  forwardedTo: string | null;
  referenceId: string | null;
  meta: Record<string, unknown> | null;
  status: InboxItemStatus;
  website: string | null;
  senderEmail: string | null;
  displayName: string | null;
  type: InboxItemType | null;
  description: string | null;
  baseAmount: number | null;
  baseCurrency: string | null;
  taxAmount: number | null;
  taxRate: number | null;
  taxType: string | null;
  inboxAccountId: string | null;
  invoiceNumber: string | null;
  groupedInboxId: string | null;
};

export type MatchSuggestionStatus = "pending" | "confirmed" | "declined" | "expired" | "unmatched";

export type MatchSuggestionType = "auto_matched" | "high_confidence" | "suggested";

export type TransactionMatchSuggestionRecord = {
  id: string;
  teamId: string;
  inboxId: string;
  transactionId: string;
  normalizedInboxName: string | null;
  normalizedTransactionName: string | null;
  confidenceScore: number;
  amountScore: number | null;
  currencyScore: number | null;
  dateScore: number | null;
  nameScore: number | null;
  matchType: MatchSuggestionType;
  matchDetails: Record<string, unknown> | null;
  status: MatchSuggestionStatus;
  userActionAt: string | null;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InboxLiabilityAggregateRowRecord = {
  date: string;
  currency: string | null;
  totalAmount: number;
  itemCount: number;
  updatedAt: string;
};

export type UpsertInboxItemInput = {
  teamId: string;
  id?: string;
  createdAt?: string;
  updatedAt?: string;
  filePath: string[];
  fileName?: string | null;
  transactionId?: string | null;
  amount?: number | null;
  currency?: string | null;
  contentType?: string | null;
  size?: number | null;
  attachmentId?: string | null;
  date?: string | null;
  forwardedTo?: string | null;
  referenceId?: string | null;
  meta?: Record<string, unknown> | null;
  status: InboxItemStatus;
  website?: string | null;
  senderEmail?: string | null;
  displayName?: string | null;
  type?: InboxItemType | null;
  description?: string | null;
  baseAmount?: number | null;
  baseCurrency?: string | null;
  taxAmount?: number | null;
  taxRate?: number | null;
  taxType?: string | null;
  inboxAccountId?: string | null;
  invoiceNumber?: string | null;
  groupedInboxId?: string | null;
};

export type UpsertTransactionMatchSuggestionInput = {
  teamId: string;
  id?: string;
  inboxId: string;
  transactionId: string;
  confidenceScore: number;
  amountScore?: number | null;
  currencyScore?: number | null;
  dateScore?: number | null;
  nameScore?: number | null;
  matchType: MatchSuggestionType;
  matchDetails?: Record<string, unknown> | null;
  status: MatchSuggestionStatus;
  userActionAt?: string | null;
  userId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type InboxItemRow = {
  id: string;
  team_id: string;
  created_at: string;
  updated_at: string;
  file_path: string;
  file_name: string | null;
  transaction_id: string | null;
  amount: number | null;
  currency: string | null;
  content_type: string | null;
  size: number | null;
  attachment_id: string | null;
  date: string | null;
  forwarded_to: string | null;
  reference_id: string | null;
  meta: string | null;
  status: InboxItemStatus;
  website: string | null;
  sender_email: string | null;
  display_name: string | null;
  type: InboxItemType | null;
  description: string | null;
  base_amount: number | null;
  base_currency: string | null;
  tax_amount: number | null;
  tax_rate: number | null;
  tax_type: string | null;
  inbox_account_id: string | null;
  invoice_number: string | null;
  grouped_inbox_id: string | null;
};

type SuggestionRow = {
  id: string;
  team_id: string;
  inbox_id: string;
  transaction_id: string;
  normalized_inbox_name: string | null;
  normalized_transaction_name: string | null;
  confidence_score: number;
  amount_score: number | null;
  currency_score: number | null;
  date_score: number | null;
  name_score: number | null;
  match_type: MatchSuggestionType;
  match_details: string | null;
  status: MatchSuggestionStatus;
  user_action_at: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
};

const INBOX_STATUSES: InboxItemStatus[] = [
  "new",
  "archived",
  "processing",
  "done",
  "pending",
  "analyzing",
  "suggested_match",
  "no_match",
  "other",
  "deleted",
];

function inboxFilePathKey(filePath: string[]) {
  return filePath.join("\u0000");
}

function parseJson<T>(value: string | null): T | null {
  if (!value) return null;
  return JSON.parse(value) as T;
}

function buildSearchIndexText(values: Array<string | null | undefined>) {
  return values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
}

function buildSearchQuery(query: string) {
  return query
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s.-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => `${term.replace(/"/g, '""')}*`)
    .join(" ");
}

function isInboxItemSearchEligible(item: {
  status: InboxItemStatus;
  type?: InboxItemType | null;
  transactionId?: string | null;
}) {
  return (
    item.status !== "deleted" &&
    item.status !== "other" &&
    item.type !== "other" &&
    !item.transactionId
  );
}

async function syncInboxItemSearchIndex(
  d1: CloudflareD1DatabaseBinding,
  item: {
    id: string;
    teamId: string;
    searchText: string;
    searchEligible: boolean;
  },
) {
  await d1.prepare("delete from inbox_items_fts where id = ?").bind(item.id).run();

  if (!item.searchEligible || item.searchText.length === 0) {
    return;
  }

  await d1
    .prepare("insert into inbox_items_fts (id, team_id, search_text) values (?, ?, ?)")
    .bind(item.id, item.teamId, item.searchText)
    .run();
}

function normalizeSuggestionLearningName(input: string | null | undefined) {
  if (!input) return "";
  return input
    .toLowerCase()
    .replace(/[.,\-_'"()&]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toInboxItemRecord(row: InboxItemRow): InboxItemRecord {
  return {
    id: row.id,
    teamId: row.team_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    filePath: parseJson<string[]>(row.file_path) ?? [],
    fileName: row.file_name,
    transactionId: row.transaction_id,
    amount: row.amount,
    currency: row.currency,
    contentType: row.content_type,
    size: row.size,
    attachmentId: row.attachment_id,
    date: row.date,
    forwardedTo: row.forwarded_to,
    referenceId: row.reference_id,
    meta: parseJson<Record<string, unknown>>(row.meta),
    status: row.status,
    website: row.website,
    senderEmail: row.sender_email,
    displayName: row.display_name,
    type: row.type,
    description: row.description,
    baseAmount: row.base_amount,
    baseCurrency: row.base_currency,
    taxAmount: row.tax_amount,
    taxRate: row.tax_rate,
    taxType: row.tax_type,
    inboxAccountId: row.inbox_account_id,
    invoiceNumber: row.invoice_number,
    groupedInboxId: row.grouped_inbox_id,
  };
}

function toSuggestionRecord(row: SuggestionRow): TransactionMatchSuggestionRecord {
  return {
    id: row.id,
    teamId: row.team_id,
    inboxId: row.inbox_id,
    transactionId: row.transaction_id,
    normalizedInboxName: row.normalized_inbox_name,
    normalizedTransactionName: row.normalized_transaction_name,
    confidenceScore: row.confidence_score,
    amountScore: row.amount_score,
    currencyScore: row.currency_score,
    dateScore: row.date_score,
    nameScore: row.name_score,
    matchType: row.match_type,
    matchDetails: parseJson<Record<string, unknown>>(row.match_details),
    status: row.status,
    userActionAt: row.user_action_at,
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function encodeCursor(row: Pick<InboxItemRow | SuggestionRow, "created_at" | "id">) {
  return encodeURIComponent(JSON.stringify([row.created_at, row.id]));
}

function decodeCursor(cursor?: string | null): [string, string] | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(cursor));
    return Array.isArray(parsed) && typeof parsed[0] === "string" && typeof parsed[1] === "string"
      ? [parsed[0], parsed[1]]
      : null;
  } catch {
    return null;
  }
}

function applyCreatedAtRange(filters: string[], values: unknown[], params: {
  createdAtFrom?: string | null;
  createdAtTo?: string | null;
}) {
  if (params.createdAtFrom) {
    filters.push("created_at >= ?");
    values.push(params.createdAtFrom);
  }

  if (params.createdAtTo) {
    filters.push("created_at <= ?");
    values.push(params.createdAtTo);
  }
}

export function requireInboxItemsD1(db: Database) {
  return requireCloudflareD1Database(db);
}

export async function getInboxItemsFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    ids?: string[];
    referenceIds?: string[];
    groupedInboxIds?: string[];
    transactionIds?: string[];
    invoiceNumber?: string | null;
    date?: string | null;
    filePath?: string[];
    statuses?: InboxItemStatus[];
  },
) {
  const filters = ["team_id = ?"];
  const values: unknown[] = [args.teamId];

  if (args.ids && args.ids.length > 0) {
    filters.push(`id in (${args.ids.map(() => "?").join(", ")})`);
    values.push(...new Set(args.ids));
  } else if (args.referenceIds && args.referenceIds.length > 0) {
    filters.push(`reference_id in (${args.referenceIds.map(() => "?").join(", ")})`);
    values.push(...new Set(args.referenceIds));
  } else if (args.groupedInboxIds && args.groupedInboxIds.length > 0) {
    filters.push(`grouped_inbox_id in (${args.groupedInboxIds.map(() => "?").join(", ")})`);
    values.push(...new Set(args.groupedInboxIds));
  } else if (args.transactionIds && args.transactionIds.length > 0) {
    filters.push(`transaction_id in (${args.transactionIds.map(() => "?").join(", ")})`);
    values.push(...new Set(args.transactionIds));
  } else if (args.invoiceNumber) {
    filters.push("invoice_number = ?");
    values.push(args.invoiceNumber);
  } else if (args.date) {
    filters.push("date = ?");
    values.push(args.date);
  } else if (args.filePath && args.filePath.length > 0) {
    filters.push("file_path_key = ?");
    values.push(inboxFilePathKey(args.filePath));
  }

  if (args.statuses && args.statuses.length > 0) {
    filters.push(`status in (${args.statuses.map(() => "?").join(", ")})`);
    values.push(...args.statuses);
  }

  const { results = [] } = await d1
    .prepare(
      `select *
       from inbox_items
       where ${filters.join(" and ")}
       order by created_at desc, id desc`,
    )
    .bind(...values)
    .all<InboxItemRow>();

  return results.map(toInboxItemRecord);
}

export async function getInboxItemByIdFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: { teamId: string; inboxId: string },
) {
  const row = await d1
    .prepare("select * from inbox_items where id = ? and team_id = ? limit 1")
    .bind(args.inboxId, args.teamId)
    .first<InboxItemRow>();

  return row ? toInboxItemRecord(row) : null;
}

export async function getInboxItemInfoFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: { inboxId: string },
) {
  const row = await d1
    .prepare("select * from inbox_items where id = ? limit 1")
    .bind(args.inboxId)
    .first<InboxItemRow>();

  return row ? toInboxItemRecord(row) : null;
}

export async function searchInboxItemsFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: { teamId: string; query: string; limit?: number },
) {
  const searchQuery = buildSearchQuery(args.query);

  if (!searchQuery) {
    return [];
  }

  const { results = [] } = await d1
    .prepare(
      `select inbox_items.*
       from inbox_items_fts
       join inbox_items on inbox_items.id = inbox_items_fts.id
       where inbox_items_fts match ?
         and inbox_items.team_id = ?
         and inbox_items.search_eligible = 1
       order by rank
       limit ?`,
    )
    .bind(searchQuery, args.teamId, Math.max(1, Math.min(args.limit ?? 100, 400)))
    .all<InboxItemRow>();

  return results.map(toInboxItemRecord);
}

export async function getInboxItemsByAmountRangeFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: { teamId: string; minAmount: number; maxAmount: number; limit?: number },
) {
  const { results = [] } = await d1
    .prepare(
      `select *
       from inbox_items
       where team_id = ?
         and search_eligible = 1
         and search_amount >= ?
         and search_amount <= ?
       order by created_at desc, id desc
       limit ?`,
    )
    .bind(args.teamId, args.minAmount, args.maxAmount, Math.max(1, Math.min(args.limit ?? 100, 400)))
    .all<InboxItemRow>();

  return results.map(toInboxItemRecord);
}

export async function getInboxItemsPageFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    cursor?: string | null;
    pageSize: number;
    status?: InboxItemStatus;
    order?: "asc" | "desc";
    createdAtFrom?: string | null;
    createdAtTo?: string | null;
  },
) {
  const order = args.order === "asc" ? "asc" : "desc";
  const cursor = decodeCursor(args.cursor);
  const filters = ["team_id = ?"];
  const values: unknown[] = [args.teamId];

  if (args.status) {
    filters.push("status = ?");
    values.push(args.status);
  }

  applyCreatedAtRange(filters, values, args);

  if (cursor) {
    filters.push(
      order === "asc" ? "(created_at, id) > (?, ?)" : "(created_at, id) < (?, ?)",
    );
    values.push(cursor[0], cursor[1]);
  }

  const { results = [] } = await d1
    .prepare(
      `select *
       from inbox_items
       where ${filters.join(" and ")}
       order by created_at ${order}, id ${order}
       limit ?`,
    )
    .bind(...values, args.pageSize + 1)
    .all<InboxItemRow>();
  const pageRows = results.slice(0, args.pageSize);

  return {
    page: pageRows.map(toInboxItemRecord),
    isDone: results.length <= args.pageSize,
    continueCursor: pageRows.length > 0 ? encodeCursor(pageRows[pageRows.length - 1]!) : "",
  };
}

export async function getInboxItemsByDatePageFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    cursor?: string | null;
    pageSize: number;
    order?: "asc" | "desc";
    dateGte?: string | null;
    dateLte?: string | null;
  },
) {
  const order = args.order === "asc" ? "asc" : "desc";
  const cursor = decodeCursor(args.cursor);
  const filters = ["team_id = ?"];
  const values: unknown[] = [args.teamId];

  if (args.dateGte) {
    filters.push("date >= ?");
    values.push(args.dateGte);
  }

  if (args.dateLte) {
    filters.push("date <= ?");
    values.push(args.dateLte);
  }

  if (cursor) {
    filters.push(order === "asc" ? "(date, id) > (?, ?)" : "(date, id) < (?, ?)");
    values.push(cursor[0], cursor[1]);
  }

  const { results = [] } = await d1
    .prepare(
      `select *
       from inbox_items
       where ${filters.join(" and ")}
       order by date ${order}, id ${order}
       limit ?`,
    )
    .bind(...values, args.pageSize + 1)
    .all<InboxItemRow>();
  const pageRows = results.slice(0, args.pageSize);

  return {
    page: pageRows.map(toInboxItemRecord),
    isDone: results.length <= args.pageSize,
    continueCursor: pageRows.length > 0 ? encodeCursor({
      created_at: pageRows[pageRows.length - 1]!.date ?? "",
      id: pageRows[pageRows.length - 1]!.id,
    }) : "",
  };
}

export async function getPendingInboxItemsToNoMatchFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: { createdAtTo: string; cursor?: string | null; pageSize: number },
) {
  const cursor = decodeCursor(args.cursor);
  const filters = ["status = 'pending'", "transaction_id is null", "created_at <= ?"];
  const values: unknown[] = [args.createdAtTo];

  if (cursor) {
    filters.push("(created_at, id) < (?, ?)");
    values.push(cursor[0], cursor[1]);
  }

  const { results = [] } = await d1
    .prepare(
      `select *
       from inbox_items
       where ${filters.join(" and ")}
       order by created_at desc, id desc
       limit ?`,
    )
    .bind(...values, args.pageSize + 1)
    .all<InboxItemRow>();
  const pageRows = results.slice(0, args.pageSize);

  return {
    page: pageRows.map(toInboxItemRecord),
    isDone: results.length <= args.pageSize,
    continueCursor: pageRows.length > 0 ? encodeCursor(pageRows[pageRows.length - 1]!) : "",
  };
}

export async function upsertInboxItemsInD1(
  d1: CloudflareD1DatabaseBinding,
  args: { items: UpsertInboxItemInput[] },
) {
  const results: InboxItemRecord[] = [];

  for (const item of args.items) {
    const now = new Date().toISOString();
    const existing =
      item.id
        ? await getInboxItemByIdFromD1(d1, { teamId: item.teamId, inboxId: item.id })
        : item.referenceId
          ? (
              await getInboxItemsFromD1(d1, {
                teamId: item.teamId,
                referenceIds: [item.referenceId],
              })
            )[0] ?? null
          : null;
    const id = existing?.id ?? item.id ?? crypto.randomUUID();
    const createdAt = item.createdAt ?? existing?.createdAt ?? now;
    const updatedAt = item.updatedAt ?? now;
    const searchEligible = isInboxItemSearchEligible(item);
    const searchText = buildSearchIndexText([
      item.displayName,
      item.fileName,
      item.description,
      item.website,
      item.senderEmail,
      item.invoiceNumber,
    ]);
    const amount = item.amount ?? null;
    const searchAmount = amount === null ? null : Math.round(Math.abs(amount) * 100);

    await d1
      .prepare(
        `insert into inbox_items (
          id,
          team_id,
          created_at,
          updated_at,
          file_path,
          file_path_key,
          file_name,
          transaction_id,
          amount,
          currency,
          content_type,
          size,
          attachment_id,
          date,
          forwarded_to,
          reference_id,
          meta,
          status,
          website,
          sender_email,
          display_name,
          type,
          description,
          base_amount,
          base_currency,
          tax_amount,
          tax_rate,
          tax_type,
          inbox_account_id,
          invoice_number,
          grouped_inbox_id,
          search_text,
          search_eligible,
          search_amount
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(id) do update set
          team_id = excluded.team_id,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          file_path = excluded.file_path,
          file_path_key = excluded.file_path_key,
          file_name = excluded.file_name,
          transaction_id = excluded.transaction_id,
          amount = excluded.amount,
          currency = excluded.currency,
          content_type = excluded.content_type,
          size = excluded.size,
          attachment_id = excluded.attachment_id,
          date = excluded.date,
          forwarded_to = excluded.forwarded_to,
          reference_id = excluded.reference_id,
          meta = excluded.meta,
          status = excluded.status,
          website = excluded.website,
          sender_email = excluded.sender_email,
          display_name = excluded.display_name,
          type = excluded.type,
          description = excluded.description,
          base_amount = excluded.base_amount,
          base_currency = excluded.base_currency,
          tax_amount = excluded.tax_amount,
          tax_rate = excluded.tax_rate,
          tax_type = excluded.tax_type,
          inbox_account_id = excluded.inbox_account_id,
          invoice_number = excluded.invoice_number,
          grouped_inbox_id = excluded.grouped_inbox_id,
          search_text = excluded.search_text,
          search_eligible = excluded.search_eligible,
          search_amount = excluded.search_amount`,
      )
      .bind(
        id,
        item.teamId,
        createdAt,
        updatedAt,
        JSON.stringify(item.filePath),
        inboxFilePathKey(item.filePath),
        item.fileName ?? null,
        item.transactionId ?? null,
        amount,
        item.currency ?? null,
        item.contentType ?? null,
        item.size ?? null,
        item.attachmentId ?? null,
        item.date ?? null,
        item.forwardedTo ?? null,
        item.referenceId ?? null,
        item.meta === undefined || item.meta === null ? null : JSON.stringify(item.meta),
        item.status,
        item.website ?? null,
        item.senderEmail ?? null,
        item.displayName ?? null,
        item.type ?? null,
        item.description ?? null,
        item.baseAmount ?? null,
        item.baseCurrency ?? null,
        item.taxAmount ?? null,
        item.taxRate ?? null,
        item.taxType ?? null,
        item.inboxAccountId ?? null,
        item.invoiceNumber ?? null,
        item.groupedInboxId ?? null,
        searchText || null,
        searchEligible ? 1 : 0,
        searchAmount,
      )
      .run();

    await syncInboxItemSearchIndex(d1, {
      id,
      teamId: item.teamId,
      searchText,
      searchEligible,
    });

    const updated = await getInboxItemByIdFromD1(d1, { teamId: item.teamId, inboxId: id });
    if (!updated) {
      throw new Error("Failed to upsert inbox item");
    }
    results.push(updated);
  }

  return results;
}

export async function getInboxStatusCountSummaryFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    createdAtFrom?: string | null;
    createdAtTo?: string | null;
    rangeStatus?: InboxItemStatus;
  },
) {
  const totals = Object.fromEntries(INBOX_STATUSES.map((status) => [status, 0])) as Record<
    InboxItemStatus,
    number
  >;
  const { results: totalRows = [] } = await d1
    .prepare(
      `select status, count(*) as item_count
       from inbox_items
       where team_id = ?
       group by status`,
    )
    .bind(args.teamId)
    .all<{ status: InboxItemStatus; item_count: number }>();

  for (const row of totalRows) {
    totals[row.status] = row.item_count;
  }

  let rangeCount = 0;
  if (args.rangeStatus && args.createdAtFrom && args.createdAtTo) {
    rangeCount =
      (await d1
        .prepare(
          `select count(*) as count
           from inbox_items
           where team_id = ?
             and status = ?
             and created_at >= ?
             and created_at <= ?`,
        )
        .bind(args.teamId, args.rangeStatus, args.createdAtFrom, args.createdAtTo)
        .first<{ count: number }>())?.count ?? 0;
  }

  return { totals, rangeCount };
}

export async function getInboxLiabilityAggregateRowsFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    dateFrom?: string | null;
    dateTo?: string | null;
  },
): Promise<InboxLiabilityAggregateRowRecord[]> {
  const filters = [
    "team_id = ?",
    "transaction_id is null",
    "amount is not null",
    "date is not null",
    "status != 'done'",
    "status != 'deleted'",
  ];
  const values: unknown[] = [args.teamId];

  if (args.dateFrom) {
    filters.push("date >= ?");
    values.push(args.dateFrom);
  }

  if (args.dateTo) {
    filters.push("date <= ?");
    values.push(args.dateTo);
  }

  const { results = [] } = await d1
    .prepare(
      `select
         date,
         case
           when base_amount is not null and base_currency is not null then base_currency
           else currency
         end as currency,
         round(sum(abs(case
           when base_amount is not null and base_currency is not null then base_amount
           else amount
         end)), 2) as total_amount,
         count(*) as item_count,
         max(updated_at) as updated_at
       from inbox_items
       where ${filters.join(" and ")}
       group by date, currency
       order by date asc`,
    )
    .bind(...values)
    .all<{
      date: string;
      currency: string | null;
      total_amount: number;
      item_count: number;
      updated_at: string;
    }>();

  return results.map((row) => ({
    date: row.date,
    currency: row.currency,
    totalAmount: row.total_amount,
    itemCount: row.item_count,
    updatedAt: row.updated_at,
  }));
}

export async function getTransactionMatchSuggestionsFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    inboxId?: string;
    transactionId?: string;
    transactionIds?: string[];
    statuses?: MatchSuggestionStatus[];
  },
) {
  const filters = ["team_id = ?"];
  const values: unknown[] = [args.teamId];

  if (args.inboxId) {
    filters.push("inbox_id = ?");
    values.push(args.inboxId);
  } else if (args.transactionId) {
    filters.push("transaction_id = ?");
    values.push(args.transactionId);
  } else if (args.transactionIds && args.transactionIds.length > 0) {
    filters.push(`transaction_id in (${args.transactionIds.map(() => "?").join(", ")})`);
    values.push(...new Set(args.transactionIds));
  }

  if (args.statuses && args.statuses.length > 0) {
    filters.push(`status in (${args.statuses.map(() => "?").join(", ")})`);
    values.push(...args.statuses);
  }

  const { results = [] } = await d1
    .prepare(
      `select *
       from transaction_match_suggestions
       where ${filters.join(" and ")}
       order by created_at desc, id desc`,
    )
    .bind(...values)
    .all<SuggestionRow>();

  return results.map(toSuggestionRecord);
}

export async function getTransactionMatchSuggestionsPageFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    status: MatchSuggestionStatus;
    cursor?: string | null;
    pageSize: number;
    order?: "asc" | "desc";
    createdAtFrom?: string | null;
    createdAtTo?: string | null;
  },
) {
  const order = args.order === "asc" ? "asc" : "desc";
  const cursor = decodeCursor(args.cursor);
  const filters = ["team_id = ?", "status = ?"];
  const values: unknown[] = [args.teamId, args.status];

  applyCreatedAtRange(filters, values, args);

  if (cursor) {
    filters.push(order === "asc" ? "(created_at, id) > (?, ?)" : "(created_at, id) < (?, ?)");
    values.push(cursor[0], cursor[1]);
  }

  const { results = [] } = await d1
    .prepare(
      `select *
       from transaction_match_suggestions
       where ${filters.join(" and ")}
       order by created_at ${order}, id ${order}
       limit ?`,
    )
    .bind(...values, args.pageSize + 1)
    .all<SuggestionRow>();
  const pageRows = results.slice(0, args.pageSize);

  return {
    page: pageRows.map(toSuggestionRecord),
    isDone: results.length <= args.pageSize,
    continueCursor: pageRows.length > 0 ? encodeCursor(pageRows[pageRows.length - 1]!) : "",
  };
}

async function getSuggestionLearningFields(
  d1: CloudflareD1DatabaseBinding,
  suggestion: UpsertTransactionMatchSuggestionInput,
) {
  const inbox = await getInboxItemByIdFromD1(d1, {
    teamId: suggestion.teamId,
    inboxId: suggestion.inboxId,
  });

  return {
    normalizedInboxName: normalizeSuggestionLearningName(inbox?.displayName) || null,
    normalizedTransactionName: null,
  };
}

export async function upsertTransactionMatchSuggestionsInD1(
  d1: CloudflareD1DatabaseBinding,
  args: { suggestions: UpsertTransactionMatchSuggestionInput[] },
) {
  const results: TransactionMatchSuggestionRecord[] = [];

  for (const suggestion of args.suggestions) {
    const now = new Date().toISOString();
    const existing =
      suggestion.id
        ? (
            await getTransactionMatchSuggestionsFromD1(d1, {
              teamId: suggestion.teamId,
            })
          ).find((row) => row.id === suggestion.id) ?? null
        : (
            await getTransactionMatchSuggestionsFromD1(d1, {
              teamId: suggestion.teamId,
              inboxId: suggestion.inboxId,
            })
          ).find((row) => row.transactionId === suggestion.transactionId) ?? null;
    const id = existing?.id ?? suggestion.id ?? crypto.randomUUID();
    const learningFields = await getSuggestionLearningFields(d1, suggestion);

    await d1
      .prepare(
        `insert into transaction_match_suggestions (
          id,
          team_id,
          inbox_id,
          transaction_id,
          normalized_inbox_name,
          normalized_transaction_name,
          confidence_score,
          amount_score,
          currency_score,
          date_score,
          name_score,
          match_type,
          match_details,
          status,
          user_action_at,
          user_id,
          created_at,
          updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(id) do update set
          team_id = excluded.team_id,
          inbox_id = excluded.inbox_id,
          transaction_id = excluded.transaction_id,
          normalized_inbox_name = excluded.normalized_inbox_name,
          normalized_transaction_name = excluded.normalized_transaction_name,
          confidence_score = excluded.confidence_score,
          amount_score = excluded.amount_score,
          currency_score = excluded.currency_score,
          date_score = excluded.date_score,
          name_score = excluded.name_score,
          match_type = excluded.match_type,
          match_details = excluded.match_details,
          status = excluded.status,
          user_action_at = excluded.user_action_at,
          user_id = excluded.user_id,
          updated_at = excluded.updated_at`,
      )
      .bind(
        id,
        suggestion.teamId,
        suggestion.inboxId,
        suggestion.transactionId,
        learningFields.normalizedInboxName,
        learningFields.normalizedTransactionName,
        suggestion.confidenceScore,
        suggestion.amountScore ?? null,
        suggestion.currencyScore ?? null,
        suggestion.dateScore ?? null,
        suggestion.nameScore ?? null,
        suggestion.matchType,
        suggestion.matchDetails === undefined || suggestion.matchDetails === null
          ? null
          : JSON.stringify(suggestion.matchDetails),
        suggestion.status,
        suggestion.userActionAt ?? null,
        suggestion.userId ?? null,
        suggestion.createdAt ?? existing?.createdAt ?? now,
        suggestion.updatedAt ?? now,
      )
      .run();

    const [updated] = await getTransactionMatchSuggestionsFromD1(d1, {
      teamId: suggestion.teamId,
      inboxId: suggestion.inboxId,
    });
    const result = updated?.id === id
      ? updated
      : (await getTransactionMatchSuggestionsFromD1(d1, { teamId: suggestion.teamId })).find(
          (row) => row.id === id,
        );

    if (!result) {
      throw new Error("Failed to upsert transaction match suggestion");
    }
    results.push(result);
  }

  return results;
}

export async function deleteTransactionMatchSuggestionsFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    suggestionIds?: string[];
    inboxIds?: string[];
  },
) {
  const filters = ["team_id = ?"];
  const values: unknown[] = [args.teamId];

  if (args.suggestionIds && args.suggestionIds.length > 0) {
    filters.push(`id in (${args.suggestionIds.map(() => "?").join(", ")})`);
    values.push(...args.suggestionIds);
  }

  if (args.inboxIds && args.inboxIds.length > 0) {
    filters.push(`inbox_id in (${args.inboxIds.map(() => "?").join(", ")})`);
    values.push(...args.inboxIds);
  }

  if (filters.length === 1) {
    return [];
  }

  const { results = [] } = await d1
    .prepare(`select id from transaction_match_suggestions where ${filters.join(" and ")}`)
    .bind(...values)
    .all<{ id: string }>();

  await d1
    .prepare(`delete from transaction_match_suggestions where ${filters.join(" and ")}`)
    .bind(...values)
    .run();

  return results.map((row) => row.id);
}
