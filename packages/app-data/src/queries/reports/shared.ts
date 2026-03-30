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
import { createQueryCacheKey, getOrSetQueryCacheValue } from "../../client";
import {
  getInboxLiabilityAggregateRowsFromConvex,
  getInvoiceAgingAggregateRowsFromConvex,
  getInvoiceDateAggregateRowsFromConvex,
  type InboxLiabilityAggregateRowRecord,
  type InvoiceAggregateDateField,
  type InvoiceAgingAggregateRowRecord,
  type InvoiceDateAggregateRowRecord,
  getTransactionMetricAggregateRowsFromConvex,
  getTransactionRecurringAggregateRowsFromConvex,
  getTransactionTaxAggregateRowsFromConvex,
  type TransactionMetricAggregateRowRecord,
  type TransactionRecurringAggregateRowRecord,
  type TransactionTaxAggregateRowRecord,
  type TransactionRecord,
} from "@tamias/app-data-convex";
import { type ProjectedInvoiceRecord } from "../invoice-projections";
import { normalizeTimestampBoundary } from "../date-boundaries";
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
  baseCurrency: string | null;
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

export type ReportTransactionAggregateRow = TransactionMetricAggregateRowRecord;
export type ReportTransactionRecurringAggregateRow =
  TransactionRecurringAggregateRowRecord;
export type ReportTransactionTaxAggregateRow = TransactionTaxAggregateRowRecord;
export type ReportInboxLiabilityAggregateRow = InboxLiabilityAggregateRowRecord;
export type ReportInvoiceDateAggregateRow = InvoiceDateAggregateRowRecord;
export type ReportInvoiceAgingAggregateRow = InvoiceAgingAggregateRowRecord;
export type RecurringFrequency =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "semi_monthly"
  | "annually"
  | "irregular";

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
  return getOrSetQueryCacheValue(
    db,
    createQueryCacheKey("reports:team-context", {
      teamId,
      inputCurrency: inputCurrency ?? null,
    }),
    async () => {
      const team = await getTeamById(db, teamId);

      const cached = teamCurrencyCache.get(teamId);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return {
          currency: inputCurrency ?? cached.currency,
          baseCurrency: cached.currency,
          countryCode: team?.countryCode ?? null,
        };
      }

      const currency = team?.baseCurrency ?? null;
      teamCurrencyCache.set(teamId, { currency, timestamp: Date.now() });

      return {
        currency: inputCurrency ?? currency,
        baseCurrency: currency,
        countryCode: team?.countryCode ?? null,
      };
    },
  );
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

export function normalizeRecurringFrequency(
  frequency: string | null | undefined,
): RecurringFrequency {
  switch (frequency) {
    case "weekly":
    case "biweekly":
    case "monthly":
    case "semi_monthly":
    case "annually":
      return frequency;
    default:
      return "irregular";
  }
}

export function getRecurringMonthlyEquivalent(
  amount: number,
  frequency: string | null | undefined,
) {
  switch (normalizeRecurringFrequency(frequency)) {
    case "weekly":
      return amount * 4.33;
    case "biweekly":
      return amount * 2.17;
    case "semi_monthly":
      return amount * 2;
    case "annually":
      return amount / 12;
    default:
      return amount;
  }
}

export async function getReportTransactionAggregateRows(
  db: Database,
  params: {
    teamId: string;
    from: string;
    to: string;
    inputCurrency?: string;
  },
) {
  return getOrSetQueryCacheValue(
    db,
    createQueryCacheKey("reports:transaction-aggregates", {
      teamId: params.teamId,
      from: params.from,
      to: params.to,
      inputCurrency: params.inputCurrency ?? null,
    }),
    async () => {
      const context = await getTeamReportContext(
        db,
        params.teamId,
        params.inputCurrency,
      );

      if (!context.currency) {
        return {
          targetCurrency: null,
          countryCode: context.countryCode,
          rows: [] as TransactionMetricAggregateRowRecord[],
        };
      }

      const scope =
        !params.inputCurrency || context.currency === context.baseCurrency
          ? "base"
          : "native";
      const rows = await getTransactionMetricAggregateRowsFromConvex({
        teamId: params.teamId,
        scope,
        currency: context.currency,
        dateFrom: params.from,
        dateTo: params.to,
      });

      return {
        targetCurrency: context.currency,
        countryCode: context.countryCode,
        rows,
      };
    },
  );
}

export async function getReportTransactionRecurringAggregateRows(
  db: Database,
  params: {
    teamId: string;
    direction: "income" | "expense";
    from?: string;
    to?: string;
    inputCurrency?: string;
  },
) {
  return getOrSetQueryCacheValue(
    db,
    createQueryCacheKey("reports:transaction-recurring-aggregates", {
      teamId: params.teamId,
      direction: params.direction,
      from: params.from ?? null,
      to: params.to ?? null,
      inputCurrency: params.inputCurrency ?? null,
    }),
    async () => {
      const context = await getTeamReportContext(
        db,
        params.teamId,
        params.inputCurrency,
      );

      if (!context.currency) {
        return {
          targetCurrency: null,
          countryCode: context.countryCode,
          rows: [] as TransactionRecurringAggregateRowRecord[],
        };
      }

      const scope =
        !params.inputCurrency || context.currency === context.baseCurrency
          ? "base"
          : "native";
      const rows = await getTransactionRecurringAggregateRowsFromConvex({
        teamId: params.teamId,
        scope,
        direction: params.direction,
        currency: context.currency,
        dateFrom: params.from,
        dateTo: params.to,
      });

      return {
        targetCurrency: context.currency,
        countryCode: context.countryCode,
        rows,
      };
    },
  );
}

