import { UTCDate } from "@date-fns/utc";
import { endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import type { Database } from "../../client";
import { reuseQueryResult } from "../../utils/request-cache";
import {
  getCategoryInfo,
  getExcludedCategorySlugs,
  getReportTransactionTaxAggregateRows,
  humanizeCategorySlug,
  roundMoney,
} from "./shared";

export type GetTaxParams = {
  teamId: string;
  type: "paid" | "collected";
  from: string;
  to: string;
  categorySlug?: string;
  taxType?: string;
  currency?: string;
};

async function getTaxSummaryImpl(db: Database, params: GetTaxParams) {
  const {
    teamId,
    type,
    from,
    to,
    categorySlug,
    taxType,
    currency: inputCurrency,
  } = params;

  const fromDate = format(
    startOfMonth(new UTCDate(parseISO(from))),
    "yyyy-MM-dd",
  );
  const toDate = format(endOfMonth(new UTCDate(parseISO(to))), "yyyy-MM-dd");
  const excludedCategorySlugs = getExcludedCategorySlugs();
  const direction = type === "paid" ? "expense" : "income";
  const { countryCode, targetCurrency, rows } =
    await getReportTransactionTaxAggregateRows(db, {
      teamId,
      direction,
      from: fromDate,
      to: toDate,
      inputCurrency,
    });
  const grouped = new Map<
    string,
    {
      category_slug: string;
      total_tax_amount: number;
      total_transaction_amount: number;
      transaction_count: number;
      total_tax_rate: number;
      tax_type: string | null;
      currency: string | null;
      earliest_date: string;
      latest_date: string;
    }
  >();

  for (const row of rows) {
    const slug = row.categorySlug;

    if (slug && excludedCategorySlugs.includes(slug)) {
      continue;
    }

    if (categorySlug && slug !== categorySlug) {
      continue;
    }

    if (taxType && row.taxType !== taxType) {
      continue;
    }

    const resolvedSlug = slug ?? "uncategorized";
    const resolvedCurrency = row.currency ?? targetCurrency ?? inputCurrency;
    const key = `${resolvedSlug}:${row.taxType ?? ""}:${resolvedCurrency ?? ""}`;
    const existing = grouped.get(key);

    if (existing) {
      existing.total_tax_amount += row.totalTaxAmount;
      existing.total_transaction_amount += Math.abs(row.totalTransactionAmount);
      existing.transaction_count += row.transactionCount;
      existing.total_tax_rate += row.taxRate * row.transactionCount;

      if (row.date < existing.earliest_date) {
        existing.earliest_date = row.date;
      }

      if (row.date > existing.latest_date) {
        existing.latest_date = row.date;
      }

      continue;
    }

    grouped.set(key, {
      category_slug: resolvedSlug,
      total_tax_amount: row.totalTaxAmount,
      total_transaction_amount: Math.abs(row.totalTransactionAmount),
      transaction_count: row.transactionCount,
      total_tax_rate: row.taxRate * row.transactionCount,
      tax_type: row.taxType,
      currency: resolvedCurrency,
      earliest_date: row.date,
      latest_date: row.date,
    });
  }

  const processedData = Array.from(grouped.values())
    .map((item) => ({
      category_slug: item.category_slug,
      category_name:
        getCategoryInfo(item.category_slug, countryCode)?.name ??
        humanizeCategorySlug(item.category_slug),
      total_tax_amount: roundMoney(item.total_tax_amount),
      total_transaction_amount: roundMoney(item.total_transaction_amount),
      transaction_count: item.transaction_count,
      avg_tax_rate: roundMoney(item.total_tax_rate / item.transaction_count),
      tax_type: item.tax_type,
      currency: item.currency,
      earliest_date: item.earliest_date,
      latest_date: item.latest_date,
    }))
    .sort((left, right) => right.total_tax_amount - left.total_tax_amount);

  const totalTaxAmount = Number(
    (
      processedData.reduce((sum, item) => sum + item.total_tax_amount, 0) ?? 0
    ).toFixed(2),
  );
  const totalTransactionAmount = Number(
    (
      processedData.reduce(
        (sum, item) => sum + item.total_transaction_amount,
        0,
      ) ?? 0
    ).toFixed(2),
  );
  const totalTransactions = processedData.reduce(
    (sum, item) => sum + item.transaction_count,
    0,
  );

  return {
    summary: {
      totalTaxAmount,
      totalTransactionAmount,
      totalTransactions,
      categoryCount: processedData.length,
      type,
      currency: processedData.at(0)?.currency ?? inputCurrency,
    },
    meta: {
      type: "tax",
      taxType: type,
      currency: processedData.at(0)?.currency ?? inputCurrency,
      period: {
        from,
        to,
      },
    },
    result: processedData,
  };
}

export const getTaxSummary = reuseQueryResult({
  keyPrefix: "tax-summary",
  keyFn: (params: GetTaxParams) =>
    [
      params.teamId,
      params.type,
      params.from,
      params.to,
      params.categorySlug ?? "",
      params.taxType ?? "",
      params.currency ?? "",
    ].join(":"),
  load: getTaxSummaryImpl,
});
