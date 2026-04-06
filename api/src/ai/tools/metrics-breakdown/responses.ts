import { formatAmount } from "@tamias/utils/format";
import { format, parseISO } from "date-fns";
import type {
  BreakdownCategory,
  BreakdownSummary,
  BreakdownTransaction,
} from "./types";

export function buildMultiMonthBreakdownResponse(options: {
  from: string;
  to: string;
  summary: BreakdownSummary;
  summaryText: string;
  monthCount: number;
  targetCurrency: string;
  locale: string;
}) {
  const formattedRevenue = formatAmount({
    amount: options.summary.revenue,
    currency: options.targetCurrency,
    locale: options.locale,
  });
  const formattedExpenses = formatAmount({
    amount: options.summary.expenses,
    currency: options.targetCurrency,
    locale: options.locale,
  });
  const formattedProfit = formatAmount({
    amount: options.summary.profit,
    currency: options.targetCurrency,
    locale: options.locale,
  });

  let responseText = `Financial breakdown for ${format(parseISO(options.from), "MMM d, yyyy")} to ${format(parseISO(options.to), "MMM d, yyyy")}: ${formattedRevenue} in revenue, ${formattedExpenses} in expenses, resulting in ${formattedProfit} profit across ${options.monthCount} month${options.monthCount > 1 ? "s" : ""}.\n\n`;
  responseText += `${options.summaryText}\n\n`;
  responseText += "Detailed monthly breakdowns are available for each month.";

  return responseText;
}

export function buildSinglePeriodBreakdownResponse(options: {
  showCanvas: boolean;
  from: string;
  to: string;
  summary: BreakdownSummary;
  categories: BreakdownCategory[];
  transactions: BreakdownTransaction[];
  targetCurrency: string;
  locale: string;
}) {
  const formattedRevenue = formatAmount({
    amount: options.summary.revenue,
    currency: options.targetCurrency,
    locale: options.locale,
  });
  const formattedExpenses = formatAmount({
    amount: options.summary.expenses,
    currency: options.targetCurrency,
    locale: options.locale,
  });
  const formattedProfit = formatAmount({
    amount: options.summary.profit,
    currency: options.targetCurrency,
    locale: options.locale,
  });

  if (options.showCanvas) {
    return `Financial breakdown for ${format(parseISO(options.from), "MMM d, yyyy")} to ${format(parseISO(options.to), "MMM d, yyyy")}: ${formattedRevenue} in revenue, ${formattedExpenses} in expenses, resulting in ${formattedProfit} profit.\n\nA detailed visual breakdown with transactions, categories, and analysis is available.`;
  }

  let responseText = "**Financial Breakdown**\n\n";
  responseText += "**Summary:**\n";
  responseText += `- Revenue: ${formattedRevenue}\n`;
  responseText += `- Expenses: ${formattedExpenses}\n`;
  responseText += `- Profit: ${formattedProfit}\n`;
  responseText += `- Transactions: ${options.summary.transactionCount}\n\n`;

  if (options.categories.length > 0) {
    responseText += "**Top Categories:**\n";
    for (const category of options.categories.slice(0, 5)) {
      responseText += `- ${category.name}: ${formatAmount({
        amount: category.amount,
        currency: options.targetCurrency,
        locale: options.locale,
      })} (${category.percentage.toFixed(1)}%)\n`;
    }
    responseText += "\n";
  }

  if (options.transactions.length > 0) {
    responseText += "**Top Transactions:**\n";
    for (const transaction of options.transactions.slice(0, 5)) {
      responseText += `- ${transaction.name}: ${transaction.formattedAmount} (${transaction.category})\n`;
    }
  }

  return responseText;
}
