import {
  buildNameMap,
  groupTransactionsByCategory,
  roundMoney,
  sumExpenseTransactions,
  sumRevenueTransactions,
} from "./helpers";
import type { BalanceSheetContext, BalanceSheetResult } from "./types";

const EQUITY_CATEGORY_SLUGS = ["capital-investment", "owner-draws"];

export async function buildBalanceSheetEquity(
  context: BalanceSheetContext,
): Promise<BalanceSheetResult["equity"]> {
  const equityTransactions = groupTransactionsByCategory(
    context.transactions,
    EQUITY_CATEGORY_SLUGS,
  );
  const equityMap = new Map<string, number>();
  const equityNameMap = buildNameMap(equityTransactions, context.countryCode);

  for (const item of equityTransactions) {
    const slug = item.categorySlug || "";
    equityMap.set(slug, Number(item.amount) || 0);
  }

  const capitalInvestment: number = equityMap.get("capital-investment") || 0;
  const ownerDrawsRaw: number = equityMap.get("owner-draws") || 0;
  const ownerDraws: number = Math.abs(ownerDrawsRaw);
  const totalRevenue: number = sumRevenueTransactions(context.transactions);
  const totalExpenses: number = sumExpenseTransactions(context.transactions);
  const retainedEarnings: number = totalRevenue - totalExpenses;

  const total = capitalInvestment - ownerDraws + retainedEarnings;

  return {
    capitalInvestment: roundMoney(capitalInvestment),
    capitalInvestmentName: equityNameMap.get("capital-investment"),
    ownerDraws: roundMoney(ownerDraws),
    ownerDrawsName: equityNameMap.get("owner-draws"),
    retainedEarnings: roundMoney(retainedEarnings),
    total: roundMoney(total),
  };
}
