import { db } from "@tamias/app-data/client";
import {
  getInsightByPeriod,
  getLatestInsight,
  hasEarlierInsight,
  type Insight,
} from "@tamias/app-data/queries";
import {
  createInsightsService,
  getPeriodInfo,
  getPeriodLabel,
  getPreviousCompletePeriod,
} from "@tamias/insights";
import type {
  InsightGenerationResult,
  PeriodType,
} from "@tamias/insights/types";
import { formatAmount } from "@tamias/utils/format";
import { tool } from "ai";
import { z } from "zod";
import { getToolAppContext, getToolTeamId } from "../utils/tool-runtime";

const getInsightsSchema = z.object({
  periodType: z
    .enum(["weekly", "monthly", "quarterly", "yearly"])
    .default("weekly")
    .describe("Type of insight period"),
  periodNumber: z
    .number()
    .optional()
    .describe("Period number (week 1-53, month 1-12, quarter 1-4)"),
  year: z.number().optional().describe("Year for the insight period"),
});

export const getInsightsTool = tool({
  description:
    "Get AI-generated business insights summary for a period (weekly, monthly, quarterly, or yearly). Shows key metrics with comparisons, achievements, and personalized recommendations.",
  inputSchema: getInsightsSchema,
  execute: async function* (
    { periodType, periodNumber, year },
    executionOptions,
  ) {
    const appContext = getToolAppContext(executionOptions);
    const teamId = getToolTeamId(appContext);

    if (!teamId) {
      yield {
        text: "Unable to retrieve insights: Team ID not found.",
      };
      return { success: false };
    }

    try {
      let insight: Insight | null = null;
      let generatedInsight: {
        id: string;
        periodLabel: string;
        periodType: PeriodType;
        periodYear: number;
        periodNumber: number;
        currency: string;
        title: string;
        content: InsightGenerationResult["content"];
        selectedMetrics: InsightGenerationResult["selectedMetrics"];
        anomalies: InsightGenerationResult["anomalies"];
        expenseAnomalies: InsightGenerationResult["expenseAnomalies"];
        milestones: InsightGenerationResult["milestones"];
        activity: InsightGenerationResult["activity"];
        predictions: InsightGenerationResult["predictions"];
        generatedAt: string;
      } | null = null;

      // If specific period requested, fetch it
      // Use explicit undefined checks to distinguish "not provided" from "provided as zero"
      if (periodNumber !== undefined && year !== undefined) {
        insight = await getInsightByPeriod(db, {
          teamId,
          periodType,
          periodYear: year,
          periodNumber,
        });
      } else {
        // Get the most recent insight of the requested type
        insight = await getLatestInsight(db, {
          teamId,
          periodType,
        });
      }

      if (!insight || insight.status !== "completed") {
        const periodInfo =
          periodNumber !== undefined && year !== undefined
            ? getPeriodInfo(periodType, year, periodNumber)
            : getPreviousCompletePeriod(periodType);

        const locale = appContext.locale || "en-US";
        const currency = appContext.baseCurrency || "USD";
        const generatedAt = new Date().toISOString();
        const generated = await createInsightsService(db).generateInsight({
          teamId,
          periodType,
          periodStart: periodInfo.periodStart,
          periodEnd: periodInfo.periodEnd,
          periodLabel: periodInfo.periodLabel,
          periodYear: periodInfo.periodYear,
          periodNumber: periodInfo.periodNumber,
          currency,
          locale,
        });

        generatedInsight = {
          id: `generated:${periodType}:${periodInfo.periodYear}:${periodInfo.periodNumber}`,
          periodLabel: getPeriodLabel(
            periodType,
            periodInfo.periodYear,
            periodInfo.periodNumber,
            locale,
          ),
          periodType,
          periodYear: periodInfo.periodYear,
          periodNumber: periodInfo.periodNumber,
          currency,
          title: generated.content.title,
          content: generated.content,
          selectedMetrics: generated.selectedMetrics,
          anomalies: generated.anomalies,
          expenseAnomalies: generated.expenseAnomalies,
          milestones: generated.milestones,
          activity: generated.activity,
          predictions: generated.predictions,
          generatedAt,
        };
      }

      const locale = appContext.locale || "en-US";
      const currency =
        generatedInsight?.currency ||
        insight?.currency ||
        appContext.baseCurrency ||
        "USD";

      const activeInsight = generatedInsight ?? insight;

      if (!activeInsight) {
        yield {
          text: `No ${periodType} insights available yet. Insights are generated automatically and will appear here once ready.`,
        };
        return { success: false, reason: "not_found" };
      }

      // Build conversational "What Matters Now" response using AI-generated content
      let responseText = "";

      // Period label as context
      const periodLabel = getPeriodLabel(
        activeInsight.periodType,
        activeInsight.periodYear,
        activeInsight.periodNumber,
      );

      // Lead with the AI-generated title (the main insight)
      if (activeInsight.title) {
        responseText += `**${periodLabel}**\n\n`;
        responseText += `${activeInsight.title}\n\n`;
      } else {
        responseText += `## ${periodLabel}\n\n`;
      }

      // The story - this is the heart of the insight
      if (activeInsight.content?.story) {
        responseText += `${activeInsight.content.story}\n\n`;
      }

      // Action items (specific and actionable)
      if (
        activeInsight.content?.actions &&
        activeInsight.content.actions.length > 0
      ) {
        responseText += "**What to do:**\n";
        for (const action of activeInsight.content.actions) {
          responseText += `- ${action.text}\n`;
        }
        responseText += "\n";
      }

      // Overdue invoices (if any)
      if (
        activeInsight.activity?.invoicesOverdue &&
        activeInsight.activity.invoicesOverdue > 0
      ) {
        responseText += "**Needs attention:**\n";
        responseText += `- ${activeInsight.activity.invoicesOverdue} overdue invoice${activeInsight.activity.invoicesOverdue > 1 ? "s" : ""}`;
        if (activeInsight.activity.overdueAmount) {
          responseText += ` (${formatMetricValue(activeInsight.activity.overdueAmount, "currency", currency, locale)})`;
        }
        responseText += "\n\n";
      }

      // Key numbers (compact, not a table)
      if (
        activeInsight.selectedMetrics &&
        activeInsight.selectedMetrics.length > 0
      ) {
        responseText += "**The numbers:**\n";
        for (const metric of activeInsight.selectedMetrics.slice(0, 4)) {
          const formattedValue = formatMetricValue(
            metric.value,
            metric.type,
            currency,
            locale,
          );
          const changeText = formatChangeCompact(
            metric.change,
            metric.changeDirection,
          );
          responseText += `- ${metric.label}: ${formattedValue} ${changeText}\n`;
        }
        responseText += "\n";
      }

      // Expense changes (only spikes, not decreases - decreases are good!)
      if (
        activeInsight.expenseAnomalies &&
        activeInsight.expenseAnomalies.length > 0
      ) {
        const spikes = activeInsight.expenseAnomalies.filter(
          (ea) => ea.type === "category_spike" || ea.type === "new_category",
        );
        if (spikes.length > 0) {
          responseText += "**Expense heads up:**\n";
          for (const ea of spikes.slice(0, 3)) {
            const currentFormatted = formatMetricValue(
              ea.currentAmount,
              "currency",
              currency,
              locale,
            );
            if (ea.type === "new_category") {
              responseText += `- New: ${ea.categoryName} (${currentFormatted})\n`;
            } else {
              responseText += `- ${ea.categoryName} up ${ea.change}% to ${currentFormatted}\n`;
            }
          }
          responseText += "\n";
        }
      }

      // Check if this is the first insight for the team
      // (no earlier completed insights exist)
      const isFirstInsight = !(await hasEarlierInsight(db, {
        teamId,
        periodType: activeInsight.periodType,
        periodYear: activeInsight.periodYear,
        periodNumber: activeInsight.periodNumber,
      }));

      // Yield insight data for direct rendering in chat UI
      const insightData = {
        id: activeInsight.id,
        periodLabel,
        periodType: activeInsight.periodType,
        periodYear: activeInsight.periodYear,
        periodNumber: activeInsight.periodNumber,
        currency,
        title: activeInsight.title,
        selectedMetrics: activeInsight.selectedMetrics,
        content: activeInsight.content,
        anomalies: activeInsight.anomalies,
        expenseAnomalies: activeInsight.expenseAnomalies,
        milestones: activeInsight.milestones,
        activity: activeInsight.activity,
        predictions: activeInsight.predictions,
        generatedAt: activeInsight.generatedAt,
        isFirstInsight,
      };

      yield {
        text: responseText,
        success: true,
        insight: insightData,
      };

      // Return for AI context - include insight so extractInsightData() can find it
      return {
        success: true,
        insight: insightData,
        instruction:
          "The insight has been displayed to the user. Do not repeat or summarize it.",
      };
    } catch (error) {
      yield {
        text: `Failed to retrieve insights: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
      return { success: false, reason: "error" };
    }
  },
});

function formatMetricValue(
  value: number,
  type: string,
  currency: string,
  locale: string,
): string {
  // Percentage metrics
  if (
    type.includes("margin") ||
    type.includes("rate") ||
    type === "profit_margin"
  ) {
    return `${value.toFixed(1)}%`;
  }

  // Duration metrics
  if (type === "runway_months") {
    return `${value.toFixed(1)} months`;
  }

  if (
    type === "hours_tracked" ||
    type === "billable_hours" ||
    type === "unbilled_hours"
  ) {
    return `${value.toFixed(1)}h`;
  }

  // Count metrics
  if (
    type.includes("invoices") ||
    type.includes("customers") ||
    type === "new_customers" ||
    type === "active_customers" ||
    type === "receipts_matched" ||
    type === "transactions_categorized"
  ) {
    return value.toLocaleString(locale);
  }

  // Currency metrics (default)
  return (
    formatAmount({
      amount: value,
      currency: currency || "USD",
      locale,
    }) ?? value.toLocaleString(locale)
  );
}

function formatChangeCompact(
  change: number,
  direction: "up" | "down" | "flat",
): string {
  if (direction === "flat" || Math.abs(change) < 0.5) {
    return "(steady)";
  }

  const sign = direction === "up" ? "+" : "-";
  return `(${sign}${Math.abs(Math.round(change))}%)`;
}
