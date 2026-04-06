import { tool } from "ai";
import { format, parseISO } from "date-fns";
import { z } from "zod";
import {
  getToolAppContext,
  getToolTeamId,
  resolveReportToolParams,
  throwIfBankAccountsRequired,
} from "../utils/tool-runtime";
import {
  generateMetricsBreakdownAnalysis,
  generateMultiMonthMetricsBreakdownAnalysis,
} from "./metrics-breakdown/analysis";
import {
  startMetricsBreakdownSummaryArtifact,
  startMonthlyBreakdownArtifacts,
} from "./metrics-breakdown/artifacts";
import {
  aggregateMonthlyBreakdownResults,
  createMonthlyBreakdownData,
  getMetricsBreakdownPeriodData,
} from "./metrics-breakdown/data";
import { spansMultipleMonths, splitDateRangeByMonth } from "./metrics-breakdown/periods";
import {
  buildMultiMonthBreakdownResponse,
  buildSinglePeriodBreakdownResponse,
} from "./metrics-breakdown/responses";
import type { BreakdownSummary, MonthlyBreakdownData } from "./metrics-breakdown/types";

const getMetricsBreakdownSchema = z.object({
  period: z
    .enum(["3-months", "6-months", "this-year", "1-year", "2-years", "5-years"])
    .optional()
    .describe("Historical period"),
  from: z.string().optional().describe("Start date (yyyy-MM-dd)"),
  to: z.string().optional().describe("End date (yyyy-MM-dd)"),
  currency: z.string().nullable().optional().describe("Currency code"),
  chartType: z.string().optional().describe("Type of chart that triggered this breakdown"),
  showCanvas: z.boolean().default(true).describe("Show visual analytics"),
});

