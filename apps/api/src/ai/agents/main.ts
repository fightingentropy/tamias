import {
  buildAgentInstructions,
  createCachedAgentFactory,
  formatContextForLLM,
} from "./config/shared";
import { getAssistantModel } from "../providers";
import { getAnalyticsAgent } from "./analytics";
import { getCustomersAgent } from "./customers";
import { getGeneralAgent } from "./general";
import { getInvoicesAgent } from "./invoices";
import { getOperationsAgent } from "./operations";
import { getReportsAgent } from "./reports";
import { getResearchAgent } from "./research";
import { getTimeTrackingAgent } from "./time-tracking";
import { getTransactionsAgent } from "./transactions";

export const getMainAgent = createCachedAgentFactory((aiProvider) => ({
    name: "triage",
    model: getAssistantModel(aiProvider, "small"),
    temperature: 0.1,
    modelSettings: {
      toolChoice: {
        type: "tool",
        toolName: "handoff_to_agent",
      },
    },
    instructions: (ctx) =>
      buildAgentInstructions(ctx, {
        intro: "Route user requests to the appropriate specialist.",
        contextContent: (appContext) => `${formatContextForLLM(appContext)}

<routing-rules>
IMPORTANT: For "weekly summary", "monthly summary", "summary for week X", "insights", "business overview" → ALWAYS route to general (NOT reports)

<agent-capabilities>
general: Weekly/monthly/quarterly summaries, insights, business overview, general questions, greetings, web search
research: AFFORDABILITY ANALYSIS ("can I afford X?", "should I buy X?"), purchase decisions, market comparisons
operations: Account balances, documents, inbox
reports: Detailed financial reports (revenue, profit, expenses, spending, burn rate, runway, P&L, cash flow, stress test, invoice payment analysis, growth rate, balance sheet, business health score, forecast, tax summary, metrics breakdown)
analytics: Predictions, advanced analytics (excluding revenue forecast)
transactions: Transaction history
invoices: Invoice management
customers: Customer management
timeTracking: Time tracking
</agent-capabilities>
</routing-rules>`,
      }),
    handoffs: [
      getGeneralAgent(aiProvider),
      getResearchAgent(aiProvider),
      getOperationsAgent(aiProvider),
      getReportsAgent(aiProvider),
      getAnalyticsAgent(aiProvider),
      getTransactionsAgent(aiProvider),
      getInvoicesAgent(aiProvider),
      getCustomersAgent(aiProvider),
      getTimeTrackingAgent(aiProvider),
    ],
    maxTurns: 1,
}));
