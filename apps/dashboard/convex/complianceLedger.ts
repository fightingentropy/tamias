import { ConvexError, v } from "convex/values";
import { UK_SYSTEM_LEDGER_ACCOUNTS } from "../../../packages/compliance/src/chart-of-accounts";
import { roundCurrency } from "../../../packages/compliance/src/vat";
import { nowIso } from "../../../packages/domain/src/identity";
import {
  calculateBaseTaxAmount,
  resolveTaxValues,
} from "../../../packages/utils/src/tax";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";

type TeamDoc = Doc<"teams">;
type FilingProfileDoc = Doc<"filingProfiles">;
type TransactionDoc = Doc<"transactions">;
type PublicInvoiceDoc = Doc<"publicInvoices">;
type TransactionCategoryDoc = Doc<"transactionCategories">;
type JournalSourceType =
  | "transaction"
  | "invoice"
  | "invoice_refund"
  | "manual_adjustment"
  | "payroll_import";
type JournalLineInput = {
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
type JournalEntryInput = {
  journalEntryId?: string;
  entryDate: string;
  reference?: string | null;
  description?: string | null;
  sourceType: JournalSourceType;
  sourceId: string;
  currency: string;
  meta?: Record<string, unknown> | null;
  lines: JournalLineInput[];
};
type DerivedLedgerContext = {
  team: TeamDoc;
  filingProfile: FilingProfileDoc | null;
  transactionCategoryBySlug: Map<string, TransactionCategoryDoc>;
  accountMap: ReturnType<typeof ensureLedgerAccounts>;
};
type DerivedLedgerRebuildResult = {
  teamId: string;
  transactionCount: number;
  invoiceCount: number;
  journalEntryCount: number;
};

const HMRC_VAT_PROVIDER = "hmrc-vat";
const DERIVED_LEDGER_SOURCE_TYPES: JournalSourceType[] = [
  "transaction",
  "invoice",
  "invoice_refund",
];
const DERIVED_INVOICE_STATUSES = new Set([
  "paid",
  "unpaid",
  "overdue",
  "scheduled",
  "refunded",
]);

const sourceTypeValidator = v.union(
  v.literal("transaction"),
  v.literal("invoice"),
  v.literal("invoice_refund"),
  v.literal("manual_adjustment"),
  v.literal("payroll_import"),
);

const lineValidator = v.object({
  accountCode: v.string(),
  description: v.optional(v.union(v.string(), v.null())),
  debit: v.number(),
  credit: v.number(),
  taxRate: v.optional(v.union(v.number(), v.null())),
  taxAmount: v.optional(v.union(v.number(), v.null())),
  taxType: v.optional(v.union(v.string(), v.null())),
  vatBox: v.optional(v.union(v.string(), v.null())),
  meta: v.optional(v.any()),
});

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

function normalizeJournalLines(lines: JournalLineInput[]) {
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

function getTransactionSourceId(
  transaction: Pick<TransactionDoc, "_id" | "publicTransactionId">,
) {
  return transaction.publicTransactionId ?? transaction._id;
}

function getPublicInvoiceSourceId(
  invoice: Pick<PublicInvoiceDoc, "_id" | "publicInvoiceId">,
) {
  return invoice.publicInvoiceId ?? invoice._id;
}

function getStringFieldFromPayload(
  payload: Record<string, unknown>,
  key: string,
) {
  return typeof payload[key] === "string" && payload[key].length > 0
    ? payload[key]
    : null;
}

function getNumberFieldFromPayload(
  payload: Record<string, unknown>,
  key: string,
) {
  return typeof payload[key] === "number" ? payload[key] : null;
}

async function getLedgerFilingProfile(ctx: MutationCtx, teamId: Id<"teams">) {
  return ctx.db
    .query("filingProfiles")
    .withIndex("by_team_and_provider", (q) =>
      q.eq("teamId", teamId).eq("provider", HMRC_VAT_PROVIDER),
    )
    .unique();
}

async function buildDerivedLedgerContext(
  ctx: MutationCtx,
  team: TeamDoc,
  options?: {
    includeTransactionCategories?: boolean;
  },
): Promise<DerivedLedgerContext> {
  const [filingProfile, categories] = await Promise.all([
    getLedgerFilingProfile(ctx, team._id),
    options?.includeTransactionCategories
      ? ctx.db
          .query("transactionCategories")
          .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
          .collect()
      : Promise.resolve([]),
  ]);

  return {
    team,
    filingProfile,
    transactionCategoryBySlug: new Map(
      categories.map((category) => [category.slug, category]),
    ),
    accountMap: ensureLedgerAccounts(),
  };
}

function shouldDeriveTransactionJournalEntry(transaction: TransactionDoc) {
  return !transaction.internal && transaction.status !== "excluded";
}

function shouldDerivePublicInvoiceJournalEntry(invoice: PublicInvoiceDoc) {
  return (
    typeof invoice.amount === "number" &&
    invoice.amount !== 0 &&
    Boolean(invoice.issueDate) &&
    DERIVED_INVOICE_STATUSES.has(invoice.status)
  );
}

function buildTransactionJournalEntry(
  context: DerivedLedgerContext,
  transaction: TransactionDoc,
): JournalEntryInput | null {
  if (!shouldDeriveTransactionJournalEntry(transaction)) {
    return null;
  }

  const bankAccount = context.accountMap.get("1000");
  const vatInputAccount = context.accountMap.get("1200");
  const vatOutputAccount = context.accountMap.get("2200");
  const salesAccount = context.accountMap.get("4000");
  const expenseAccount = context.accountMap.get("5000");

  if (
    !bankAccount ||
    !vatInputAccount ||
    !vatOutputAccount ||
    !salesAccount ||
    !expenseAccount
  ) {
    throw new ConvexError("Required compliance ledger accounts are missing");
  }

  const reportingCurrency =
    context.filingProfile?.baseCurrency ?? context.team.baseCurrency ?? "GBP";
  const reportingAmount =
    transaction.baseCurrency === reportingCurrency &&
    transaction.baseAmount !== undefined
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
  const vatAmount =
    resolved.taxType === "vat" ? Math.abs(resolved.taxAmount ?? 0) : 0;
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
    entryDate: transaction.date,
    reference: getTransactionSourceId(transaction),
    description: transaction.description ?? transaction.name,
    sourceType: "transaction",
    sourceId: getTransactionSourceId(transaction),
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
  invoice: PublicInvoiceDoc,
): JournalEntryInput | null {
  if (!shouldDerivePublicInvoiceJournalEntry(invoice)) {
    return null;
  }

  const arAccount = context.accountMap.get("1100");
  const vatOutputAccount = context.accountMap.get("2200");
  const salesAccount = context.accountMap.get("4000");
  const salesReturnsAccount = context.accountMap.get("4900");

  if (
    !arAccount ||
    !vatOutputAccount ||
    !salesAccount ||
    !salesReturnsAccount
  ) {
    throw new ConvexError("Required compliance ledger accounts are missing");
  }

  const payload = invoice.payload as Record<string, unknown>;
  const grossAmount = Math.abs(invoice.amount ?? 0);
  const vatAmount = Math.abs(getNumberFieldFromPayload(payload, "vat") ?? 0);
  const netAmount = roundCurrency(
    getNumberFieldFromPayload(payload, "subtotal") ??
      Math.max(grossAmount - vatAmount, 0),
  );
  const isRefund = invoice.status === "refunded";
  const entryDate = (
    isRefund
      ? getStringFieldFromPayload(payload, "refundedAt")
      : invoice.issueDate
  )?.slice(0, 10);

  if (!entryDate) {
    return null;
  }

  const description =
    invoice.customerName ?? invoice.invoiceNumber ?? "Invoice";
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
    entryDate,
    reference: invoice.invoiceNumber ?? getPublicInvoiceSourceId(invoice),
    description,
    sourceType: isRefund ? "invoice_refund" : "invoice",
    sourceId: getPublicInvoiceSourceId(invoice),
    currency:
      invoice.currency ??
      context.filingProfile?.baseCurrency ??
      context.team.baseCurrency ??
      "GBP",
    meta: {
      grossAmount,
      netAmount,
      vatAmount,
      basis: "accrual",
    },
    lines: normalizeJournalLines(lines),
  };
}

async function upsertComplianceJournalEntryRecord(
  ctx: MutationCtx,
  team: TeamDoc,
  entry: JournalEntryInput,
) {
  const existingSourceLink = await ctx.db
    .query("sourceLinks")
    .withIndex("by_team_source_type_source_id", (q) =>
      q
        .eq("teamId", team._id)
        .eq("sourceType", entry.sourceType)
        .eq("sourceId", entry.sourceId),
    )
    .unique();
  const journalEntryId =
    entry.journalEntryId ??
    existingSourceLink?.journalEntryId ??
    crypto.randomUUID();
  const timestamp = nowIso();

  if (existingSourceLink) {
    const existingEntry = await ctx.db
      .query("complianceJournalEntries")
      .withIndex("by_public_journal_entry_id", (q) =>
        q.eq("publicJournalEntryId", existingSourceLink.journalEntryId),
      )
      .unique();

    if (existingEntry) {
      await ctx.db.delete(existingEntry._id);
    }
  }

  await ctx.db.insert("complianceJournalEntries", {
    publicJournalEntryId: journalEntryId,
    teamId: team._id,
    entryDate: entry.entryDate,
    reference: entry.reference ?? undefined,
    description: entry.description ?? undefined,
    sourceType: entry.sourceType,
    sourceId: entry.sourceId,
    currency: entry.currency,
    meta: entry.meta ?? undefined,
    lines: entry.lines.map((line) => ({
      accountCode: line.accountCode,
      description: line.description ?? undefined,
      debit: line.debit ?? 0,
      credit: line.credit ?? 0,
      taxRate: line.taxRate ?? undefined,
      taxAmount: line.taxAmount ?? undefined,
      taxType: line.taxType ?? undefined,
      vatBox: line.vatBox ?? undefined,
      meta: line.meta ?? undefined,
    })),
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  if (existingSourceLink) {
    await ctx.db.patch(existingSourceLink._id, {
      journalEntryId,
      meta: entry.meta ?? undefined,
      updatedAt: timestamp,
    });

    return { journalEntryId, updated: true };
  }

  await ctx.db.insert("sourceLinks", {
    publicSourceLinkId: crypto.randomUUID(),
    teamId: team._id,
    sourceType: entry.sourceType,
    sourceId: entry.sourceId,
    journalEntryId,
    meta: entry.meta ?? undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return { journalEntryId, updated: false };
}

async function deleteComplianceJournalEntryBySourceRecord(
  ctx: MutationCtx,
  team: TeamDoc,
  args: {
    sourceType: JournalSourceType;
    sourceId: string;
  },
) {
  const sourceLink = await ctx.db
    .query("sourceLinks")
    .withIndex("by_team_source_type_source_id", (q) =>
      q
        .eq("teamId", team._id)
        .eq("sourceType", args.sourceType)
        .eq("sourceId", args.sourceId),
    )
    .unique();

  if (!sourceLink) {
    return { deleted: false };
  }

  const existingEntry = await ctx.db
    .query("complianceJournalEntries")
    .withIndex("by_public_journal_entry_id", (q) =>
      q.eq("publicJournalEntryId", sourceLink.journalEntryId),
    )
    .unique();

  if (existingEntry) {
    await ctx.db.delete(existingEntry._id);
  }

  await ctx.db.delete(sourceLink._id);

  return {
    deleted: true,
    journalEntryId: sourceLink.journalEntryId,
  };
}

async function deleteComplianceJournalEntriesForSourceTypes(
  ctx: MutationCtx,
  team: TeamDoc,
  sourceTypes: JournalSourceType[],
) {
  const existingEntries = await ctx.db
    .query("complianceJournalEntries")
    .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
    .collect()
    .then((records) =>
      records.filter((entry) => sourceTypes.includes(entry.sourceType)),
    );
  const existingSourceLinks = await Promise.all(
    sourceTypes.map((sourceType) =>
      ctx.db
        .query("sourceLinks")
        .withIndex("by_team_and_source_type", (q) =>
          q.eq("teamId", team._id).eq("sourceType", sourceType),
        )
        .collect(),
    ),
  );

  await Promise.all([
    ...existingEntries.map((entry) => ctx.db.delete(entry._id)),
    ...existingSourceLinks.flat().map((record) => ctx.db.delete(record._id)),
  ]);

  return {
    deletedEntryIds: existingEntries.map(
      (entry) => entry.publicJournalEntryId ?? entry._id,
    ),
    deletedSourceLinkIds: existingSourceLinks
      .flat()
      .map((record) => record.publicSourceLinkId ?? record._id),
  };
}

export async function syncTransactionComplianceJournalEntriesForChanges(
  ctx: MutationCtx,
  team: TeamDoc,
  changes: Array<{
    previous: TransactionDoc | null;
    next: TransactionDoc | null;
  }>,
) {
  if (changes.length === 0) {
    return;
  }

  const context = await buildDerivedLedgerContext(ctx, team, {
    includeTransactionCategories: true,
  });

  for (const change of changes) {
    const previousSourceId = change.previous
      ? getTransactionSourceId(change.previous)
      : null;
    const nextEntry = change.next
      ? buildTransactionJournalEntry(context, change.next)
      : null;

    if (previousSourceId && !nextEntry) {
      await deleteComplianceJournalEntryBySourceRecord(ctx, team, {
        sourceType: "transaction",
        sourceId: previousSourceId,
      });
      continue;
    }

    if (!nextEntry) {
      continue;
    }

    await upsertComplianceJournalEntryRecord(ctx, team, nextEntry);
  }
}

export async function syncPublicInvoiceComplianceJournalEntryForChange(
  ctx: MutationCtx,
  team: TeamDoc,
  previous: PublicInvoiceDoc | null,
  next: PublicInvoiceDoc | null,
) {
  const context = await buildDerivedLedgerContext(ctx, team);

  return syncPublicInvoiceComplianceJournalEntryWithContext(
    ctx,
    team,
    context,
    previous,
    next,
  );
}

async function syncPublicInvoiceComplianceJournalEntryWithContext(
  ctx: MutationCtx,
  team: TeamDoc,
  context: DerivedLedgerContext,
  previous: PublicInvoiceDoc | null,
  next: PublicInvoiceDoc | null,
) {
  const previousEntry = previous
    ? buildPublicInvoiceJournalEntry(context, previous)
    : null;
  const nextEntry = next ? buildPublicInvoiceJournalEntry(context, next) : null;
  const sourceId = next
    ? getPublicInvoiceSourceId(next)
    : previous
      ? getPublicInvoiceSourceId(previous)
      : null;

  if (
    previousEntry &&
    (!nextEntry || previousEntry.sourceType !== nextEntry.sourceType)
  ) {
    await deleteComplianceJournalEntryBySourceRecord(ctx, team, {
      sourceType: previousEntry.sourceType,
      sourceId: previousEntry.sourceId,
    });
  } else if (previous && !previousEntry && sourceId) {
    await deleteComplianceJournalEntryBySourceRecord(ctx, team, {
      sourceType: previous.status === "refunded" ? "invoice_refund" : "invoice",
      sourceId,
    });
  }

  if (!nextEntry) {
    if (next && sourceId) {
      await deleteComplianceJournalEntryBySourceRecord(ctx, team, {
        sourceType: next.status === "refunded" ? "invoice_refund" : "invoice",
        sourceId,
      });
    }

    return;
  }

  await upsertComplianceJournalEntryRecord(ctx, team, nextEntry);
}

export async function rebuildDerivedComplianceJournalEntriesForTeam(
  ctx: MutationCtx,
  team: TeamDoc,
): Promise<DerivedLedgerRebuildResult> {
  await deleteComplianceJournalEntriesForSourceTypes(
    ctx,
    team,
    DERIVED_LEDGER_SOURCE_TYPES,
  );

  const [transactions, publicInvoices] = await Promise.all([
    ctx.db
      .query("transactions")
      .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
      .collect(),
    ctx.db
      .query("publicInvoices")
      .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
      .collect(),
  ]);
  const invoiceContext = await buildDerivedLedgerContext(ctx, team);
  const transactionChanges = transactions.map((transaction) => ({
    previous: null,
    next: transaction,
  }));

  await syncTransactionComplianceJournalEntriesForChanges(
    ctx,
    team,
    transactionChanges,
  );

  let journalEntryCount = transactions.filter(
    shouldDeriveTransactionJournalEntry,
  ).length;

  for (const invoice of publicInvoices) {
    const invoiceEntry = buildPublicInvoiceJournalEntry(
      invoiceContext,
      invoice,
    );

    await syncPublicInvoiceComplianceJournalEntryWithContext(
      ctx,
      team,
      invoiceContext,
      null,
      invoice,
    );

    if (invoiceEntry) {
      journalEntryCount += 1;
    }
  }

  return {
    teamId: team.publicTeamId ?? String(team._id),
    transactionCount: transactions.length,
    invoiceCount: publicInvoices.length,
    journalEntryCount,
  };
}

async function getTeamOrThrow(ctx: MutationCtx, publicTeamId: string) {
  const team = await getTeamByPublicTeamId(ctx, publicTeamId);

  if (!team) {
    throw new ConvexError("Convex compliance ledger team not found");
  }

  return team;
}

export const serviceListComplianceJournalEntries = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    sourceTypes: v.optional(v.array(sourceTypeValidator)),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    const allowedSourceTypes = args.sourceTypes
      ? new Set(args.sourceTypes)
      : null;

    return ctx.db
      .query("complianceJournalEntries")
      .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
      .collect()
      .then((records) =>
        records
          .filter((record) =>
            allowedSourceTypes
              ? allowedSourceTypes.has(record.sourceType)
              : true,
          )
          .sort((left, right) => {
            const dateComparison = left.entryDate.localeCompare(
              right.entryDate,
            );

            if (dateComparison !== 0) {
              return dateComparison;
            }

            return left.createdAt.localeCompare(right.createdAt);
          })
          .map((record) => ({
            journalEntryId: record.publicJournalEntryId ?? record._id,
            entryDate: record.entryDate,
            reference: record.reference ?? null,
            description: record.description ?? null,
            sourceType: record.sourceType,
            sourceId: record.sourceId,
            currency: record.currency,
            meta: record.meta ?? null,
            lines: record.lines.map((line) => ({
              accountCode: line.accountCode,
              description: line.description ?? null,
              debit: line.debit,
              credit: line.credit,
              taxRate: line.taxRate ?? null,
              taxAmount: line.taxAmount ?? null,
              taxType: line.taxType ?? null,
              vatBox: line.vatBox ?? null,
              meta: line.meta ?? null,
            })),
          })),
      );
  },
});

export const serviceUpsertComplianceJournalEntry = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    entry: v.object({
      journalEntryId: v.optional(v.string()),
      entryDate: v.string(),
      reference: v.optional(v.union(v.string(), v.null())),
      description: v.optional(v.union(v.string(), v.null())),
      sourceType: sourceTypeValidator,
      sourceId: v.string(),
      currency: v.string(),
      meta: v.optional(v.any()),
      lines: v.array(lineValidator),
    }),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamOrThrow(ctx, args.publicTeamId);
    return upsertComplianceJournalEntryRecord(ctx, team, {
      journalEntryId: args.entry.journalEntryId,
      entryDate: args.entry.entryDate,
      reference: args.entry.reference ?? null,
      description: args.entry.description ?? null,
      sourceType: args.entry.sourceType as JournalSourceType,
      sourceId: args.entry.sourceId,
      currency: args.entry.currency,
      meta:
        (args.entry.meta as Record<string, unknown> | null | undefined) ?? null,
      lines: args.entry.lines.map((line) => ({
        accountCode: line.accountCode,
        description: line.description ?? null,
        debit: line.debit,
        credit: line.credit,
        taxRate: line.taxRate ?? null,
        taxAmount: line.taxAmount ?? null,
        taxType: line.taxType ?? null,
        vatBox: line.vatBox ?? null,
        meta: (line.meta as Record<string, unknown> | null | undefined) ?? null,
      })),
    });
  },
});

export const serviceDeleteComplianceJournalEntryBySource = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    sourceType: sourceTypeValidator,
    sourceId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return { deleted: false };
    }

    return deleteComplianceJournalEntryBySourceRecord(ctx, team, {
      sourceType: args.sourceType as JournalSourceType,
      sourceId: args.sourceId,
    });
  },
});

export const serviceRebuildDerivedComplianceJournalEntries = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.optional(v.union(v.string(), v.null())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const teams = args.publicTeamId
      ? [await getTeamByPublicTeamId(ctx, args.publicTeamId)]
      : await ctx.db.query("teams").collect();
    const validTeams = teams.filter(
      (team): team is NonNullable<(typeof teams)[number]> => team !== null,
    );

    if (args.publicTeamId && validTeams.length === 0) {
      throw new ConvexError("Convex compliance ledger team not found");
    }

    const results: DerivedLedgerRebuildResult[] = [];

    for (const team of validTeams) {
      results.push(
        await rebuildDerivedComplianceJournalEntriesForTeam(ctx, team),
      );
    }

    return results;
  },
});
