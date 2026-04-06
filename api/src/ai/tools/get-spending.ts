import { spendingArtifact } from "@tamias/ai-artifacts/spending";
import { db } from "@tamias/app-data/client";
import { getSpending, getSpendingForPeriod } from "@tamias/app-data/queries";
import { getTransactionsPage } from "@tamias/app-services/transactions";
import { formatAmount, formatDate } from "@tamias/utils/format";
import { generateText, tool } from "ai";
import { endOfMonth, parseISO, startOfMonth } from "date-fns";
import { z } from "zod";
import { getAssistantModel } from "../providers";
import {
  getToolAppContext,
  getToolTeamId,
  resolveReportToolParams,
  startArtifactStream,
  throwIfBankAccountsRequired,
} from "../utils/tool-runtime";

const getSpendingSchema = z.object({
  period: z
    .enum(["3-months", "6-months", "this-year", "1-year", "2-years", "5-years"])
    .optional()
    .describe("Historical period"),
  from: z.string().optional().describe("Start date (yyyy-MM-dd)"),
  to: z.string().optional().describe("End date (yyyy-MM-dd)"),
  currency: z.string().nullable().optional().describe("Currency code"),
  showCanvas: z.boolean().default(false).describe("Show visual canvas"),
});

export const getSpendingTool = tool({
  description: "Analyze spending patterns - totals, top transactions, category breakdown.",
  inputSchema: getSpendingSchema,
  execute: async function* ({ period, from, to, currency, showCanvas }, executionOptions) {
    const appContext = getToolAppContext(executionOptions);
    const teamId = getToolTeamId(appContext);

    if (!teamId) {
      yield {
        text: "Unable to retrieve spending data: Team ID not found in context.",
      };
      return {
        totalSpending: 0,
        currency: currency || appContext.baseCurrency || "USD",
        currentMonthSpending: 0,
        averageMonthlySpending: 0,
        topCategory: null,
        transactions: [],
      };
    }

    throwIfBankAccountsRequired(appContext);

    try {
      const { finalFrom, finalTo, finalCurrency, description, locale } = resolveReportToolParams({
        toolName: "getSpending",
        appContext,
        aiParams: { period, from, to, currency },
      });
      const analysis = startArtifactStream({
        enabled: showCanvas,
        executionOptions,
        artifact: spendingArtifact,
        input: {
          stage: "loading",
          currency: finalCurrency || "USD",
          from: finalFrom,
          to: finalTo,
          description,
        },
      });

      const targetCurrency = finalCurrency || "USD";

      const currentMonthStart = startOfMonth(new Date());
      const currentMonthEnd = endOfMonth(new Date());
      const [spendingCategories, periodSummary, transactionsResult, currentMonthSummary] =
        await Promise.all([
          getSpending(db, {
            teamId,
            from: finalFrom,
            to: finalTo,
            currency: finalCurrency ?? undefined,
          }),
          getSpendingForPeriod(db, {
            teamId,
            from: finalFrom,
            to: finalTo,
            currency: finalCurrency ?? undefined,
          }),
          getTransactionsPage({
            db,
            teamId,
            input: {
              type: "expense",
              start: finalFrom,
              end: finalTo,
              sort: ["amount", "asc"], // Ascending because expenses are negative, so smallest (most negative) = largest expense
              pageSize: 10,
            },
          }),
          getSpendingForPeriod(db, {
            teamId,
            from: currentMonthStart.toISOString(),
            to: currentMonthEnd.toISOString(),
            currency: finalCurrency ?? undefined,
          }),
        ]);

      const totalSpending = periodSummary.totalSpending;
      const topCategory = periodSummary.topCategory;

      // Format transactions, calculate share percentages, and sort by absolute amount descending
      const formattedTransactions = transactionsResult.data
        .map((transaction) => {
          const amount = Math.abs(transaction.amount);
          const share = totalSpending > 0 ? (amount / totalSpending) * 100 : 0;

          return {
            id: transaction.id,
            date: formatDate(transaction.date),
            vendor: transaction.name,
            category: transaction.category?.name || "Uncategorized",
            amount,
            share: Math.round(share * 10) / 10, // Round to 1 decimal place
          };
        })
        .sort((a, b) => b.amount - a.amount) // Sort descending by absolute amount
        .slice(0, 10); // Take top 10

      // Calculate average monthly spending
      const fromDate = parseISO(finalFrom);
      const toDate = parseISO(finalTo);
      const monthsDiff =
        (toDate.getFullYear() - fromDate.getFullYear()) * 12 +
        (toDate.getMonth() - fromDate.getMonth()) +
        1;
      const averageMonthlySpending = monthsDiff > 0 ? totalSpending / monthsDiff : totalSpending;

      const currentMonthSpending = currentMonthSummary.totalSpending;

      // Update artifact with metrics
      if (showCanvas && analysis) {
        await analysis.update({
          stage: "metrics_ready",
          currency: targetCurrency,
          from: finalFrom,
          to: finalTo,
          description,
          metrics: {
            totalSpending,
            averageMonthlySpending,
            currentMonthSpending,
            topCategory: topCategory
              ? {
                  name: topCategory.name,
                  amount: topCategory.amount,
                  percentage: topCategory.percentage,
                }
              : undefined,
          },
          transactions: formattedTransactions,
        });
      }

      // Generate AI summary and recommendations
      const categoryBreakdown = spendingCategories
        .slice(0, 5)
        .map(
          (cat) =>
            `${cat.name}: ${formatAmount({
              amount: cat.amount,
              currency: targetCurrency,
              locale,
            })} (${cat.percentage.toFixed(1)}%)`,
        )
        .join(", ");

      const topTransactionsText = formattedTransactions
        .slice(0, 5)
        .map(
          (t) =>
            `${t.vendor} (${t.category}): ${formatAmount({
              amount: t.amount,
              currency: targetCurrency,
              locale,
            })} - ${t.share.toFixed(1)}%`,
        )
        .join("\n");

      const analysisResult = await generateText({
        model: getAssistantModel(appContext.aiProvider, "small"),
        messages: [
          {
            role: "user",
            content: `Analyze this spending data for ${appContext.companyName || "the business"}:

Total Spending: ${formatAmount({
              amount: totalSpending,
              currency: targetCurrency,
              locale,
            })}
Current Month Spending: ${formatAmount({
              amount: currentMonthSpending,
              currency: targetCurrency,
              locale,
            })}
Average Monthly Spending: ${formatAmount({
              amount: averageMonthlySpending,
              currency: targetCurrency,
              locale,
            })}
Top Category: ${topCategory?.name || "N/A"} - ${topCategory?.percentage.toFixed(1) || 0}% of total

Top Spending Categories:
${categoryBreakdown}

Top 5 Largest Transactions:
${topTransactionsText}

Provide a concise analysis (2-3 sentences) of the key spending patterns and trends, followed by 2-3 actionable recommendations for cost optimization. Write it as natural, flowing text.`,
          },
        ],
      });

      // Use the AI response as the summary text
      const summaryText =
        analysisResult.text.trim() ||
        `Total spending of ${formatAmount({
          amount: totalSpending,
          currency: targetCurrency,
          locale,
        })} with ${topCategory?.name || "various categories"} representing the largest share.`;

      // Update artifact with analysis
      if (showCanvas && analysis) {
        await analysis.update({
          stage: "analysis_ready",
          currency: targetCurrency,
          from: finalFrom,
          to: finalTo,
          description,
          metrics: {
            totalSpending,
            averageMonthlySpending,
            currentMonthSpending,
            topCategory: topCategory
              ? {
                  name: topCategory.name,
                  amount: topCategory.amount,
                  percentage: topCategory.percentage,
                }
              : undefined,
          },
          transactions: formattedTransactions,
          analysis: {
            summary: summaryText,
            recommendations: [],
          },
        });
      }

      // Format text response
      const formattedTotalSpending = formatAmount({
        amount: totalSpending,
        currency: targetCurrency,
        locale,
      });

      let responseText_output = `**Total Spending:** ${formattedTotalSpending}\n\n`;

      if (topCategory) {
        responseText_output += `**Top Category:** ${topCategory.name} - ${formatAmount({
          amount: topCategory.amount,
          currency: targetCurrency,
          locale,
        })} (${topCategory.percentage.toFixed(1)}% of total)\n\n`;
      }

      // Only show detailed transaction table, summary, and recommendations if canvas is not shown
      if (!showCanvas) {
        if (formattedTransactions.length > 0) {
          responseText_output += `**Top ${formattedTransactions.length} Largest Transactions:**\n\n`;
          responseText_output += "| Date | Vendor | Category | Amount | Share |\n";
          responseText_output += "|------|--------|----------|--------|------|\n";

          for (const transaction of formattedTransactions) {
            const formattedAmount = formatAmount({
              amount: transaction.amount,
              currency: targetCurrency,
              locale,
            });
            responseText_output += `| ${transaction.date} | ${transaction.vendor} | ${transaction.category} | ${formattedAmount} | ${transaction.share.toFixed(1)}% |\n`;
          }
          responseText_output += "\n";
        }

        responseText_output += `**Summary & Recommendations:**\n\n${summaryText}\n\n`;
      } else {
        // When canvas is shown, just mention that detailed analysis is available
        responseText_output +=
          "\n\nA detailed visual spending analysis with transaction details, charts, and insights is available.";
      }

      yield { text: responseText_output };

      return {
        totalSpending,
        currency: targetCurrency,
        currentMonthSpending,
        averageMonthlySpending,
        topCategory: topCategory
          ? {
              name: topCategory.name,
              amount: topCategory.amount,
              percentage: topCategory.percentage,
            }
          : null,
        transactions: formattedTransactions,
      };
    } catch (error) {
      yield {
        text: `Failed to retrieve spending data: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
      return {
        totalSpending: 0,
        currency: currency || appContext.baseCurrency || "USD",
        currentMonthSpending: 0,
        averageMonthlySpending: 0,
        topCategory: null,
        transactions: [],
      };
    }
  },
});
