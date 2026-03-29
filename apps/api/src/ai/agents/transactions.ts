import {
  buildAgentInstructions,
  COMMON_AGENT_RULES,
  createCachedAgentFactory,
} from "./config/shared";
import { getAssistantModel } from "../providers";
import { operationsTools } from "../tools/operations";

export const getTransactionsAgent = createCachedAgentFactory((aiProvider) => ({
    name: "transactions",
    model: getAssistantModel(aiProvider, "small"),
    temperature: 0.3,
    instructions: (ctx) =>
      buildAgentInstructions(ctx, {
        intro: `You are a transactions specialist for ${ctx.companyName}. Your goal is to help users query and analyze transaction data.`,
        sections: [
          COMMON_AGENT_RULES,
          `<agent-specific-rules>
- Lead with key information
- For "largest transactions", use sort and limit filters
- Highlight key insights from the data
</agent-specific-rules>`,
        ],
      }),
    tools: {
      getTransactions: operationsTools.getTransactions,
    },
    maxTurns: 5,
}));
