import { formatAmount } from "@tamias/utils/format";
import { generateText } from "ai";
import { format, parseISO } from "date-fns";
import type { AppContext } from "../../agents/config/shared";
import { getAssistantModel } from "../../providers";
import type {
  AggregatedBreakdownTransaction,
  BreakdownCategory,
  BreakdownSummary,
  BreakdownTransaction,
  MonthlyBreakdownData,
} from "./types";

function getCompanyName(appContext: AppContext) {
  return appContext.companyName || "the business";
}

function createSummaryFallback(options: {
  summary: BreakdownSummary;
  targetCurrency: string;
  locale: string;
}) {
  return `Financial breakdown showing ${formatAmount({ amount: options.summary.revenue, currency: options.targetCurrency, locale: options.locale })} in revenue, ${formatAmount({ amount: options.summary.expenses, currency: options.targetCurrency, locale: options.locale })} in expenses, resulting in ${formatAmount({ amount: options.summary.profit, currency: options.targetCurrency, locale: options.locale })} profit.`;
}

export async function generateMetricsBreakdownAnalysis(options: {
  appContext: AppContext;
  periodLabel: string;
  targetCurrency: string;
  locale: string;
  summary: BreakdownSummary;
  categories: BreakdownCategory[];
  transactions: BreakdownTransaction[];
}) {
  const analysisResult = await generateText({
    model: getAssistantModel(options.appContext.aiProvider, "small"),
    messages: [
      {
        role: "user",
        content: `Analyze this financial breakdown for ${getCompanyName(options.appContext)} ${options.periodLabel}:

Revenue: ${formatAmount({ amount: options.summary.revenue, currency: options.targetCurrency, locale: options.locale })}
Expenses: ${formatAmount({ amount: options.summary.expenses, currency: options.targetCurrency, locale: options.locale })}
Profit: ${formatAmount({ amount: options.summary.profit, currency: options.targetCurrency, locale: options.locale })}
Transactions: ${options.summary.transactionCount}

Top Categories:
${options.categories
  .slice(0, 5)
  .map(
    (category) =>
      `- ${category.name}: ${formatAmount({ amount: category.amount, currency: options.targetCurrency, locale: options.locale })} (${category.percentage.toFixed(1)}%)`,
  )
  .join("\n")}

Top Transactions:
${options.transactions
  .slice(0, 5)
  .map(
    (transaction) =>
      `- ${transaction.name}: ${transaction.formattedAmount} (${transaction.category})`,
  )
  .join("\n")}

Provide a concise analysis (3-4 sentences) highlighting key insights, trends, and notable patterns. Focus on spending patterns, category distribution, and significant transactions. Write it as natural, flowing text.`,
      },
    ],
  });

  return (
    analysisResult.text.trim() ||
    createSummaryFallback({
      summary: options.summary,
      targetCurrency: options.targetCurrency,
      locale: options.locale,
    })
  );
}

export async function generateMultiMonthMetricsBreakdownAnalysis(options: {
  appContext: AppContext;
  from: string;
  to: string;
  targetCurrency: string;
  locale: string;
  summary: BreakdownSummary;
  monthlyData: MonthlyBreakdownData[];
  categories: BreakdownCategory[];
  transactions: AggregatedBreakdownTransaction[];
}) {
  const monthlyComparison = options.monthlyData
    .map(
      (month) =>
        `${month.monthLabel}: Revenue ${formatAmount({
          amount: month.revenue,
          currency: options.targetCurrency,
          locale: options.locale,
        })}, Expenses ${formatAmount({
          amount: month.expenses,
          currency: options.targetCurrency,
          locale: options.locale,
        })}, Profit ${formatAmount({
          amount: month.profit,
          currency: options.targetCurrency,
          locale: options.locale,
        })}`,
    )
    .join("\n");

  const analysisResult = await generateText({
    model: getAssistantModel(options.appContext.aiProvider, "small"),
    messages: [
      {
        role: "user",
        content: `Analyze this multi-month financial breakdown for ${getCompanyName(options.appContext)} from ${format(parseISO(options.from), "MMM d, yyyy")} to ${format(parseISO(options.to), "MMM d, yyyy")}:

Total Period Summary:
- Revenue: ${formatAmount({ amount: options.summary.revenue, currency: options.targetCurrency, locale: options.locale })}
- Expenses: ${formatAmount({ amount: options.summary.expenses, currency: options.targetCurrency, locale: options.locale })}
- Profit: ${formatAmount({ amount: options.summary.profit, currency: options.targetCurrency, locale: options.locale })}
- Transactions: ${options.summary.transactionCount}

Monthly Breakdown:
${monthlyComparison}

Top Categories (aggregated):
${options.categories
  .map(
    (category) =>
      `- ${category.name}: ${formatAmount({ amount: category.amount, currency: options.targetCurrency, locale: options.locale })} (${category.percentage.toFixed(1)}%)`,
  )
  .join("\n")}

Top Transactions (aggregated):
${options.transactions
  .map(
    (transaction) =>
      `- ${transaction.name}: ${transaction.formattedAmount} (${transaction.category})`,
  )
  .join("\n")}

Provide a concise analysis (3-4 sentences) highlighting:
1. Overall financial performance across the period
2. Key trends or differences between months
3. Notable spending patterns or significant transactions
Write it as natural, flowing text.`,
      },
    ],
  });

  return (
    analysisResult.text.trim() ||
    `Financial breakdown showing ${formatAmount({ amount: options.summary.revenue, currency: options.targetCurrency, locale: options.locale })} in total revenue, ${formatAmount({ amount: options.summary.expenses, currency: options.targetCurrency, locale: options.locale })} in total expenses, resulting in ${formatAmount({ amount: options.summary.profit, currency: options.targetCurrency, locale: options.locale })} profit across ${options.monthlyData.length} month${options.monthlyData.length > 1 ? "s" : ""}.`
  );
}
