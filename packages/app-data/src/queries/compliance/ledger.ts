import {
  roundCurrency,
  UK_SYSTEM_LEDGER_ACCOUNTS,
} from "@tamias/compliance";
import { calculateBaseTaxAmount, resolveTaxValues } from "@tamias/utils/tax";
import type { Database } from "../../client";
import {
  getTransactionCategoriesFromConvex,
  replaceComplianceJournalEntriesInConvex,
  type ComplianceJournalEntryRecord,
  type FilingProfileRecord,
  type TransactionCategoryRecord,
} from "@tamias/app-data-convex";
import { getProjectedInvoicesPaged, getTransactionsPaged } from "../paged-records";
import type { TeamContext } from "./shared";

type DerivedJournalEntry = ComplianceJournalEntryRecord;
type TransactionCategoryContext = {
  bySlug: Map<string, TransactionCategoryRecord>;
};
type CachedTransactionCategoryContext = {
  context: TransactionCategoryContext;
  timestamp: number;
};

const CATEGORY_CONTEXT_TTL_MS = 5 * 60 * 1000;
const transactionCategoryContextCache = new Map<
  string,
  CachedTransactionCategoryContext
>();

function buildTransactionCategoryContext(
  categories: TransactionCategoryRecord[],
): TransactionCategoryContext {
  return {
    bySlug: new Map(categories.map((category) => [category.slug, category])),
  };
}

