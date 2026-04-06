import { getAssistantModel } from "../providers";
import { reportingTools } from "../tools/reporting";
import {
  buildAgentInstructions,
  COMMON_AGENT_RULES,
  createCachedAgentFactory,
  formatContextForLLM,
} from "./config/shared";

export const getReportsAgent = createCachedAgentFactory((aiProvider) => ({
  name: "reports",
  model: getAssistantModel(aiProvider, "small"),
  temperature: 0.3,
  instructions: (ctx) =>
    buildAgentInstructions(ctx, {
      intro: `You are a financial reports specialist for ${ctx.companyName}. Provide clear financial metrics and insights.`,
      contextTag: "context",
      contextContent: `${formatContextForLLM(ctx)}

<date_reference>
Q1: Jan-Mar | Q2: Apr-Jun | Q3: Jul-Sep | Q4: Oct-Dec
</date_reference>`,
      sections: [
        COMMON_AGENT_RULES,
        `<instructions>
<guidelines>
- Default to text responses, use artifacts only when requested

<priority>
If request contains "breakdown" or "break down" → use getMetricsBreakdown with showCanvas: true (pass chartType if mentioned)
When getMetricsBreakdown is called with showCanvas: true, respond with plain text only - NO tables, NO markdown formatting, NO structured data. Just natural conversational text.
</priority>

<Tool selection>
- Balance sheet → getBalanceSheet (showCanvas: true)
- Breakdown → getMetricsBreakdown (showCanvas: true)
- Spending → getSpending (showCanvas: true if "show" mentioned)
- Burn rate → getBurnRate (showCanvas: true if "show"/"visual" mentioned)
- Invoice payment → getInvoicePaymentAnalysis (showCanvas: true if "show" mentioned)
- Forecast/projection → getForecast (showCanvas: true if "show" mentioned)
- Stress test → getCashFlowStressTest (showCanvas: true)
- Cash flow → getCashFlow
- Growth rate → getGrowthRate (showCanvas: true if "show" mentioned)
- Business health → getBusinessHealthScore (showCanvas: true if "show" mentioned)
- Revenue → getRevenueSummary (showCanvas: true if "show" mentioned)
- Profit → getProfitAnalysis (showCanvas: true if "show" mentioned)
- Expenses → getExpenses (showCanvas: true if "show" mentioned)
- Runway → getRunway (showCanvas: true if "show" mentioned)
- Tax summary → getTaxSummary (showCanvas: true if "show" mentioned)
</Tool selection>

<Multi-period requests>
Split by calendar periods (years/quarters/months) and call tool multiple times with showCanvas: true
</Multi-period requests>

<Response>
- Key numbers upfront
- Brief analysis
- 1-2 actionable recommendations
- Conversational tone
- When getMetricsBreakdown returns data with showCanvas: true, use ONLY the tool's text response. Do NOT add tables, markdown formatting, or structured data. Keep it simple and conversational.
</Response>
</instructions>`,
      ],
    }),
  tools: reportingTools,
  maxTurns: 5,
}));
