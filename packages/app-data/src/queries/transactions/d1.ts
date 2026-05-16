import { buildAbsoluteAmountSearchValue, buildSearchIndexText, buildSearchQuery } from "@tamias/domain";
import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "../../client";
import type {
  TransactionRecord,
  TransactionStatus,
  TransactionTagAssignmentRecord,
  UpsertTransactionInput,
} from "./shared/types";

type TransactionRow = {
  id: string;
  team_id: string;
  created_at: string;
  updated_at: string;
  date: string;
  name: string;
  method: TransactionRecord["method"];
  amount: number;
  currency: string;
  assigned_id: string | null;
  note: string | null;
  bank_account_id: string | null;
  internal_id: string;
  status: TransactionStatus;
  balance: number | null;
  manual: number;
  notified: number;
  internal: number;
  description: string | null;
  category_slug: string | null;
  base_amount: number | null;
  counterparty_name: string | null;
  base_currency: string | null;
  tax_amount: number | null;
  tax_rate: number | null;
  tax_type: string | null;
  recurring: number;
  frequency: TransactionRecord["frequency"];
  merchant_name: string | null;
  enrichment_completed: number;
  has_attachment: number;
  search_text: string | null;
  search_amount: number | null;
};

type TransactionTagRow = {
  id: string;
  transaction_id: string;
  tag_id: string;
  team_id: string;
  created_at: string;
  updated_at: string;
  tag_name: string;
};

type TransactionPageResult = {
  page: TransactionRecord[];
  isDone: boolean;
  continueCursor: string | null;
};

type TransactionPageCursor = {
  date: string;
  id: string;
};

const TRANSACTION_PAGE_CURSOR_PREFIX = "txd1:";

export function getTransactionsD1(db: Database) {
  return requireCloudflareD1Database(db);
}

export function requireTransactionsD1(db: Database) {
  const d1 = getTransactionsD1(db);

  if (!d1) {
    throw new Error("Transactions require Cloudflare D1");
  }

  return d1;
}

function boolToInt(value: boolean | null | undefined, defaultValue = false) {
  return value ?? defaultValue ? 1 : 0;
}

function intToBool(value: number | boolean | null | undefined) {
  return value === true || value === 1;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}

function placeholders(values: unknown[]) {
  return values.map(() => "?").join(", ");
}

function normalizePageSize(pageSize: number, max = 200) {
  return Math.max(1, Math.min(Math.floor(pageSize), max));
}

function normalizeLimit(limit: number | null | undefined, fallback = 200, max = 200) {
  return Math.max(1, Math.min(Math.floor(limit ?? fallback), max));
}

function normalizeOrder(order: "asc" | "desc" | null | undefined) {
  return order === "asc" ? "asc" : "desc";
}

function encodeTransactionPageCursor(transaction: Pick<TransactionRecord, "date" | "id">) {
  return `${TRANSACTION_PAGE_CURSOR_PREFIX}${Buffer.from(
    JSON.stringify({
      date: transaction.date,
      id: transaction.id,
    }),
    "utf8",
  ).toString("base64url")}`;
}