export const getMetricsBreakdownTool = tool({
  description:
    "Get a comprehensive breakdown of financial metrics for a specific period. Use this tool when the user requests a 'breakdown', 'break down', 'show me a breakdown', 'breakdown of', 'detailed breakdown', or 'comprehensive breakdown' of any financial metric (revenue, expenses, profit, burn rate, etc.). Provides revenue, expenses, profit, transactions, category breakdowns, and analysis. ALWAYS use this tool (not getBurnRate, getRevenueSummary, etc.) when 'breakdown' is mentioned in the request. " +
    "IMPORTANT: Use the 'period' parameter for standard time ranges.",
  inputSchema: getMetricsBreakdownSchema,
  execute: async function* (
    { period, from, to, currency, chartType, showCanvas },
    executionOptions,
  ) {
    const appContext = getToolAppContext(executionOptions);
    const teamId = getToolTeamId(appContext);

    if (!teamId) {
      yield {
        text: "Unable to retrieve metrics breakdown: Team ID not found in context.",
      };
      return {
        summary: {
          revenue: 0,
          expenses: 0,
          profit: 0,
          transactionCount: 0,
        },
        transactions: [],
        categories: [],
        currency: currency || appContext.baseCurrency || "USD",
      };
    }

    throwIfBankAccountsRequired(appContext);

    try {
      const { finalFrom, finalTo, finalCurrency, description, locale } = resolveReportToolParams({
        toolName: "getMetricsBreakdown",
        appContext,
        aiParams: { period, from, to, currency },
      });
      const targetCurrency = finalCurrency || "USD";

      if (showCanvas && spansMultipleMonths(finalFrom, finalTo)) {
        const monthlyPeriods = splitDateRangeByMonth(finalFrom, finalTo);
        const monthlyArtifacts = startMonthlyBreakdownArtifacts({
          executionOptions,
          periods: monthlyPeriods,
          currency: targetCurrency,
          chartType,
        });

        const totalSummary: BreakdownSummary = {
          revenue: 0,
          expenses: 0,
          profit: 0,
          transactionCount: 0,
        };
        const monthlyData: MonthlyBreakdownData[] = [];

        for (const monthlyArtifact of monthlyArtifacts) {
          const monthResult = await getMetricsBreakdownPeriodData({
            teamId,
            from: monthlyArtifact.period.from,
            to: monthlyArtifact.period.to,
            finalCurrency,
            targetCurrency,
            locale,
          });

          totalSummary.revenue += monthResult.summary.revenue;
          totalSummary.expenses += monthResult.summary.expenses;
          totalSummary.profit += monthResult.summary.profit;
          totalSummary.transactionCount += monthResult.summary.transactionCount;

          monthlyData.push(
            createMonthlyBreakdownData({
              monthKey: monthlyArtifact.period.monthKey,
              from: monthlyArtifact.period.from,
              result: monthResult,
            }),
          );

          await monthlyArtifact.artifact.update({
            stage: "metrics_ready",
            currency: targetCurrency,
            from: monthlyArtifact.period.from,
            to: monthlyArtifact.period.to,
            displayDate: monthlyArtifact.period.from,
            description: monthlyArtifact.description,
            chartType: chartType || undefined,
            summary: monthResult.summary,
            transactions: monthResult.transactions,
            categories: monthResult.categories as any,
          });

          const monthSummaryText = await generateMetricsBreakdownAnalysis({
            appContext,
            periodLabel: `for ${monthlyArtifact.description}`,
            targetCurrency,
            locale,
            summary: monthResult.summary,
            categories: monthResult.categories,
            transactions: monthResult.transactions,
          });

          await monthlyArtifact.artifact.update({
            stage: "analysis_ready",
            displayDate: monthlyArtifact.period.from,
            analysis: {
              summary: monthSummaryText,
              recommendations: [],
            },
          });
        }

        const aggregated = aggregateMonthlyBreakdownResults({
          monthlyData,
          summary: {
            revenue: totalSummary.revenue,
            expenses: totalSummary.expenses,
          },
          targetCurrency,
          locale,
          from: finalFrom,
          to: finalTo,
        });

        const summaryText = await generateMultiMonthMetricsBreakdownAnalysis({
          appContext,
          from: finalFrom,
          to: finalTo,
          targetCurrency,
          locale,
          summary: totalSummary,
          monthlyData,
          categories: aggregated.categories,
          transactions: aggregated.transactions,
        });

        yield {
          text: buildMultiMonthBreakdownResponse({
            from: finalFrom,
            to: finalTo,
            summary: totalSummary,
            summaryText,
            monthCount: monthlyPeriods.length,
            targetCurrency,
            locale,
          }),
        };

        return {
          summary: totalSummary,
          transactions: aggregated.formattedTransactions,
          categories: aggregated.categories,
          currency: targetCurrency,
        };
      }

      const summaryArtifact = startMetricsBreakdownSummaryArtifact({
        enabled: showCanvas,
        executionOptions,
        currency: targetCurrency,
        from: finalFrom,
        to: finalTo,
        chartType,
      });

      const periodResult = await getMetricsBreakdownPeriodData({
        teamId,
        from: finalFrom,
        to: finalTo,
        finalCurrency,
        targetCurrency,
        locale,
      });

      if (summaryArtifact) {
        await summaryArtifact.update({
          stage: "metrics_ready",
          currency: targetCurrency,
          from: finalFrom,
          to: finalTo,
          displayDate: finalFrom,
          description,
          chartType: chartType || undefined,
          summary: periodResult.summary,
          transactions: periodResult.transactions,
          categories: periodResult.categories as any,
        });
      }

      const summaryText = await generateMetricsBreakdownAnalysis({
        appContext,
        periodLabel: `from ${format(parseISO(finalFrom), "MMM d, yyyy")} to ${format(parseISO(finalTo), "MMM d, yyyy")}`,
        targetCurrency,
        locale,
        summary: periodResult.summary,
        categories: periodResult.categories,
        transactions: periodResult.transactions,
      });

      if (summaryArtifact) {
        await summaryArtifact.update({
          stage: "analysis_ready",
          displayDate: finalFrom,
          analysis: {
            summary: summaryText,
            recommendations: [],
          },
        });
      }

      yield {
        text: buildSinglePeriodBreakdownResponse({
          showCanvas,
          from: finalFrom,
          to: finalTo,
          summary: periodResult.summary,
          categories: periodResult.categories,
          transactions: periodResult.transactions,
          targetCurrency,
          locale,
        }),
      };

      return {
        summary: periodResult.summary,
        transactions: periodResult.transactions,
        categories: periodResult.categories,
        currency: targetCurrency,
      };
    } catch (error) {
      yield {
        text: `Failed to retrieve metrics breakdown: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
      throw error;
    }
  },
});
