import { UK_SYSTEM_LEDGER_ACCOUNTS, roundCurrency } from "@tamias/compliance";
import { calculateBaseTaxAmount, resolveTaxValues } from "@tamias/utils/tax";
import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "../../client";
import { getProjectedInvoicesForTeam, type ProjectedInvoiceRecord } from "../invoice-projections";
import { getTeamById } from "../teams/reads";
import type { TeamRecord } from "../teams/shared";
import { getFilingProfileRecord, type FilingProfileRecord } from "./filings";
import {
  listTransactionCategoryRecords,
  type TransactionCategoryRecord,
} from "../transaction-categories/d1";
import { getTransactionsFromD1, requireTransactionsD1 } from "../transactions/d1";
import type { TransactionRecord } from "../transactions/shared";

export type SourceLinkType =
  | "transaction"
  | "invoice"
  | "invoice_refund"
  | "inbox"
  | "manual_adjustment"
  | "payroll_import";

export type ComplianceJournalSourceType =
  | "transaction"
  | "invoice"
  | "invoice_refund"
  | "manual_adjustment"
  | "payroll_import";

export type ComplianceJournalLineRecord = {
  accountCode: string;
  description?: string | null;
  debit?: number;
  credit?: number;
  taxRate?: number | null;
  taxAmount?: number | null;
  taxType?: string | null;
  vatBox?: string | null;
  meta?: Record<string, unknown> | null;
};

export type ComplianceJournalEntryRecord = {
  journalEntryId: string;
  entryDate: string;
  reference?: string | null;
  description?: string | null;
  sourceType: ComplianceJournalSourceType;
  sourceId: string;
  currency: string;
  meta?: Record<string, unknown> | null;
  lines: ComplianceJournalLineRecord[];
};

type ComplianceJournalEntryRow = {
  journal_entry_id: string;
  team_id: string;
  entry_date: string;
  reference: string | null;
  description: string | null;
  source_type: ComplianceJournalSourceType;
  source_id: string;
  currency: string;
  meta_json: string | null;
  lines_json: string;
  created_at: string;
  updated_at: string;
};

type SourceLinkRow = {
  id: string;
  team_id: string;
  source_type: SourceLinkType;
  source_id: string;
  journal_entry_id: string;
  meta_json: string | null;
  created_at: string;
  updated_at: string;
};

type DerivedLedgerContext = {
  team: TeamRecord;
  filingProfile: FilingProfileRecord | null;
  transactionCategoryBySlug: Map<string, TransactionCategoryRecord>;
  accountMap: ReturnType<typeof ensureLedgerAccounts>;
};

type DerivedLedgerRebuildResult = {
  teamId: string;
  transactionCount: number;
  invoiceCount: number;
  journalEntryCount: number;
};

const HMRC_VAT_PROVIDER = "hmrc-vat";
const DERIVED_LEDGER_SOURCE_TYPES: ComplianceJournalSourceType[] = [
  "transaction",
  "invoice",
  "invoice_refund",
];
const DERIVED_INVOICE_STATUSES = new Set(["paid", "unpaid", "overdue", "scheduled", "refunded"]);

export function requireComplianceLedgerD1(db: Database) {
  return requireCloudflareD1Database(db);
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }

  return JSON.parse(value) as T;
}

function serializeJson(value: unknown | null | undefined) {
  return value === undefined || value === null ? null : JSON.stringify(value);
}

function toComplianceJournalEntryRecord(
  row: ComplianceJournalEntryRow,
): ComplianceJournalEntryRecord {
  return {
    journalEntryId: row.journal_entry_id,
    entryDate: row.entry_date,
    reference: row.reference,
    description: row.description,
    sourceType: row.source_type,
    sourceId: row.source_id,
    currency: row.currency,
    meta: parseJson<Record<string, unknown> | null>(row.meta_json, null),
    lines: parseJson<ComplianceJournalLineRecord[]>(row.lines_json, []),
  };
}