function decodeTransactionPageCursor(cursor: string | null | undefined): TransactionPageCursor | null {
  if (!cursor?.startsWith(TRANSACTION_PAGE_CURSOR_PREFIX)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(cursor.slice(TRANSACTION_PAGE_CURSOR_PREFIX.length), "base64url").toString(
        "utf8",
      ),
    ) as Partial<TransactionPageCursor>;

    if (typeof parsed.date === "string" && typeof parsed.id === "string") {
      return {
        date: parsed.date,
        id: parsed.id,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function toTransactionRecord(row: TransactionRow): TransactionRecord {
  return {
    id: row.id,
    teamId: row.team_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    date: row.date,
    name: row.name,
    method: row.method,
    amount: row.amount,
    currency: row.currency,
    assignedId: row.assigned_id,
    note: row.note,
    bankAccountId: row.bank_account_id,
    internalId: row.internal_id,
    status: row.status,
    balance: row.balance,
    manual: intToBool(row.manual),
    notified: intToBool(row.notified),
    internal: intToBool(row.internal),
    description: row.description,
    categorySlug: row.category_slug,
    baseAmount: row.base_amount,
    counterpartyName: row.counterparty_name,
    baseCurrency: row.base_currency,
    taxAmount: row.tax_amount,
    taxRate: row.tax_rate,
    taxType: row.tax_type,
    recurring: intToBool(row.recurring),
    frequency: row.frequency,
    merchantName: row.merchant_name,
    enrichmentCompleted: intToBool(row.enrichment_completed),
    hasAttachment: intToBool(row.has_attachment),
  };
}

function toTransactionTagAssignmentRecord(row: TransactionTagRow): TransactionTagAssignmentRecord {
  return {
    id: row.id,
    transactionId: row.transaction_id,
    tagId: row.tag_id,
    teamId: row.team_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tag: {
      id: row.tag_id,
      name: row.tag_name,
    },
  };
}

function buildTransactionSearchText(transaction: {
  name: string;
  description?: string | null;
  merchantName?: string | null;
  counterpartyName?: string | null;
}) {
  return buildSearchIndexText([
    transaction.name,
    transaction.description,
    transaction.merchantName,
    transaction.counterpartyName,
  ]);
}

function compareTransactionsByDefaultOrder(left: TransactionRecord, right: TransactionRecord) {
  const dateComparison = right.date.localeCompare(left.date);

  if (dateComparison !== 0) {
    return dateComparison;
  }

  const createdAtComparison = right.createdAt.localeCompare(left.createdAt);

  if (createdAtComparison !== 0) {
    return createdAtComparison;
  }

  return right.id.localeCompare(left.id);
}

function appendDateFilters(
  clauses: string[],
  values: unknown[],
  args: {
    column: string;
    dateGte?: string | null;
    dateLte?: string | null;
  },
) {
  if (args.dateGte) {
    clauses.push(`${args.column} >= ?`);
    values.push(args.dateGte);
  }

  if (args.dateLte) {
    clauses.push(`${args.column} <= ?`);
    values.push(args.dateLte);
  }
}

function appendStatusExclusions(
  clauses: string[],
  values: unknown[],
  args: {
    column: string;
    statusesNotIn?: TransactionStatus[];
  },
) {
  const statuses = uniqueStrings(args.statusesNotIn ?? []);

  if (statuses.length === 0) {
    return;
  }

  clauses.push(`${args.column} not in (${placeholders(statuses)})`);
  values.push(...statuses);
}

function appendPageCursor(
  clauses: string[],
  values: unknown[],
  args: {
    order: "asc" | "desc";
    cursor?: string | null;
    dateColumn: string;
    idColumn: string;
  },
) {
  const cursor = decodeTransactionPageCursor(args.cursor);

  if (!cursor) {
    return;
  }

  const comparator = args.order === "asc" ? ">" : "<";
  clauses.push(
    `(${args.dateColumn} ${comparator} ? or (${args.dateColumn} = ? and ${args.idColumn} ${comparator} ?))`,
  );
  values.push(cursor.date, cursor.date, cursor.id);
}

async function loadTransactionPage(
  d1: CloudflareD1DatabaseBinding,
  args: {
    select: string;
    from: string;
    clauses: string[];
    values: unknown[];
    order: "asc" | "desc";
    pageSize: number;
    orderDateColumn?: string;
    orderIdColumn?: string;
  },
): Promise<TransactionPageResult> {
  const pageSize = normalizePageSize(args.pageSize);
  const orderDateColumn = args.orderDateColumn ?? "date";
  const orderIdColumn = args.orderIdColumn ?? "id";
  const { results = [] } = await d1
    .prepare(
      `${args.select}
       ${args.from}
       where ${args.clauses.join(" and ")}
       order by ${orderDateColumn} ${args.order}, ${orderIdColumn} ${args.order}
       limit ?`,
    )
    .bind(...args.values, pageSize + 1)
    .all<TransactionRow>();
  const rows = results.slice(0, pageSize);
  const page = rows.map(toTransactionRecord);
  const isDone = results.length <= pageSize;

  return {
    page,
    isDone,
    continueCursor: isDone || page.length === 0 ? null : encodeTransactionPageCursor(page.at(-1)!),
  };
}

export async function getTransactionByIdFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    transactionId: string;
  },
) {
  const row = await d1
    .prepare("select * from transactions where team_id = ? and id = ? limit 1")
    .bind(args.teamId, args.transactionId)
    .first<TransactionRow>();

  return row ? toTransactionRecord(row) : null;
}

async function getTransactionByIdAnyTeamFromD1(
  d1: CloudflareD1DatabaseBinding,
  transactionId: string,
) {
  const row = await d1
    .prepare("select * from transactions where id = ? limit 1")
    .bind(transactionId)
    .first<TransactionRow>();

  return row ? toTransactionRecord(row) : null;
}

async function getTransactionByInternalIdFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    internalId: string;
  },
) {
  const row = await d1
    .prepare("select * from transactions where team_id = ? and internal_id = ? limit 1")
    .bind(args.teamId, args.internalId)
    .first<TransactionRow>();

  return row ? toTransactionRecord(row) : null;
}

