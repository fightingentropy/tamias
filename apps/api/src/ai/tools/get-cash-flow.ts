import { getAssistantModel } from "../providers";
import { cashFlowArtifact } from "@tamias/ai-artifacts/cash-flow";
import { db } from "@tamias/app-data/client";
import { getCashFlow } from "@tamias/app-data/queries";
import { formatAmount } from "@tamias/utils/format";
import { generateText, tool } from "ai";
import { z } from "zod";
import {
  getToolAppContext,
  getToolTeamId,
  resolveReportToolParams,
  startArtifactStream,
  throwIfBankAccountsRequired,
} from "../utils/tool-runtime";

const getCashFlowSchema = z.object({
  dateRange: z
    .enum(["3-months", "6-months", "this-year", "1-year", "2-years", "5-years"])
    .optional()
    .describe("Historical period"),
  from: z.string().optional().describe("Start date (yyyy-MM-dd)"),
  to: z.string().optional().describe("End date (yyyy-MM-dd)"),
  currency: z.string().nullable().optional().describe("Currency code"),
  period: z
    .enum(["monthly", "quarterly"])
    .default("monthly")
    .describe("Aggregation: monthly (default) or quarterly")
    .optional(),
  showCanvas: z.boolean().default(false).describe("Show visual canvas"),
});

