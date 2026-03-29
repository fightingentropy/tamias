import { UTCDate } from "@date-fns/utc";
import {
  CATEGORIES,
  CONTRA_REVENUE_CATEGORIES,
  REVENUE_CATEGORIES,
  getCategoryBySlug,
  getCategoryColor,
  getTaxRateForCategory,
  getTaxTypeForCountry,
} from "@tamias/categories";
import { format, parseISO, startOfMonth } from "date-fns";
import type { Database } from "../../client";
import type { TransactionRecord } from "@tamias/app-data-convex";
import {
  getProjectedInvoicesByFilters,
  type ProjectedInvoiceRecord,
} from "../invoice-projections";
import {
  getProjectedInvoicesPaged,
  getTransactionsPaged,
} from "../paged-records";
import { getTeamById } from "../teams";

export function getPercentageIncrease(a: number, b: number) {
  return a > 0 && b > 0 ? Math.abs(((a - b) / b) * 100).toFixed() : 0;
}

const teamCurrencyCache = new Map<
  string,
  { currency: string | null; timestamp: number }
>();
const CACHE_TTL = 5 * 60 * 1000;

const cogsSlugsCache = new Map<
  string,
  { slugs: string[]; timestamp: number }
>();

type TeamReportContext = {
  currency: string | null;
  countryCode: string | null;
};

type CategoryInfo = {
  slug: string;
  name: string;
  color: string;
  excluded: boolean;
  parentSlug: string | null;
  system: boolean;
  taxRate: number | null;
  taxType: string | null;
};

export type ReportTransactionAmount = {
  transaction: TransactionRecord;
  amount: number;
};

const categoryLookupCache = new Map<string, Map<string, CategoryInfo>>();

