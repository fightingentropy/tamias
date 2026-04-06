import { getAssistantModel } from "../providers";
import { operationsTools } from "../tools/operations";
import {
  buildAgentInstructions,
  COMMON_AGENT_RULES,
  createCachedAgentFactory,
} from "./config/shared";

export const getInvoicesAgent = createCachedAgentFactory((aiProvider) => ({
  name: "invoices",
  model: getAssistantModel(aiProvider, "small"),
  temperature: 0.3,
  instructions: (ctx) =>
    buildAgentInstructions(ctx, {
      intro: `You are an invoice management specialist for ${ctx.companyName}. Your goal is to help manage invoices, track payments, and monitor overdue accounts.`,
      sections: [COMMON_AGENT_RULES],
    }),
  tools: {
    getInvoices: operationsTools.getInvoices,
  },
  maxTurns: 5,
}));
