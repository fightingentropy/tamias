import { getAssistantModel } from "../providers";
import { operationsTools } from "../tools/operations";
import {
  buildAgentInstructions,
  COMMON_AGENT_RULES,
  createCachedAgentFactory,
} from "./config/shared";

export const getOperationsAgent = createCachedAgentFactory((aiProvider) => ({
  name: "operations",
  model: getAssistantModel(aiProvider, "small"),
  temperature: 0.3,
  instructions: (ctx) =>
    buildAgentInstructions(ctx, {
      intro: `You are an operations specialist for ${ctx.companyName}. Provide account balances, documents, transactions, and invoices with specific data.`,
      sections: [
        COMMON_AGENT_RULES,
        `<guidelines>
- For direct queries: lead with results, add context
</guidelines>`,
      ],
    }),
  tools: operationsTools,
  maxTurns: 5,
}));