export function humanizeCategorySlug(slug: string) {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getCategoryLookup(countryCode: string | null) {
  const cacheKey = countryCode ?? "";
  const cached = categoryLookupCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const lookup = new Map<string, CategoryInfo>();
  const taxType = countryCode ? getTaxTypeForCountry(countryCode) : null;

  for (const parent of CATEGORIES) {
    const parentTaxRate = countryCode
      ? getTaxRateForCategory(countryCode, parent.slug)
      : 0;
    lookup.set(parent.slug, {
      slug: parent.slug,
      name: parent.name,
      color: parent.color ?? getCategoryColor(parent.slug),
      excluded: parent.excluded ?? false,
      parentSlug: null,
      system: parent.system,
      taxRate: parentTaxRate > 0 ? parentTaxRate : null,
      taxType: parentTaxRate > 0 ? taxType : null,
    });

    for (const child of parent.children) {
      const childTaxRate = countryCode
        ? getTaxRateForCategory(countryCode, child.slug)
        : 0;
      lookup.set(child.slug, {
        slug: child.slug,
        name: child.name,
        color: child.color ?? getCategoryColor(child.slug),
        excluded: child.excluded ?? false,
        parentSlug: parent.slug,
        system: child.system,
        taxRate: childTaxRate > 0 ? childTaxRate : null,
        taxType: childTaxRate > 0 ? taxType : null,
      });
    }
  }

  categoryLookupCache.set(cacheKey, lookup);
  return lookup;
}

export function getCategoryInfo(
  slug: string | null,
  countryCode: string | null,
) {
  if (!slug) {
    return null;
  }

  const lookup = getCategoryLookup(countryCode);
  const info = lookup.get(slug);
  if (info) {
    return info;
  }

  return {
    slug,
    name: humanizeCategorySlug(slug),
    color: getCategoryColor(slug),
    excluded: false,
    parentSlug: null,
    system: false,
    taxRate: null,
    taxType: null,
  };
}

export function getExcludedCategorySlugs() {
  return CATEGORIES.flatMap((parent) =>
    parent.children
      .filter((child) => child.excluded)
      .map((child) => child.slug),
  );
}

function getCogsCategorySlugsFromStaticTaxonomy() {
  const cogsParent = getCategoryBySlug("cost-of-goods-sold");
  if (!cogsParent || !("children" in cogsParent)) {
    return [];
  }

  return cogsParent.children
    .filter((child) => !child.excluded)
    .map((child) => child.slug);
}

export async function getTeamReportContext(
  db: Database,
  teamId: string,
  inputCurrency?: string,
): Promise<TeamReportContext> {
  const team = await getTeamById(db, teamId);

  const cached = teamCurrencyCache.get(teamId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return {
      currency: cached.currency,
      countryCode: team?.countryCode ?? null,
    };
  }

  const currency = team?.baseCurrency ?? null;
  teamCurrencyCache.set(teamId, { currency, timestamp: Date.now() });

  return {
    currency: inputCurrency ?? currency,
    countryCode: team?.countryCode ?? null,
  };
}

export async function getCogsCategorySlugs(
  _db: Database,
  teamId: string,
): Promise<string[]> {
  const cached = cogsSlugsCache.get(teamId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.slugs;
  }

  const slugs = getCogsCategorySlugsFromStaticTaxonomy();

  cogsSlugsCache.set(teamId, { slugs, timestamp: Date.now() });
  return slugs;
}

export async function getTargetCurrency(
  db: Database,
  teamId: string,
  inputCurrency?: string,
): Promise<string | null> {
  const context = await getTeamReportContext(db, teamId, inputCurrency);
  return context.currency;
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function getMonthBucket(date: string) {
  return format(startOfMonth(new UTCDate(parseISO(date))), "yyyy-MM-dd");
}

function getReportTransactionAmountValue(
  transaction: TransactionRecord,
  params: {
    targetCurrency: string | null;
    inputCurrency?: string;
  },
) {
  if (params.inputCurrency && params.targetCurrency) {
    if (
      transaction.baseCurrency === params.targetCurrency &&
      transaction.baseAmount !== null
    ) {
      return transaction.baseAmount;
    }

    return transaction.amount;
  }

  return transaction.baseAmount;
}

function matchesReportTransactionCurrency(
  transaction: TransactionRecord,
  params: {
    targetCurrency: string | null;
    inputCurrency?: string;
  },
) {
  if (!params.targetCurrency) {
    return true;
  }

  if (params.inputCurrency) {
    return (
      transaction.currency === params.targetCurrency ||
      transaction.baseCurrency === params.targetCurrency
    );
  }

  return transaction.baseCurrency === params.targetCurrency;
}

export async function getReportTransactionAmounts(
  db: Database,
  params: {
    teamId: string;
    from: string;
    to: string;
    inputCurrency?: string;
  },
) {
  const context = await getTeamReportContext(
    db,
    params.teamId,
    params.inputCurrency,
  );
  const transactions = await getTransactionsPaged({
    teamId: params.teamId,
    dateGte: params.from,
    dateLte: params.to,
    statusesNotIn: ["excluded"],
  });

  const amounts: ReportTransactionAmount[] = [];

  for (const transaction of transactions) {
    if (transaction.date > params.to) {
      continue;
    }

    if (transaction.internal || transaction.status === "excluded") {
      continue;
    }

    if (
      !matchesReportTransactionCurrency(transaction, {
        targetCurrency: context.currency,
        inputCurrency: params.inputCurrency,
      })
    ) {
      continue;
    }

    const amount = getReportTransactionAmountValue(transaction, {
      targetCurrency: context.currency,
      inputCurrency: params.inputCurrency,
    });

    if (amount === null) {
      continue;
    }

    amounts.push({
      transaction,
      amount,
    });
  }

  return {
    targetCurrency: context.currency,
    countryCode: context.countryCode,
    amounts,
  };
}

export function buildMonthlySeriesMap(
  transactions: ReportTransactionAmount[],
  getValue: (row: ReportTransactionAmount) => number,
) {
  const monthlyValues = new Map<string, number>();

  for (const row of transactions) {
    const month = getMonthBucket(row.transaction.date);
    monthlyValues.set(
      month,
      roundMoney((monthlyValues.get(month) ?? 0) + getValue(row)),
    );
  }

  return monthlyValues;
}

export async function getReportInvoices(
  _db: Database,
  params: {
    teamId: string;
    inputCurrency?: string;
    statuses?: ProjectedInvoiceRecord["status"][];
    dateField?: "createdAt" | "issueDate" | "sentAt" | "dueDate" | "paidAt";
    from?: string;
    to?: string;
  },
): Promise<ProjectedInvoiceRecord[]> {
  const { teamId, inputCurrency, statuses, dateField, from, to } = params;

  if (statuses || dateField || from || to) {
    if (dateField === "createdAt") {
      const invoices = await getProjectedInvoicesPaged({
        teamId,
        statuses,
        createdAtFrom: from,
        createdAtTo: to,
      });

      return inputCurrency
        ? invoices.filter((invoice) => invoice.currency === inputCurrency)
        : invoices;
    }

    return getProjectedInvoicesByFilters({
      teamId,
      statuses,
      currency: inputCurrency,
      dateField,
      from,
      to,
    });
  }

  const invoices = await getProjectedInvoicesPaged({ teamId });

  if (!inputCurrency) {
    return invoices;
  }

  return invoices.filter((invoice) => invoice.currency === inputCurrency);
}

export function getResolvedTransactionTaxRate(
  transaction: TransactionRecord,
  countryCode: string | null,
) {
  return (
    transaction.taxRate ??
    getCategoryInfo(transaction.categorySlug, countryCode)?.taxRate ??
    0
  );
}

export function getResolvedTransactionTaxType(
  transaction: TransactionRecord,
  countryCode: string | null,
) {
  return (
    transaction.taxType ??
    (countryCode ? getTaxTypeForCountry(countryCode) : null)
  );
}

export { CONTRA_REVENUE_CATEGORIES, REVENUE_CATEGORIES };