export async function getTransactionsByIdsFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    transactionIds: string[];
  },
) {
  const transactionIds = uniqueStrings(args.transactionIds);

  if (transactionIds.length === 0) {
    return [];
  }

  const { results = [] } = await d1
    .prepare(
      `select *
       from transactions
       where team_id = ? and id in (${placeholders(transactionIds)})`,
    )
    .bind(args.teamId, ...transactionIds)
    .all<TransactionRow>();

  return results.map(toTransactionRecord).sort(compareTransactionsByDefaultOrder);
}

export async function getTransactionsByInternalIdsFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    internalIds: string[];
  },
) {
  const internalIds = uniqueStrings(args.internalIds);

  if (internalIds.length === 0) {
    return [];
  }

  const { results = [] } = await d1
    .prepare(
      `select *
       from transactions
       where team_id = ? and internal_id in (${placeholders(internalIds)})`,
    )
    .bind(args.teamId, ...internalIds)
    .all<TransactionRow>();

  return results.map(toTransactionRecord).sort(compareTransactionsByDefaultOrder);
}

export async function getTransactionsPageFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    cursor?: string | null;
    pageSize: number;
    order?: "asc" | "desc";
    dateGte?: string | null;
    dateLte?: string | null;
    statusesNotIn?: TransactionStatus[];
  },
) {
  const order = normalizeOrder(args.order);
  const clauses = ["team_id = ?"];
  const values: unknown[] = [args.teamId];

  appendDateFilters(clauses, values, {
    column: "date",
    dateGte: args.dateGte,
    dateLte: args.dateLte,
  });
  appendStatusExclusions(clauses, values, {
    column: "status",
    statusesNotIn: args.statusesNotIn,
  });
  appendPageCursor(clauses, values, {
    order,
    cursor: args.cursor,
    dateColumn: "date",
    idColumn: "id",
  });

  return loadTransactionPage(d1, {
    select: "select *",
    from: "from transactions",
    clauses,
    values,
    order,
    pageSize: args.pageSize,
  });
}

export async function getTransactionsByBankAccountPageFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    bankAccountId: string;
    cursor?: string | null;
    pageSize: number;
    order?: "asc" | "desc";
    dateGte?: string | null;
    dateLte?: string | null;
    statusesNotIn?: TransactionStatus[];
  },
) {
  const order = normalizeOrder(args.order);
  const clauses = ["team_id = ?", "bank_account_id = ?"];
  const values: unknown[] = [args.teamId, args.bankAccountId];

  appendDateFilters(clauses, values, {
    column: "date",
    dateGte: args.dateGte,
    dateLte: args.dateLte,
  });
  appendStatusExclusions(clauses, values, {
    column: "status",
    statusesNotIn: args.statusesNotIn,
  });
  appendPageCursor(clauses, values, {
    order,
    cursor: args.cursor,
    dateColumn: "date",
    idColumn: "id",
  });

  return loadTransactionPage(d1, {
    select: "select *",
    from: "from transactions",
    clauses,
    values,
    order,
    pageSize: args.pageSize,
  });
}

export async function getTaggedTransactionsPageFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    tagIds: string[];
    cursor?: string | null;
    pageSize: number;
    order?: "asc" | "desc";
    dateGte?: string | null;
    dateLte?: string | null;
    statusesNotIn?: TransactionStatus[];
  },
) {
  const tagIds = uniqueStrings(args.tagIds);

  if (tagIds.length === 0) {
    return {
      page: [],
      isDone: true,
      continueCursor: null,
    };
  }

  const order = normalizeOrder(args.order);
  const clauses = ["t.team_id = ?", `tt.tag_id in (${placeholders(tagIds)})`];
  const values: unknown[] = [args.teamId, ...tagIds];

  appendDateFilters(clauses, values, {
    column: "t.date",
    dateGte: args.dateGte,
    dateLte: args.dateLte,
  });
  appendStatusExclusions(clauses, values, {
    column: "t.status",
    statusesNotIn: args.statusesNotIn,
  });
  appendPageCursor(clauses, values, {
    order,
    cursor: args.cursor,
    dateColumn: "t.date",
    idColumn: "t.id",
  });

  return loadTransactionPage(d1, {
    select: "select distinct t.*",
    from: `from transactions t
       inner join transaction_tags tt
         on tt.team_id = t.team_id and tt.transaction_id = t.id`,
    clauses,
    values,
    order,
    pageSize: args.pageSize,
  });
}

export async function getTransactionsFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    transactionIds?: string[];
    bankAccountId?: string | null;
    dateGte?: string | null;
    dateLte?: string | null;
    statusesNotIn?: TransactionStatus[];
    limit?: number;
  },
) {
  if (args.transactionIds && args.transactionIds.length > 0) {
    return getTransactionsByIdsFromD1(d1, {
      teamId: args.teamId,
      transactionIds: args.transactionIds,
    });
  }

  const limit = args.limit ?? Number.POSITIVE_INFINITY;
  const pageSize = Math.max(1, Math.min(args.limit ?? 200, 200));
  const transactions: TransactionRecord[] = [];
  let cursor: string | null = null;

  while (transactions.length < limit) {
    const page: TransactionPageResult = args.bankAccountId
      ? await getTransactionsByBankAccountPageFromD1(d1, {
          teamId: args.teamId,
          bankAccountId: args.bankAccountId,
          cursor,
          pageSize,
          order: "desc",
          dateGte: args.dateGte,
          dateLte: args.dateLte,
          statusesNotIn: args.statusesNotIn,
        })
      : await getTransactionsPageFromD1(d1, {
          teamId: args.teamId,
          cursor,
          pageSize,
          order: "desc",
          dateGte: args.dateGte,
          dateLte: args.dateLte,
          statusesNotIn: args.statusesNotIn,
        });

    transactions.push(...page.page);

    if (page.isDone || transactions.length >= limit) {
      break;
    }

    cursor = page.continueCursor;
  }

  return Number.isFinite(limit) ? transactions.slice(0, limit) : transactions;
}

export async function getTaggedTransactionsFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    tagIds: string[];
    order?: "asc" | "desc";
    dateGte?: string | null;
    dateLte?: string | null;
    statusesNotIn?: TransactionStatus[];
  },
) {
  const transactions: TransactionRecord[] = [];
  let cursor: string | null = null;

  while (true) {
    const page = await getTaggedTransactionsPageFromD1(d1, {
      teamId: args.teamId,
      tagIds: args.tagIds,
      cursor,
      pageSize: 200,
      order: args.order ?? "desc",
      dateGte: args.dateGte,
      dateLte: args.dateLte,
      statusesNotIn: args.statusesNotIn,
    });

    transactions.push(...page.page);

    if (page.isDone) {
      return transactions;
    }

    cursor = page.continueCursor;
  }
}

export async function countTransactionsFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    bankAccountId?: string | null;
    dateGte?: string | null;
    dateLte?: string | null;
    statusesNotIn?: TransactionStatus[];
  },
) {
  const clauses = ["team_id = ?"];
  const values: unknown[] = [args.teamId];

  if (args.bankAccountId) {
    clauses.push("bank_account_id = ?");
    values.push(args.bankAccountId);
  }

  appendDateFilters(clauses, values, {
    column: "date",
    dateGte: args.dateGte,
    dateLte: args.dateLte,
  });
  appendStatusExclusions(clauses, values, {
    column: "status",
    statusesNotIn: args.statusesNotIn,
  });

  return (
    (await d1
      .prepare(`select count(*) as total from transactions where ${clauses.join(" and ")}`)
      .bind(...values)
      .first<number>("total")) ?? 0
  );
}