export async function getReportTransactionTaxAggregateRows(
  db: Database,
  params: {
    teamId: string;
    direction: "income" | "expense";
    from: string;
    to: string;
    inputCurrency?: string;
  },
) {
  return getOrSetQueryCacheValue(
    db,
    createQueryCacheKey("reports:transaction-tax-aggregates", {
      teamId: params.teamId,
      direction: params.direction,
      from: params.from,
      to: params.to,
      inputCurrency: params.inputCurrency ?? null,
    }),
    async () => {
      const context = await getTeamReportContext(
        db,
        params.teamId,
        params.inputCurrency,
      );

      if (!context.currency) {
        return {
          targetCurrency: null,
          countryCode: context.countryCode,
          rows: [] as TransactionTaxAggregateRowRecord[],
        };
      }

      const scope =
        !params.inputCurrency || context.currency === context.baseCurrency
          ? "base"
          : "native";
      const rows = await getTransactionTaxAggregateRowsFromConvex({
        teamId: params.teamId,
        scope,
        direction: params.direction,
        currency: context.currency,
        dateFrom: params.from,
        dateTo: params.to,
      });

      return {
        targetCurrency: context.currency,
        countryCode: context.countryCode,
        rows,
      };
    },
  );
}

export async function getReportInvoiceDateAggregateRows(
  db: Database,
  params: {
    teamId: string;
    statuses: ProjectedInvoiceRecord["status"][];
    dateField: InvoiceAggregateDateField;
    inputCurrency?: string;
    from?: string;
    to?: string;
    recurring?: boolean;
  },
) {
  const normalizedStatuses = normalizeReportInvoiceStatuses(params.statuses);

  if (!normalizedStatuses || normalizedStatuses.length === 0) {
    return null;
  }

  return getOrSetQueryCacheValue(
    db,
    createQueryCacheKey("reports:invoice-date-aggregates", {
      teamId: params.teamId,
      statuses: normalizedStatuses,
      dateField: params.dateField,
      inputCurrency: params.inputCurrency ?? null,
      from: params.from
        ? normalizeTimestampBoundary(params.from, "start")
        : null,
      to: params.to ? normalizeTimestampBoundary(params.to, "end") : null,
      recurring: params.recurring ?? null,
    }),
    async () => {
      const rows = await getInvoiceDateAggregateRowsFromConvex({
        teamId: params.teamId,
        statuses: normalizedStatuses,
        dateField: params.dateField,
        dateFrom: params.from
          ? normalizeTimestampBoundary(params.from, "start")
          : null,
        dateTo: params.to ? normalizeTimestampBoundary(params.to, "end") : null,
        currency: params.inputCurrency ?? null,
        recurring: params.recurring,
      });

      return rows.length > 0 ? rows : null;
    },
  );
}

export async function getReportInvoiceAgingAggregateRows(
  db: Database,
  params: {
    teamId: string;
    statuses: ProjectedInvoiceRecord["status"][];
    inputCurrency?: string;
  },
) {
  const normalizedStatuses = normalizeReportInvoiceStatuses(params.statuses);

  if (!normalizedStatuses || normalizedStatuses.length === 0) {
    return null;
  }

  return getOrSetQueryCacheValue(
    db,
    createQueryCacheKey("reports:invoice-aging-aggregates", {
      teamId: params.teamId,
      statuses: normalizedStatuses,
      inputCurrency: params.inputCurrency ?? null,
    }),
    async () => {
      const rows = await getInvoiceAgingAggregateRowsFromConvex({
        teamId: params.teamId,
        statuses: normalizedStatuses,
        currency: params.inputCurrency ?? null,
      });

      return rows.length > 0 ? rows : null;
    },
  );
}

export async function getReportInboxLiabilityAggregateRows(
  db: Database,
  params: {
    teamId: string;
    from?: string;
    to?: string;
  },
) {
  return getOrSetQueryCacheValue(
    db,
    createQueryCacheKey("reports:inbox-liability-aggregates", {
      teamId: params.teamId,
      from: params.from ?? null,
      to: params.to ?? null,
    }),
    () =>
      getInboxLiabilityAggregateRowsFromConvex({
        teamId: params.teamId,
        dateFrom: params.from ?? null,
        dateTo: params.to ?? null,
      }),
  );
}

export function buildMonthlyAggregateSeriesMap(
  rows: ReportTransactionAggregateRow[],
  getValue: (row: ReportTransactionAggregateRow) => number,
) {
  const monthlyValues = new Map<string, number>();

  for (const row of rows) {
    const month = getMonthBucket(row.date);
    monthlyValues.set(
      month,
      roundMoney((monthlyValues.get(month) ?? 0) + getValue(row)),
    );
  }

  return monthlyValues;
}

function normalizeReportInvoiceStatuses(
  statuses?: ProjectedInvoiceRecord["status"][],
) {
  if (!statuses || statuses.length === 0) {
    return null;
  }

  return [...new Set(statuses)].sort();
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