function normalizeJournalLines(lines: ComplianceJournalLineRecord[]) {
  return lines.map((line) => ({
    accountCode: line.accountCode,
    description: line.description ?? null,
    debit: roundCurrency(line.debit ?? 0),
    credit: roundCurrency(line.credit ?? 0),
    taxRate: line.taxRate ?? null,
    taxAmount: line.taxAmount ?? null,
    taxType: line.taxType ?? null,
    vatBox: line.vatBox ?? null,
    meta: line.meta ?? null,
  }));
}

export function assertJournalEntryConservesValue(lines: ComplianceJournalLineRecord[]) {
  if (lines.length < 2) {
    throw new Error("Journal entries require at least two lines");
  }

  for (const line of lines) {
    const debit = line.debit ?? 0;
    const credit = line.credit ?? 0;
    if (!line.accountCode.trim()) {
      throw new Error("Journal lines require an account code");
    }
    if (!Number.isFinite(debit) || !Number.isFinite(credit) || debit < 0 || credit < 0) {
      throw new Error("Journal debit and credit values must be finite and non-negative");
    }
    if (debit > 0 && credit > 0) {
      throw new Error("A journal line cannot contain both a debit and a credit");
    }
    if (roundCurrency(debit) === 0 && roundCurrency(credit) === 0) {
      throw new Error("Journal lines cannot have zero value");
    }
  }

  const debits = roundCurrency(lines.reduce((sum, line) => sum + (line.debit ?? 0), 0));
  const credits = roundCurrency(lines.reduce((sum, line) => sum + (line.credit ?? 0), 0));
  if (debits <= 0 || credits <= 0 || Math.abs(debits - credits) > 0.009) {
    throw new Error(`Journal entry does not conserve value (debits ${debits}, credits ${credits})`);
  }
}

async function getSourceLinkBySourceFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    sourceType: SourceLinkType;
    sourceId: string;
  },
) {
  return d1
    .prepare(
      `select *
       from source_links
       where team_id = ? and source_type = ? and source_id = ?
       limit 1`,
    )
    .bind(args.teamId, args.sourceType, args.sourceId)
    .first<SourceLinkRow>();
}

async function getComplianceJournalEntryFromD1(
  d1: CloudflareD1DatabaseBinding,
  journalEntryId: string,
) {
  return d1
    .prepare("select * from compliance_journal_entries where journal_entry_id = ? limit 1")
    .bind(journalEntryId)
    .first<ComplianceJournalEntryRow>();
}

export async function listComplianceJournalEntriesFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    sourceTypes?: ComplianceJournalSourceType[];
  },
) {
  if (args.sourceTypes && args.sourceTypes.length === 0) {
    return [];
  }

  const values: unknown[] = [args.teamId];
  const filters = ["team_id = ?"];

  if (args.sourceTypes) {
    const sourceTypes = [...new Set(args.sourceTypes)];

    filters.push(`source_type in (${sourceTypes.map(() => "?").join(", ")})`);
    values.push(...sourceTypes);
  }

  const { results = [] } = await d1
    .prepare(
      `select *
       from compliance_journal_entries
       where ${filters.join(" and ")}
       order by entry_date asc, created_at asc`,
    )
    .bind(...values)
    .all<ComplianceJournalEntryRow>();

  return results.map(toComplianceJournalEntryRecord);
}