export async function searchTransactionsFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    query: string;
    dateGte?: string | null;
    dateLte?: string | null;
    statusesNotIn?: TransactionStatus[];
    limit?: number;
  },
) {
  const searchQuery = buildSearchQuery(args.query);
  const numericQuery = Number(args.query);
  const amountSearchValue =
    !Number.isNaN(numericQuery) && args.query.trim() !== ""
      ? buildAbsoluteAmountSearchValue(numericQuery)
      : null;

  if (!searchQuery && amountSearchValue === null) {
    return [];
  }

  const clauses = ["team_id = ?"];
  const values: unknown[] = [args.teamId];
  const searchClauses: string[] = [];
  const searchValues: unknown[] = [];
  const searchTokens = searchQuery
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);

  for (const token of searchTokens) {
    searchClauses.push("search_text like ? escape '\\'");
    searchValues.push(`%${token.replace(/[\\%_]/g, "\\$&")}%`);
  }

  if (amountSearchValue !== null) {
    searchClauses.push("search_amount = ?");
    searchValues.push(amountSearchValue);
  }

  clauses.push(`(${searchClauses.join(" or ")})`);
  values.push(...searchValues);

  appendDateFilters(clauses, values, {
    column: "date",
    dateGte: args.dateGte,
    dateLte: args.dateLte,
  });
  appendStatusExclusions(clauses, values, {
    column: "status",
    statusesNotIn: args.statusesNotIn,
  });

  const { results = [] } = await d1
    .prepare(
      `select *
       from transactions
       where ${clauses.join(" and ")}
       order by date desc, id desc
       limit ?`,
    )
    .bind(...values, normalizeLimit(args.limit))
    .all<TransactionRow>();

  return results.map(toTransactionRecord);
}

export async function getTransactionsByAmountRangeFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    minAmount: number;
    maxAmount: number;
    dateGte?: string | null;
    dateLte?: string | null;
    statusesNotIn?: TransactionStatus[];
    limit?: number;
  },
) {
  const clauses = ["team_id = ?", "search_amount >= ?", "search_amount <= ?"];
  const values: unknown[] = [args.teamId, args.minAmount, args.maxAmount];

  appendDateFilters(clauses, values, {
    column: "date",
    dateGte: args.dateGte,
    dateLte: args.dateLte,
  });
  appendStatusExclusions(clauses, values, {
    column: "status",
    statusesNotIn: args.statusesNotIn,
  });

  const { results = [] } = await d1
    .prepare(
      `select *
       from transactions
       where ${clauses.join(" and ")}
       order by date desc, id desc
       limit ?`,
    )
    .bind(...values, normalizeLimit(args.limit))
    .all<TransactionRow>();

  return results.map(toTransactionRecord);
}

export async function getUnnotifiedTransactionsFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
  },
) {
  const { results = [] } = await d1
    .prepare(
      `select *
       from transactions
       where team_id = ? and notified = 0
       order by date desc, created_at desc, id desc`,
    )
    .bind(args.teamId)
    .all<TransactionRow>();

  return results.map(toTransactionRecord);
}