async function getTransactionCategoryContext(
  _db: Database,
  teamId: string,
): Promise<TransactionCategoryContext> {
  const cached = transactionCategoryContextCache.get(teamId);

  if (cached && Date.now() - cached.timestamp < CATEGORY_CONTEXT_TTL_MS) {
    return cached.context;
  }

  const categories = await getTransactionCategoriesFromConvex({ teamId });
  const context = buildTransactionCategoryContext(categories);

  transactionCategoryContextCache.set(teamId, {
    context,
    timestamp: Date.now(),
  });

  return context;
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

function normalizeDerivedJournalLines(
  lines: Array<{
    accountCode: string;
    description?: string | null;
    debit?: number;
    credit?: number;
    taxRate?: number | null;
    taxAmount?: number | null;
    taxType?: string | null;
    vatBox?: string | null;
    meta?: Record<string, unknown>;
  }>,
) {
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

export function listJournalRowsForPeriod(
  entries: DerivedJournalEntry[],
  periodStart: string,
  periodEnd: string,
) {
  return entries
    .filter(
      (entry) => entry.entryDate >= periodStart && entry.entryDate <= periodEnd,
    )
    .flatMap((entry) =>
      entry.lines.map((line) => ({
        sourceType: entry.sourceType,
        accountCode: line.accountCode,
        debit: line.debit ?? 0,
        credit: line.credit ?? 0,
      })),
    );
}

export async function rebuildDerivedLedger(
  db: Database,
  params: {
    teamId: string;
    team: TeamContext;
    profile: FilingProfileRecord;
  },
) {
  const accountMap = ensureLedgerAccounts();
  const entries: DerivedJournalEntry[] = [];

  const bankAccount = accountMap.get("1000");
  const arAccount = accountMap.get("1100");
  const vatInputAccount = accountMap.get("1200");
  const vatOutputAccount = accountMap.get("2200");
  const salesAccount = accountMap.get("4000");
  const salesReturnsAccount = accountMap.get("4900");
  const expenseAccount = accountMap.get("5000");

  if (
    !bankAccount ||
    !arAccount ||
    !vatInputAccount ||
    !vatOutputAccount ||
    !salesAccount ||
    !salesReturnsAccount ||
    !expenseAccount
  ) {
    throw new Error("Required ledger accounts are missing");
  }

  const transactionCategoryContext = await getTransactionCategoryContext(
    db,
    params.teamId,
  );

  const transactionRows = (
    await getTransactionsPaged({
      teamId: params.teamId,
    })
  ).filter(
    (transaction) => !transaction.internal && transaction.status !== "excluded",
  );

  for (const row of transactionRows) {
    const reportingAmount =
      row.baseCurrency ===
        (params.profile.baseCurrency ?? params.team.baseCurrency ?? "GBP") &&
      row.baseAmount !== null
        ? row.baseAmount
        : row.amount;

    const baseTaxAmount = calculateBaseTaxAmount({
      amount: row.amount,
      taxAmount: row.taxAmount,
      taxRate: row.taxRate,
      baseAmount: row.baseAmount,
      baseCurrency: row.baseCurrency,
      currency: row.currency,
    });
    const category = row.categorySlug
      ? transactionCategoryContext.bySlug.get(row.categorySlug)
      : null;

    const resolved = resolveTaxValues({
      transactionAmount: reportingAmount,
      transactionTaxAmount: baseTaxAmount ?? row.taxAmount ?? null,
      transactionTaxRate: row.taxRate,
      transactionTaxType: row.taxType,
      categoryTaxRate: category?.taxRate ?? null,
      categoryTaxType: category?.taxType ?? null,
    });

    const grossAmount = Math.abs(reportingAmount);
    const vatAmount =
      resolved.taxType === "vat" ? Math.abs(resolved.taxAmount ?? 0) : 0;
    const netAmount = roundCurrency(Math.max(grossAmount - vatAmount, 0));
    const isIncome = reportingAmount > 0;

    const lines = isIncome
      ? [
          {
            accountCode: bankAccount.code,
            description: row.name,
            debit: grossAmount,
          },
          {
            accountCode: salesAccount.code,
            description: row.name,
            credit: netAmount,
          },
          ...(vatAmount > 0
            ? [
                {
                  accountCode: vatOutputAccount.code,
                  description: row.name,
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
            description: row.name,
            debit: netAmount,
          },
          ...(vatAmount > 0
            ? [
                {
                  accountCode: vatInputAccount.code,
                  description: row.name,
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
            description: row.name,
            credit: grossAmount,
          },
        ];

    entries.push({
      journalEntryId: crypto.randomUUID(),
      entryDate: row.date,
      reference: row.id,
      description: row.description ?? row.name,
      sourceType: "transaction",
      sourceId: row.id,
      currency:
        params.profile.baseCurrency ?? params.team.baseCurrency ?? "GBP",
      meta: {
        grossAmount,
        netAmount,
        vatAmount,
        basis: "cash",
      },
      lines: normalizeDerivedJournalLines(lines),
    });
  }

  const invoiceRows = (await getProjectedInvoicesPaged({ teamId: params.teamId })).filter(
    (invoice) =>
      ["paid", "unpaid", "overdue", "scheduled", "refunded"].includes(
        invoice.status,
      ),
  );

  for (const row of invoiceRows) {
    if (!row.amount || !row.issueDate) {
      continue;
    }

    const grossAmount = Math.abs(row.amount);
    const vatAmount = Math.abs(row.vat ?? 0);
    const netAmount = roundCurrency(
      row.subtotal ?? Math.max(grossAmount - vatAmount, 0),
    );
    const isRefund = row.status === "refunded";
    const entryDate = (isRefund ? row.refundedAt : row.issueDate)?.slice(0, 10);

    if (!entryDate) {
      continue;
    }

    entries.push({
      journalEntryId: crypto.randomUUID(),
      entryDate,
      reference: row.invoiceNumber ?? row.id,
      description: row.customerName ?? row.invoiceNumber ?? "Invoice",
      sourceType: isRefund ? "invoice_refund" : "invoice",
      sourceId: row.id,
      currency: row.currency ?? params.profile.baseCurrency ?? "GBP",
      meta: {
        grossAmount,
        netAmount,
        vatAmount,
        basis: "accrual",
      },
      lines: normalizeDerivedJournalLines(
        isRefund
          ? [
              {
                accountCode: salesReturnsAccount.code,
                description: row.customerName ?? row.invoiceNumber,
                debit: netAmount,
              },
              ...(vatAmount > 0
                ? [
                    {
                      accountCode: vatOutputAccount.code,
                      description: row.customerName ?? row.invoiceNumber,
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
                description: row.customerName ?? row.invoiceNumber,
                credit: grossAmount,
              },
            ]
          : [
              {
                accountCode: arAccount.code,
                description: row.customerName ?? row.invoiceNumber,
                debit: grossAmount,
              },
              {
                accountCode: salesAccount.code,
                description: row.customerName ?? row.invoiceNumber,
                credit: netAmount,
              },
              ...(vatAmount > 0
                ? [
                    {
                      accountCode: vatOutputAccount.code,
                      description: row.customerName ?? row.invoiceNumber,
                      credit: vatAmount,
                      taxRate: 20,
                      taxAmount: vatAmount,
                      taxType: "vat",
                      vatBox: "box1",
                    },
                  ]
                : []),
            ],
      ),
    });
  }

  await replaceComplianceJournalEntriesInConvex({
    teamId: params.teamId,
    entries,
    sourceTypes: ["transaction", "invoice", "invoice_refund"],
  });

  return entries;
}