export async function upsertComplianceJournalEntryInD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    entry: ComplianceJournalEntryRecord;
  },
) {
  assertJournalEntryConservesValue(args.entry.lines);
  const existingSourceLink = await getSourceLinkBySourceFromD1(d1, {
    teamId: args.teamId,
    sourceType: args.entry.sourceType,
    sourceId: args.entry.sourceId,
  });
  const journalEntryId =
    args.entry.journalEntryId ?? existingSourceLink?.journal_entry_id ?? crypto.randomUUID();
  const existingEntry = await getComplianceJournalEntryFromD1(d1, journalEntryId);
  const timestamp = new Date().toISOString();
  const createdAt = existingEntry?.created_at ?? timestamp;
  const sourceLinkId = existingSourceLink?.id ?? crypto.randomUUID();
  const sourceLinkCreatedAt = existingSourceLink?.created_at ?? timestamp;
  const normalizedLines = normalizeJournalLines(args.entry.lines);

  if (existingSourceLink && existingSourceLink.journal_entry_id !== journalEntryId) {
    await d1
      .prepare("delete from compliance_journal_entries where journal_entry_id = ? and team_id = ?")
      .bind(existingSourceLink.journal_entry_id, args.teamId)
      .run();
  }

  await d1
    .prepare(
      `insert into compliance_journal_entries (
        journal_entry_id,
        team_id,
        entry_date,
        reference,
        description,
        source_type,
        source_id,
        currency,
        meta_json,
        lines_json,
        created_at,
        updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(journal_entry_id) do update set
        team_id = excluded.team_id,
        entry_date = excluded.entry_date,
        reference = excluded.reference,
        description = excluded.description,
        source_type = excluded.source_type,
        source_id = excluded.source_id,
        currency = excluded.currency,
        meta_json = excluded.meta_json,
        lines_json = excluded.lines_json,
        updated_at = excluded.updated_at`,
    )
    .bind(
      journalEntryId,
      args.teamId,
      args.entry.entryDate,
      args.entry.reference ?? null,
      args.entry.description ?? null,
      args.entry.sourceType,
      args.entry.sourceId,
      args.entry.currency,
      serializeJson(args.entry.meta ?? null),
      JSON.stringify(normalizedLines),
      createdAt,
      timestamp,
    )
    .run();

  await d1
    .prepare(
      `insert into source_links (
        id,
        team_id,
        source_type,
        source_id,
        journal_entry_id,
        meta_json,
        created_at,
        updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(team_id, source_type, source_id) do update set
        journal_entry_id = excluded.journal_entry_id,
        meta_json = excluded.meta_json,
        updated_at = excluded.updated_at`,
    )
    .bind(
      sourceLinkId,
      args.teamId,
      args.entry.sourceType,
      args.entry.sourceId,
      journalEntryId,
      serializeJson(args.entry.meta ?? null),
      sourceLinkCreatedAt,
      timestamp,
    )
    .run();

  return {
    journalEntryId,
    updated: Boolean(existingSourceLink),
  };
}

export async function deleteComplianceJournalEntryBySourceInD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    sourceType: ComplianceJournalSourceType;
    sourceId: string;
  },
) {
  const sourceLink = await getSourceLinkBySourceFromD1(d1, args);

  if (!sourceLink) {
    return { deleted: false };
  }

  await d1
    .prepare("delete from compliance_journal_entries where journal_entry_id = ? and team_id = ?")
    .bind(sourceLink.journal_entry_id, args.teamId)
    .run();
  await d1
    .prepare("delete from source_links where id = ? and team_id = ?")
    .bind(sourceLink.id, args.teamId)
    .run();

  return {
    deleted: true,
    journalEntryId: sourceLink.journal_entry_id,
  };
}

export async function deleteComplianceJournalEntriesForSourceTypesInD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    sourceTypes: ComplianceJournalSourceType[];
  },
) {
  const deletedEntryIds: string[] = [];
  const deletedSourceLinkIds: string[] = [];

  for (const sourceType of [...new Set(args.sourceTypes)]) {
    const { results = [] } = await d1
      .prepare(
        `select journal_entry_id, id
         from source_links
         where team_id = ? and source_type = ?`,
      )
      .bind(args.teamId, sourceType)
      .all<Pick<SourceLinkRow, "journal_entry_id" | "id">>();

    deletedEntryIds.push(...results.map((row) => row.journal_entry_id));
    deletedSourceLinkIds.push(...results.map((row) => row.id));

    await d1
      .prepare("delete from compliance_journal_entries where team_id = ? and source_type = ?")
      .bind(args.teamId, sourceType)
      .run();
    await d1
      .prepare("delete from source_links where team_id = ? and source_type = ?")
      .bind(args.teamId, sourceType)
      .run();
  }

  return {
    deletedEntryIds,
    deletedSourceLinkIds,
  };
}

export async function countSourceLinksBySourceTypesFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    sourceTypes: SourceLinkType[];
  },
) {
  if (args.sourceTypes.length === 0) {
    return 0;
  }

  const sourceTypes = [...new Set(args.sourceTypes)];
  const row = await d1
    .prepare(
      `select count(*) as count
       from source_links
       where team_id = ? and source_type in (${sourceTypes.map(() => "?").join(", ")})`,
    )
    .bind(args.teamId, ...sourceTypes)
    .first<{ count: number }>();

  return row?.count ?? 0;
}

export async function listComplianceJournalEntries(
  db: Database,
  args: {
    teamId: string;
    sourceTypes?: ComplianceJournalSourceType[];
  },
) {
  return listComplianceJournalEntriesFromD1(requireComplianceLedgerD1(db), args);
}

export async function upsertComplianceJournalEntry(
  db: Database,
  args: {
    teamId: string;
    entry: ComplianceJournalEntryRecord;
  },
) {
  return upsertComplianceJournalEntryInD1(requireComplianceLedgerD1(db), args);
}

export async function deleteComplianceJournalEntryBySource(
  db: Database,
  args: {
    teamId: string;
    sourceType: ComplianceJournalSourceType;
    sourceId: string;
  },
) {
  return deleteComplianceJournalEntryBySourceInD1(requireComplianceLedgerD1(db), args);
}

export async function countSourceLinksBySourceTypes(
  db: Database,
  args: {
    teamId: string;
    sourceTypes: SourceLinkType[];
  },
) {
  return countSourceLinksBySourceTypesFromD1(requireComplianceLedgerD1(db), args);
}

type DerivedJournalEntry = ComplianceJournalEntryRecord;

export function listJournalRowsForPeriod(
  entries: DerivedJournalEntry[],
  periodStart: string,
  periodEnd: string,
) {
  return entries
    .filter((entry) => entry.entryDate >= periodStart && entry.entryDate <= periodEnd)
    .flatMap((entry) =>
      entry.lines.map((line) => ({
        sourceType: entry.sourceType,
        accountCode: line.accountCode,
        debit: line.debit ?? 0,
        credit: line.credit ?? 0,
      })),
    );
}

export async function listDerivedLedgerEntries(
  db: Database,
  params: {
    teamId: string;
  },
) {
  return listComplianceJournalEntries(db, {
    teamId: params.teamId,
    sourceTypes: [...DERIVED_LEDGER_SOURCE_TYPES],
  });
}

function ensureLedgerAccounts() {
  return new Map(
    UK_SYSTEM_LEDGER_ACCOUNTS.map((account) => [
      account.code,
      {
        id: account.code,
        code: account.code,
        name: account.name,
        type: account.type,
        taxCode: account.taxCode ?? null,
        system: account.system ?? true,
      },
    ]),
  );
}

async function buildDerivedLedgerContext(
  db: Database,
  teamId: string,
  options?: {
    includeTransactionCategories?: boolean;
  },
): Promise<DerivedLedgerContext | null> {
  const team = await getTeamById(db, teamId);

  if (!team) {
    return null;
  }

  const [filingProfile, categories] = await Promise.all([
    getFilingProfileRecord(db, {
      teamId,
      provider: HMRC_VAT_PROVIDER,
    }),
    options?.includeTransactionCategories
      ? listTransactionCategoryRecords(db, teamId)
      : Promise.resolve([]),
  ]);

  return {
    team,
    filingProfile,
    transactionCategoryBySlug: new Map(categories.map((category) => [category.slug, category])),
    accountMap: ensureLedgerAccounts(),
  };
}