export async function upsertTransactionsInD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    transactions: UpsertTransactionInput[];
  },
) {
  const results: TransactionRecord[] = [];

  for (const transaction of args.transactions) {
    const existingById = await getTransactionByIdAnyTeamFromD1(d1, transaction.id);

    if (existingById && existingById.teamId !== args.teamId) {
      throw new Error("Transaction id already exists for another team");
    }

    const existing =
      existingById ??
      (await getTransactionByInternalIdFromD1(d1, {
        teamId: args.teamId,
        internalId: transaction.internalId,
      }));
    const id = existing?.id ?? transaction.id;
    const timestamp = new Date().toISOString();
    const searchText = buildTransactionSearchText(transaction) || null;
    const searchAmount = buildAbsoluteAmountSearchValue(transaction.amount);

    await d1
      .prepare(
        `insert into transactions (
          id,
          team_id,
          created_at,
          updated_at,
          date,
          name,
          method,
          amount,
          currency,
          assigned_id,
          note,
          bank_account_id,
          internal_id,
          status,
          balance,
          manual,
          notified,
          internal,
          description,
          category_slug,
          base_amount,
          counterparty_name,
          base_currency,
          tax_amount,
          tax_rate,
          tax_type,
          recurring,
          frequency,
          merchant_name,
          enrichment_completed,
          has_attachment,
          search_text,
          search_amount
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(id) do update set
          team_id = excluded.team_id,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          date = excluded.date,
          name = excluded.name,
          method = excluded.method,
          amount = excluded.amount,
          currency = excluded.currency,
          assigned_id = excluded.assigned_id,
          note = excluded.note,
          bank_account_id = excluded.bank_account_id,
          internal_id = excluded.internal_id,
          status = excluded.status,
          balance = excluded.balance,
          manual = excluded.manual,
          notified = excluded.notified,
          internal = excluded.internal,
          description = excluded.description,
          category_slug = excluded.category_slug,
          base_amount = excluded.base_amount,
          counterparty_name = excluded.counterparty_name,
          base_currency = excluded.base_currency,
          tax_amount = excluded.tax_amount,
          tax_rate = excluded.tax_rate,
          tax_type = excluded.tax_type,
          recurring = excluded.recurring,
          frequency = excluded.frequency,
          merchant_name = excluded.merchant_name,
          enrichment_completed = excluded.enrichment_completed,
          has_attachment = excluded.has_attachment,
          search_text = excluded.search_text,
          search_amount = excluded.search_amount`,
      )
      .bind(
        id,
        args.teamId,
        transaction.createdAt,
        timestamp,
        transaction.date,
        transaction.name,
        transaction.method,
        transaction.amount,
        transaction.currency,
        transaction.assignedId ?? null,
        transaction.note ?? null,
        transaction.bankAccountId ?? null,
        transaction.internalId,
        transaction.status,
        transaction.balance ?? null,
        boolToInt(transaction.manual),
        boolToInt(transaction.notified),
        boolToInt(transaction.internal),
        transaction.description ?? null,
        transaction.categorySlug ?? null,
        transaction.baseAmount ?? null,
        transaction.counterpartyName ?? null,
        transaction.baseCurrency ?? null,
        transaction.taxAmount ?? null,
        transaction.taxRate ?? null,
        transaction.taxType ?? null,
        boolToInt(transaction.recurring),
        transaction.frequency ?? null,
        transaction.merchantName ?? null,
        boolToInt(transaction.enrichmentCompleted),
        boolToInt(transaction.hasAttachment, existing?.hasAttachment ?? false),
        searchText,
        searchAmount,
      )
      .run();

    await d1
      .prepare(
        `update transaction_tags
         set transaction_date = ?, updated_at = ?
         where team_id = ? and transaction_id = ?`,
      )
      .bind(transaction.date, timestamp, args.teamId, id)
      .run();

    const stored = await getTransactionByIdFromD1(d1, {
      teamId: args.teamId,
      transactionId: id,
    });

    if (!stored) {
      throw new Error("Failed to upsert transaction");
    }

    results.push(stored);
  }

  return results;
}

export async function deleteTransactionsInD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    transactionIds: string[];
  },
) {
  const transactionIds = uniqueStrings(args.transactionIds);
  const deletedIds: string[] = [];

  for (const transactionId of transactionIds) {
    const existing = await getTransactionByIdFromD1(d1, {
      teamId: args.teamId,
      transactionId,
    });

    if (!existing) {
      continue;
    }

    await d1
      .prepare("delete from transaction_tags where team_id = ? and transaction_id = ?")
      .bind(args.teamId, transactionId)
      .run();
    await d1
      .prepare("delete from transactions where team_id = ? and id = ?")
      .bind(args.teamId, transactionId)
      .run();
    deletedIds.push(transactionId);
  }

  return deletedIds;
}

