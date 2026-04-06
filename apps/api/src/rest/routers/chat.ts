import { OpenAPIHono } from "@hono/zod-openapi";
import { smoothStream } from "ai";
import type {
  ForcedToolCall,
  MetricsFilter,
} from "../../ai/agents/config/shared";
import { buildAppContext } from "../../ai/agents/config/shared";
import { getMainAgent } from "../../ai/agents/main";
import {
  getAIProviderConfigurationError,
  normalizeAIProvider,
} from "../../ai/providers";
import { getUserContext } from "../../ai/utils/get-user-context";
import { chatRequestSchema } from "../../schemas/chat";
import { withRequiredScope } from "../middleware";
import type { Context } from "../types";

const app = new OpenAPIHono<Context>();

app.post("/", withRequiredScope("chat.write"), async (c) => {
  const body = await c.req.json();
  const validationResult = chatRequestSchema.safeParse(body);

  if (!validationResult.success) {
    return c.json({ success: false, error: validationResult.error }, 400);
  }

  const {
    message,
    id,
    timezone,
    agentChoice,
    toolChoice,
    country,
    city,
    aiProvider: requestedAIProvider,
    metricsFilter,
  } = validationResult.data;

  const teamId = c.get("teamId");
  const session = c.get("session");
  const userId = session.user.convexId;
  const db = c.get("db");

  if (!userId) {
    return c.json({ success: false, error: "Missing Convex user id" }, 500);
  }

  const userContext = await getUserContext({
    db,
    userId,
    teamId,
    country,
    city,
    timezone,
  });

  const aiProvider = normalizeAIProvider(requestedAIProvider);
  const providerConfigurationError =
    getAIProviderConfigurationError(aiProvider);

  if (providerConfigurationError) {
    return c.json(
      {
        success: false,
        error: providerConfigurationError,
      },
      503,
    );
  }

  // Extract forced tool params from message metadata (widget clicks)
  // When a widget sends toolParams, use them directly (bypasses AI decisions)
  let forcedToolCall: ForcedToolCall | undefined;
  const metadata = (message as any)?.metadata;
  if (metadata?.toolCall?.toolName && metadata?.toolCall?.toolParams) {
    forcedToolCall = {
      toolName: metadata.toolCall.toolName,
      toolParams: metadata.toolCall.toolParams,
    };
  }

  const appContext = buildAppContext(userContext, id, {
    aiProvider,
    metricsFilter: metricsFilter as MetricsFilter | undefined,
    forcedToolCall,
  });

  // Pass user preferences to main agent as context
  // The main agent will use this information to make better routing decisions
  return getMainAgent(aiProvider).toUIMessageStream({
    message,
    strategy: "auto",
    maxRounds: 5,
    maxSteps: 20,
    context: appContext,
    agentChoice,
    toolChoice,
    experimental_transform: smoothStream({
      chunking: "word",
    }),
    sendSources: true,
  });
});

export { app as chatRouter };