function shouldDeriveTransactionJournalEntry(transaction: TransactionRecord) {
  return !transaction.internal && transaction.status !== "excluded";
}

function shouldDerivePublicInvoiceJournalEntry(invoice: ProjectedInvoiceRecord) {
  return (
    typeof invoice.amount === "number" &&
    invoice.amount !== 0 &&
    Boolean(invoice.issueDate) &&
    DERIVED_INVOICE_STATUSES.has(invoice.status)
  );
}

function buildTransactionJournalEntry(
  context: DerivedLedgerContext,
  transaction: TransactionRecord,
): ComplianceJournalEntryRecord | null {
  if (!shouldDeriveTransactionJournalEntry(transaction)) {
    return null;
  }

  const bankAccount = context.accountMap.get("1000");
  const vatInputAccount = context.accountMap.get("1200");
  const vatOutputAccount = context.accountMap.get("2200");
  const salesAccount = context.accountMap.get("4000");
  const expenseAccount = context.accountMap.get("5000");

  if (!bankAccount || !vatInputAccount || !vatOutputAccount || !salesAccount || !expenseAccount) {
    throw new Error("Required compliance ledger accounts are missing");
  }

  const reportingCurrency =
    context.filingProfile?.baseCurrency ?? context.team.baseCurrency ?? "GBP";
  const reportingAmount =
    transaction.baseCurrency === reportingCurrency && typeof transaction.baseAmount === "number"
      ? transaction.baseAmount
      : transaction.amount;
  const baseTaxAmount = calculateBaseTaxAmount({
    amount: transaction.amount,
    taxAmount: transaction.taxAmount,
    taxRate: transaction.taxRate,
    baseAmount: transaction.baseAmount,
    baseCurrency: transaction.baseCurrency,
    currency: transaction.currency,
  });
  const category = transaction.categorySlug
    ? context.transactionCategoryBySlug.get(transaction.categorySlug)
    : null;
  const resolved = resolveTaxValues({
    transactionAmount: reportingAmount,
    transactionTaxAmount: baseTaxAmount ?? transaction.taxAmount ?? null,
    transactionTaxRate: transaction.taxRate,
    transactionTaxType: transaction.taxType,
    categoryTaxRate: category?.taxRate ?? null,
    categoryTaxType: category?.taxType ?? null,
  });
  const grossAmount = Math.abs(reportingAmount);
  const vatAmount = resolved.taxType === "vat" ? Math.abs(resolved.taxAmount ?? 0) : 0;
  const netAmount = roundCurrency(Math.max(grossAmount - vatAmount, 0));
  const isIncome = reportingAmount > 0;
  const lines = isIncome
    ? [
        {
          accountCode: bankAccount.code,
          description: transaction.name,
          debit: grossAmount,
        },
        {
          accountCode: salesAccount.code,
          description: transaction.name,
          credit: netAmount,
        },
        ...(vatAmount > 0
          ? [
              {
                accountCode: vatOutputAccount.code,
                description: transaction.name,
                credit: vatAmount,
                taxRate: resolved.taxRate,
                taxAmount: vatAmount,
                taxType: resolved.taxType,
                vatBox: "box1",
              },
            ]
          : []),
      ]
    : [
        {
          accountCode: expenseAccount.code,
          description: transaction.name,
          debit: netAmount,
        },
        ...(vatAmount > 0
          ? [
              {
                accountCode: vatInputAccount.code,
                description: transaction.name,
                debit: vatAmount,
                taxRate: resolved.taxRate,
                taxAmount: vatAmount,
                taxType: resolved.taxType,
                vatBox: "box4",
              },
            ]
          : []),
        {
          accountCode: bankAccount.code,
          description: transaction.name,
          credit: grossAmount,
        },
      ];

  return {
    journalEntryId: transaction.id,
    entryDate: transaction.date,
    reference: transaction.id,
    description: transaction.description ?? transaction.name,
    sourceType: "transaction",
    sourceId: transaction.id,
    currency: reportingCurrency,
    meta: {
      grossAmount,
      netAmount,
      vatAmount,
      basis: "cash",
    },
    lines: normalizeJournalLines(lines),
  };
}