export async function createTransactionTagInD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    transactionId: string;
    tagId: string;
  },
) {
  const [transaction, tag] = await Promise.all([
    getTransactionByIdFromD1(d1, {
      teamId: args.teamId,
      transactionId: args.transactionId,
    }),
    d1
      .prepare("select id, name from tags where team_id = ? and id = ? limit 1")
      .bind(args.teamId, args.tagId)
      .first<{ id: string; name: string }>(),
  ]);

  if (!transaction || !tag) {
    throw new Error("Transaction tag target not found");
  }

  const existing = await d1
    .prepare(
      `select tt.*, tags.name as tag_name
       from transaction_tags tt
       inner join tags on tags.team_id = tt.team_id and tags.id = tt.tag_id
       where tt.team_id = ? and tt.transaction_id = ? and tt.tag_id = ?
       limit 1`,
    )
    .bind(args.teamId, args.transactionId, args.tagId)
    .first<TransactionTagRow>();

  if (existing) {
    return toTransactionTagAssignmentRecord(existing);
  }

  const timestamp = new Date().toISOString();
  const id = crypto.randomUUID();

  await d1
    .prepare(
      `insert into transaction_tags (
        id,
        team_id,
        transaction_id,
        tag_id,
        transaction_date,
        created_at,
        updated_at
      ) values (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, args.teamId, args.transactionId, args.tagId, transaction.date, timestamp, timestamp)
    .run();

  return {
    id,
    transactionId: args.transactionId,
    tagId: args.tagId,
    teamId: args.teamId,
    createdAt: timestamp,
    updatedAt: timestamp,
    tag: {
      id: tag.id,
      name: tag.name,
    },
  };
}

export async function deleteTransactionTagInD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    transactionId: string;
    tagId: string;
  },
) {
  const existing = await d1
    .prepare(
      `select id
       from transaction_tags
       where team_id = ? and transaction_id = ? and tag_id = ?
       limit 1`,
    )
    .bind(args.teamId, args.transactionId, args.tagId)
    .first<{ id: string }>();

  if (!existing) {
    return null;
  }

  await d1
    .prepare("delete from transaction_tags where team_id = ? and id = ?")
    .bind(args.teamId, existing.id)
    .run();

  return existing;
}

export async function addTransactionTagToTransactionsInD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    transactionIds: string[];
    tagId: string;
  },
) {
  const assignments: TransactionTagAssignmentRecord[] = [];

  for (const transactionId of uniqueStrings(args.transactionIds)) {
    assignments.push(
      await createTransactionTagInD1(d1, {
        teamId: args.teamId,
        transactionId,
        tagId: args.tagId,
      }),
    );
  }

  return assignments;
}

export async function getTransactionTagAssignmentsForTransactionIdsFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    transactionIds: string[];
  },
) {
  const transactionIds = uniqueStrings(args.transactionIds);

  if (transactionIds.length === 0) {
    return [];
  }

  const { results = [] } = await d1
    .prepare(
      `select tt.*, tags.name as tag_name
       from transaction_tags tt
       inner join tags on tags.team_id = tt.team_id and tags.id = tt.tag_id
       where tt.team_id = ? and tt.transaction_id in (${placeholders(transactionIds)})
       order by tags.name asc, tt.id asc`,
    )
    .bind(args.teamId, ...transactionIds)
    .all<TransactionTagRow>();

  return results.map(toTransactionTagAssignmentRecord);
}

export async function getTaggedTransactionIdsFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
  },
) {
  const { results = [] } = await d1
    .prepare("select distinct transaction_id from transaction_tags where team_id = ?")
    .bind(args.teamId)
    .all<{ transaction_id: string }>();

  return results.map((row) => row.transaction_id);
}

export async function deleteTransactionTagsForTagInD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    tagId: string;
  },
) {
  await d1
    .prepare("delete from transaction_tags where team_id = ? and tag_id = ?")
    .bind(args.teamId, args.tagId)
    .run();

  return { tagId: args.tagId };
}

export async function deleteTransactionTagsForTransactionsInD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    transactionIds: string[];
  },
) {
  const transactionIds = uniqueStrings(args.transactionIds);

  for (const transactionId of transactionIds) {
    await d1
      .prepare("delete from transaction_tags where team_id = ? and transaction_id = ?")
      .bind(args.teamId, transactionId)
      .run();
  }

  return { transactionIds };
}