export const getCashFlowTool = tool({
  description:
    "Calculate net cash flow (income minus expenses) with monthly trends.",
  inputSchema: getCashFlowSchema,
  execute: async function* (
    { dateRange, from, to, currency, period, showCanvas },
    executionOptions,
  ) {
    const appContext = getToolAppContext(executionOptions);
    const teamId = getToolTeamId(appContext);

    if (!teamId) {
      yield {
        text: "Unable to retrieve cash flow: Team ID not found in context.",
      };
      return {
        netCashFlow: 0,
        currency: currency || appContext.baseCurrency || "USD",
        period: period || "monthly",
      };
    }

    throwIfBankAccountsRequired(appContext);

    try {
      const { resolved, finalFrom, finalTo, finalCurrency, description, locale } =
        resolveReportToolParams({
        toolName: "getCashFlow",
        appContext,
        aiParams: {
          dateRange,
          from,
          to,
          currency,
          // Pass through other params
          period,
          showCanvas,
        },
      });

      // Initialize artifact only if showCanvas is true
      const analysis = startArtifactStream({
        enabled: showCanvas,
        executionOptions,
        artifact: cashFlowArtifact,
        input: {
          stage: "loading",
          currency: finalCurrency || "USD",
          from: finalFrom,
          to: finalTo,
          description,
        },
      });

      const result = await getCashFlow(db, {
        teamId,
        from: finalFrom,
        to: finalTo,
        currency: finalCurrency ?? undefined,
        period: period ?? "monthly",
      });

      const targetCurrency =
        result.summary.currency || appContext.baseCurrency || "USD";
      const periodType = result.summary.period;

      // Calculate cumulative cash flow for chart
      let _cumulativeFlow = 0;
      const monthlyDataWithCumulative = result.monthlyData.map((item) => {
        _cumulativeFlow += item.netCashFlow;
        return {
          month: item.month,
          netCashFlow: item.netCashFlow,
          income: item.income,
          expenses: item.expenses,
        };
      });

      // Update artifact with chart data
      if (showCanvas && analysis) {
        await analysis.update({
          stage: "chart_ready",
          currency: targetCurrency,
          from: finalFrom,
          to: finalTo,
          description,
          chart: {
            monthlyData: monthlyDataWithCumulative,
          },
        });
      }

      // Calculate metrics
      const currentMonthlyCashFlow =
        monthlyDataWithCumulative.length > 0
          ? monthlyDataWithCumulative[monthlyDataWithCumulative.length - 1]
              ?.netCashFlow || 0
          : 0;

      const metrics = {
        netCashFlow: result.summary.netCashFlow,
        totalIncome: result.summary.totalIncome,
        totalExpenses: result.summary.totalExpenses,
        averageMonthlyCashFlow: result.summary.averageMonthlyCashFlow,
        currentMonthlyCashFlow,
      };

      // Calculate cash flow change percentage if we have multiple months
      let cashFlowChangePercentage = 0;
      let cashFlowChangePeriod = "";
      if (monthlyDataWithCumulative.length >= 2) {
        const firstMonth = monthlyDataWithCumulative[0]?.netCashFlow || 0;
        const lastMonth = currentMonthlyCashFlow;
        if (firstMonth !== 0) {
          cashFlowChangePercentage = Math.round(
            ((lastMonth - firstMonth) / Math.abs(firstMonth)) * 100,
          );
        }
        cashFlowChangePeriod = `${monthlyDataWithCumulative.length} months`;
      }

      // Update artifact with metrics
      if (showCanvas && analysis) {
        await analysis.update({
          stage: "metrics_ready",
          currency: targetCurrency,
          from: finalFrom,
          to: finalTo,
          description,
          chart: {
            monthlyData: monthlyDataWithCumulative,
          },
          metrics: {
            netCashFlow: metrics.netCashFlow,
            totalIncome: metrics.totalIncome,
            totalExpenses: metrics.totalExpenses,
            averageMonthlyCashFlow: metrics.averageMonthlyCashFlow,
          },
        });
      }

      // Generate AI analysis
      const analysisResult = await generateText({
        model: getAssistantModel(appContext.aiProvider, "small"),
        messages: [
          {
            role: "user",
            content: `Analyze this cash flow data for ${appContext.companyName || "the business"}:

Net Cash Flow: ${formatAmount({
              amount: Math.abs(metrics.netCashFlow),
              currency: targetCurrency,
              locale,
            })}
Total Income: ${formatAmount({
              amount: metrics.totalIncome,
              currency: targetCurrency,
              locale,
            })}
Total Expenses: ${formatAmount({
              amount: metrics.totalExpenses,
              currency: targetCurrency,
              locale,
            })}
Average Monthly Cash Flow: ${formatAmount({
              amount: Math.abs(metrics.averageMonthlyCashFlow),
              currency: targetCurrency,
              locale,
            })}
Current Monthly Cash Flow: ${formatAmount({
              amount: Math.abs(currentMonthlyCashFlow),
              currency: targetCurrency,
              locale,
            })}
${cashFlowChangePercentage !== 0 ? `Cash Flow Change: ${cashFlowChangePercentage > 0 ? "+" : ""}${cashFlowChangePercentage}% over ${cashFlowChangePeriod}` : ""}

Provide a concise analysis (2-3 sentences) highlighting key insights about the cash flow patterns, trends, and actionable recommendations for financial health. Write it as natural, flowing text.`,
          },
        ],
      });

      const summaryText =
        analysisResult.text.trim() ||
        `Cash flow analysis shows ${formatAmount({
          amount: Math.abs(metrics.netCashFlow),
          currency: targetCurrency,
          locale,
        })} net cash flow with ${formatAmount({
          amount: metrics.totalIncome,
          currency: targetCurrency,
          locale,
        })} in income and ${formatAmount({
          amount: metrics.totalExpenses,
          currency: targetCurrency,
          locale,
        })} in expenses.`;

      // Update artifact with analysis
      if (showCanvas && analysis) {
        await analysis.update({
          stage: "analysis_ready",
          currency: targetCurrency,
          from: finalFrom,
          to: finalTo,
          description,
          chart: {
            monthlyData: monthlyDataWithCumulative,
          },
          metrics: {
            netCashFlow: metrics.netCashFlow,
            totalIncome: metrics.totalIncome,
            totalExpenses: metrics.totalExpenses,
            averageMonthlyCashFlow: metrics.averageMonthlyCashFlow,
          },
          analysis: {
            summary: summaryText,
            recommendations: [],
          },
        });
      }

      // Format the net cash flow
      const formattedCashFlow = formatAmount({
        amount: Math.abs(metrics.netCashFlow),
        currency: targetCurrency,
        locale,
      });

      // Determine if cash flow is positive or negative
      const isPositive = metrics.netCashFlow >= 0;
      const sign = isPositive ? "+" : "-";

      // Build response text
      let responseText = `**Net Cash Flow:** ${sign}${formattedCashFlow}\n\n`;

      // Add period context
      const periodLabel = periodType === "quarterly" ? "quarter" : "period";
      responseText += `This represents your net cash position for the selected ${periodLabel}.\n\n`;

      // Add interpretation
      if (isPositive) {
        responseText +=
          "A positive cash flow means you're bringing in more money than you're spending, which is a healthy sign for your business. ";
        responseText +=
          "This indicates your business is generating sufficient revenue to cover expenses and potentially build cash reserves.";
      } else {
        responseText +=
          "A negative cash flow means you're spending more than you're earning. ";
        responseText +=
          "This could be normal for growth-stage businesses investing heavily, but monitor your cash reserves and runway to ensure sustainability.";
      }

      // Mention canvas if requested
      if (showCanvas) {
        responseText +=
          "\n\nA detailed visual cash flow analysis with charts and trends is available.";
      }

      yield { text: responseText };

      return {
        netCashFlow: metrics.netCashFlow,
        currency: targetCurrency,
        period: periodType,
        formattedAmount: `${sign}${formattedCashFlow}`,
      };
    } catch (error) {
      yield {
        text: `Failed to retrieve cash flow: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
      return {
        netCashFlow: 0,
        currency: currency || appContext.baseCurrency || "USD",
        period: period || "monthly",
      };
    }
  },
});