function buildPublicInvoiceJournalEntry(
  context: DerivedLedgerContext,
  invoice: ProjectedInvoiceRecord,
): ComplianceJournalEntryRecord | null {
  if (!shouldDerivePublicInvoiceJournalEntry(invoice)) {
    return null;
  }

  const arAccount = context.accountMap.get("1100");
  const vatOutputAccount = context.accountMap.get("2200");
  const salesAccount = context.accountMap.get("4000");
  const salesReturnsAccount = context.accountMap.get("4900");

  if (!arAccount || !vatOutputAccount || !salesAccount || !salesReturnsAccount) {
    throw new Error("Required compliance ledger accounts are missing");
  }

  const grossAmount = Math.abs(invoice.amount ?? 0);
  const vatAmount = Math.abs(invoice.vat ?? 0);
  const netAmount = roundCurrency(invoice.subtotal ?? Math.max(grossAmount - vatAmount, 0));
  const isRefund = invoice.status === "refunded";
  const entryDate = (isRefund ? invoice.refundedAt : invoice.issueDate)?.slice(0, 10);

  if (!entryDate) {
    return null;
  }

  const description = invoice.customerName ?? invoice.invoiceNumber ?? "Invoice";
  const lines = isRefund
    ? [
        {
          accountCode: salesReturnsAccount.code,
          description,
          debit: netAmount,
        },
        ...(vatAmount > 0
          ? [
              {
                accountCode: vatOutputAccount.code,
                description,
                debit: vatAmount,
                taxRate: 20,
                taxAmount: vatAmount,
                taxType: "vat",
                vatBox: "box1",
              },
            ]
          : []),
        {
          accountCode: arAccount.code,
          description,
          credit: grossAmount,
        },
      ]
    : [
        {
          accountCode: arAccount.code,
          description,
          debit: grossAmount,
        },
        {
          accountCode: salesAccount.code,
          description,
          credit: netAmount,
        },
        ...(vatAmount > 0
          ? [
              {
                accountCode: vatOutputAccount.code,
                description,
                credit: vatAmount,
                taxRate: 20,
                taxAmount: vatAmount,
                taxType: "vat",
                vatBox: "box1",
              },
            ]
          : []),
      ];

  return {
    journalEntryId: invoice.id,
    entryDate,
    reference: invoice.invoiceNumber ?? invoice.id,
    description,
    sourceType: isRefund ? "invoice_refund" : "invoice",
    sourceId: invoice.id,
    currency:
      invoice.currency ?? context.filingProfile?.baseCurrency ?? context.team.baseCurrency ?? "GBP",
    meta: {
      grossAmount,
      netAmount,
      vatAmount,
      basis: "accrual",
    },
    lines: normalizeJournalLines(lines),
  };
}

export async function syncTransactionComplianceJournalEntries(
  db: Database,
  args: {
    teamId: string;
    transactions: TransactionRecord[];
  },
) {
  if (args.transactions.length === 0) {
    return;
  }

  const context = await buildDerivedLedgerContext(db, args.teamId, {
    includeTransactionCategories: true,
  });

  if (!context) {
    return;
  }

  for (const transaction of args.transactions) {
    const entry = buildTransactionJournalEntry(context, transaction);

    if (!entry) {
      await deleteComplianceJournalEntryBySource(db, {
        teamId: args.teamId,
        sourceType: "transaction",
        sourceId: transaction.id,
      });
      continue;
    }

    await upsertComplianceJournalEntry(db, {
      teamId: args.teamId,
      entry,
    });
  }
}

