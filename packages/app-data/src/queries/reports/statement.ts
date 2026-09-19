import { requireCloudflareD1Database, type Database } from "../../client";
import { getTeamReportContext } from "./shared/context";
import { humanizeCategorySlug } from "./shared/category-taxonomy";

export type StatementAnalyticsParams = {
  teamId: string;
  from?: string;
  to?: string;
  accountId?: string;
  currency?: string;
};

type SummaryRow = {
  count: number;
  firstDate: string | null;
  lastDate: string | null;
  moneyIn: number;
  moneyOut: number;
  spending: number;
  transfersIn: number;
  transfersOut: number;
  excludedIn: number;
  excludedOut: number;
  uncategorizedCount: number;
  unconvertedCount: number;
  unconvertedCurrencies: string | null;
};
type MonthRow = { month: string; moneyIn: number; moneyOut: number };
type CategoryRow = { slug: string; name: string | null; amount: number; count: number };
type MerchantRow = { name: string; amount: number; count: number };

const money = (value: number) => Math.round(value * 100) / 100;

/** Settled statement movements, independent of tax classifications or filing readiness. */
export async function getStatementAnalytics(db: Database, params: StatementAnalyticsParams) {
  const d1 = requireCloudflareD1Database(db);
  const context = await getTeamReportContext(db, params.teamId, params.currency);
  const currency = params.currency ?? context.baseCurrency ?? "GBP";
  const filters = ["t.team_id = ?", "t.status IN ('posted', 'completed', 'exported')"];
  const values: unknown[] = [currency, currency, params.teamId];
  if (params.from) {
    filters.push("t.date >= ?");
    values.push(params.from);
  }
  if (params.to) {
    filters.push("t.date <= ?");
    values.push(params.to);
  }
  if (params.accountId) {
    filters.push("t.bank_account_id = ?");
    values.push(params.accountId);
  }
  // Native amounts take priority; never add unlike currencies or invent an FX rate.
  // Transfer method alone is not sufficient: wages and CIS receipts also arrive by transfer.
  const source = `WITH movements AS (
    SELECT t.date, t.currency,
      ROUND(CASE WHEN t.currency = ? THEN t.amount
        WHEN t.base_currency = ? THEN t.base_amount ELSE NULL END * 100) / 100.0 AS amount,
      COALESCE(NULLIF(TRIM(t.merchant_name), ''), NULLIF(TRIM(t.counterparty_name), ''), t.name) AS merchant,
      COALESCE(t.category_slug, 'uncategorized') AS category,
      c.name AS categoryName,
      CASE WHEN t.internal = 1 OR t.category_slug IN ('transfer', 'internal-transfer', 'credit-card-payment', 'investment-movements', 'funds-held-for-others') THEN 'transfer'
        WHEN c.excluded = 1 THEN 'excluded' ELSE 'ordinary' END AS kind
    FROM transactions t
    LEFT JOIN transaction_categories c ON c.team_id = t.team_id AND c.slug = t.category_slug
    WHERE ${filters.join(" AND ")}
  )`;
  const queries = [
    `SELECT COUNT(amount) AS count, MIN(CASE WHEN amount IS NOT NULL THEN date END) AS firstDate,
      MAX(CASE WHEN amount IS NOT NULL THEN date END) AS lastDate,
      COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS moneyIn,
      COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0) AS moneyOut,
      COALESCE(SUM(CASE WHEN kind = 'ordinary' AND amount < 0 THEN -amount ELSE 0 END), 0) AS spending,
      COALESCE(SUM(CASE WHEN kind = 'transfer' AND amount > 0 THEN amount ELSE 0 END), 0) AS transfersIn,
      COALESCE(SUM(CASE WHEN kind = 'transfer' AND amount < 0 THEN -amount ELSE 0 END), 0) AS transfersOut,
      COALESCE(SUM(CASE WHEN kind = 'excluded' AND amount > 0 THEN amount ELSE 0 END), 0) AS excludedIn,
      COALESCE(SUM(CASE WHEN kind = 'excluded' AND amount < 0 THEN -amount ELSE 0 END), 0) AS excludedOut,
      COALESCE(SUM(CASE WHEN kind = 'ordinary' AND category = 'uncategorized' AND amount < 0 THEN 1 ELSE 0 END), 0) AS uncategorizedCount,
      COALESCE(SUM(CASE WHEN amount IS NULL THEN 1 ELSE 0 END), 0) AS unconvertedCount,
      GROUP_CONCAT(DISTINCT CASE WHEN amount IS NULL THEN currency END) AS unconvertedCurrencies
      FROM movements`,
    `SELECT SUBSTR(date, 1, 7) AS month,
      SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS moneyIn,
      SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS moneyOut
      FROM movements WHERE amount IS NOT NULL GROUP BY month ORDER BY month`,
    `SELECT category AS slug, categoryName AS name, SUM(-amount) AS amount, COUNT(*) AS count
      FROM movements WHERE amount < 0 AND kind = 'ordinary'
      GROUP BY category, categoryName ORDER BY amount DESC, category`,
    `SELECT merchant AS name, SUM(-amount) AS amount, COUNT(*) AS count
      FROM movements WHERE amount < 0 AND kind = 'ordinary'
      GROUP BY merchant COLLATE NOCASE ORDER BY amount DESC, merchant LIMIT 12`,
  ];
  const results = await d1.batch(
    queries.map((query) => d1.prepare(`${source} ${query}`).bind(...values)),
  );
  if (results.some((result) => result.success === false))
    throw new Error("Could not load statement analytics.");
  const summary = results[0]?.results?.[0] as SummaryRow | undefined;
  if (!summary) throw new Error("Could not load statement totals.");
  return {
    currency,
    from: params.from ?? summary.firstDate,
    to: params.to ?? summary.lastDate,
    summary: {
      ...summary,
      moneyIn: money(summary.moneyIn),
      moneyOut: money(summary.moneyOut),
      netMovement: money(summary.moneyIn - summary.moneyOut),
      spending: money(summary.spending),
      transfersIn: money(summary.transfersIn),
      transfersOut: money(summary.transfersOut),
      excludedIn: money(summary.excludedIn),
      excludedOut: money(summary.excludedOut),
    },
    months: ((results[1]?.results ?? []) as MonthRow[]).map((row) => ({
      ...row,
      moneyIn: money(row.moneyIn),
      moneyOut: money(row.moneyOut),
    })),
    categories: ((results[2]?.results ?? []) as CategoryRow[]).map((row) => ({
      ...row,
      name: row.name ?? humanizeCategorySlug(row.slug),
      amount: money(row.amount),
      percentage: summary.spending ? money((row.amount / summary.spending) * 100) : 0,
    })),
    merchants: ((results[3]?.results ?? []) as MerchantRow[]).map((row) => ({
      ...row,
      amount: money(row.amount),
    })),
  };
}

export type StatementAnalytics = Awaited<ReturnType<typeof getStatementAnalytics>>;