export async function syncDeletedTransactionComplianceJournalEntries(
  db: Database,
  args: {
    teamId: string;
    transactionIds: string[];
  },
) {
  for (const transactionId of [...new Set(args.transactionIds)]) {
    await deleteComplianceJournalEntryBySource(db, {
      teamId: args.teamId,
      sourceType: "transaction",
      sourceId: transactionId,
    });
  }
}

export async function syncPublicInvoiceComplianceJournalEntry(
  db: Database,
  args: {
    teamId: string;
    previous: ProjectedInvoiceRecord | null;
    next: ProjectedInvoiceRecord | null;
  },
) {
  const context = await buildDerivedLedgerContext(db, args.teamId);

  if (!context) {
    return;
  }

  const previousEntry = args.previous
    ? buildPublicInvoiceJournalEntry(context, args.previous)
    : null;
  const nextEntry = args.next ? buildPublicInvoiceJournalEntry(context, args.next) : null;
  const sourceId = args.next?.id ?? args.previous?.id ?? null;

  if (previousEntry && (!nextEntry || previousEntry.sourceType !== nextEntry.sourceType)) {
    await deleteComplianceJournalEntryBySource(db, {
      teamId: args.teamId,
      sourceType: previousEntry.sourceType,
      sourceId: previousEntry.sourceId,
    });
  } else if (args.previous && !previousEntry && sourceId) {
    await deleteComplianceJournalEntryBySource(db, {
      teamId: args.teamId,
      sourceType: args.previous.status === "refunded" ? "invoice_refund" : "invoice",
      sourceId,
    });
  }

  if (!nextEntry) {
    if (args.next && sourceId) {
      await deleteComplianceJournalEntryBySource(db, {
        teamId: args.teamId,
        sourceType: args.next.status === "refunded" ? "invoice_refund" : "invoice",
        sourceId,
      });
    }

    return;
  }

  await upsertComplianceJournalEntry(db, {
    teamId: args.teamId,
    entry: nextEntry,
  });
}

export async function rebuildDerivedComplianceJournalEntries(
  db: Database,
  args: {
    teamId?: string | null;
  } = {},
) {
  const d1 = requireComplianceLedgerD1(db);
  const teamIds = args.teamId
    ? [args.teamId]
    : ((
        await d1.prepare("select id from teams order by id asc").all<{
          id: string;
        }>()
      ).results?.map((team) => team.id) ?? []);
  const results: DerivedLedgerRebuildResult[] = [];

  for (const teamId of teamIds) {
    const context = await buildDerivedLedgerContext(db, teamId, {
      includeTransactionCategories: true,
    });

    if (!context) {
      continue;
    }

    await deleteComplianceJournalEntriesForSourceTypesInD1(d1, {
      teamId,
      sourceTypes: DERIVED_LEDGER_SOURCE_TYPES,
    });

    const [transactions, publicInvoices] = await Promise.all([
      getTransactionsFromD1(requireTransactionsD1(db), { teamId }),
      getProjectedInvoicesForTeam(db, teamId),
    ]);
    const entries = [
      ...transactions.flatMap((transaction) => {
        const entry = buildTransactionJournalEntry(context, transaction);
        return entry ? [entry] : [];
      }),
      ...publicInvoices.flatMap((invoice) => {
        const entry = buildPublicInvoiceJournalEntry(context, invoice);
        return entry ? [entry] : [];
      }),
    ];

    for (const entry of entries) {
      await upsertComplianceJournalEntryInD1(d1, {
        teamId,
        entry,
      });
    }

    results.push({
      teamId,
      transactionCount: transactions.length,
      invoiceCount: publicInvoices.length,
      journalEntryCount: entries.length,
    });
  }

  return results;
}
