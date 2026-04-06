import { createOpenAI, openai } from "@ai-sdk/openai";
import { type AIProvider, DEFAULT_AI_PROVIDER } from "@tamias/domain/identity";

export type AssistantModelTier = "primary" | "small" | "micro";

type AssistantProviderConfig = {
  provider: Pick<typeof openai, "chat">;
  models: Record<AssistantModelTier, string>;
  configurationError?: string | null;
};

const kimiProvider = createOpenAI({
  name: "kimi",
  apiKey: process.env.KIMI_API_KEY,
  baseURL: process.env.KIMI_BASE_URL || "https://api.moonshot.cn/v1",
});

const DEFAULT_OPENROUTER_ASSISTANT_MODEL = "qwen/qwen3.6-plus:free";

function buildOpenRouterHeaders(): Record<string, string> | undefined {
  const referer = process.env.OPENROUTER_HTTP_REFERER?.trim();
  const title = process.env.OPENROUTER_APP_NAME?.trim();
  if (!referer && !title) {
    return undefined;
  }
  return {
    ...(referer ? { "HTTP-Referer": referer } : {}),
    ...(title ? { "X-Title": title } : {}),
  };
}

const openrouterProvider = createOpenAI({
  name: "openrouter",
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL:
    process.env.OPENROUTER_BASE_URL?.replace(/\/$/, "") ||
    "https://openrouter.ai/api/v1",
  headers: buildOpenRouterHeaders(),
});

const assistantProviders: Record<AIProvider, AssistantProviderConfig> = {
  openai: {
    provider: openai,
    models: {
      primary: process.env.OPENAI_ASSISTANT_MODEL_PRIMARY || "gpt-5",
      small: process.env.OPENAI_ASSISTANT_MODEL_SMALL || "gpt-5-mini",
      micro: process.env.OPENAI_ASSISTANT_MODEL_MICRO || "gpt-5-nano",
    },
  },
  kimi: {
    provider: kimiProvider,
    models: {
      primary: process.env.KIMI_MODEL_PRIMARY || "kimi-latest",
      small:
        process.env.KIMI_MODEL_SMALL ||
        process.env.KIMI_MODEL_PRIMARY ||
        "kimi-latest",
      micro:
        process.env.KIMI_MODEL_MICRO ||
        process.env.KIMI_MODEL_SMALL ||
        process.env.KIMI_MODEL_PRIMARY ||
        "kimi-latest",
    },
    configurationError: process.env.KIMI_API_KEY
      ? null
      : "Kimi is selected, but KIMI_API_KEY is not configured on the API service.",
  },
  openrouter: {
    provider: openrouterProvider,
    models: {
      primary:
        process.env.OPENROUTER_ASSISTANT_MODEL_PRIMARY ||
        DEFAULT_OPENROUTER_ASSISTANT_MODEL,
      small:
        process.env.OPENROUTER_ASSISTANT_MODEL_SMALL ||
        process.env.OPENROUTER_ASSISTANT_MODEL_PRIMARY ||
        DEFAULT_OPENROUTER_ASSISTANT_MODEL,
      micro:
        process.env.OPENROUTER_ASSISTANT_MODEL_MICRO ||
        process.env.OPENROUTER_ASSISTANT_MODEL_SMALL ||
        process.env.OPENROUTER_ASSISTANT_MODEL_PRIMARY ||
        DEFAULT_OPENROUTER_ASSISTANT_MODEL,
    },
    configurationError: process.env.OPENROUTER_API_KEY
      ? null
      : "OpenRouter is selected, but OPENROUTER_API_KEY is not configured on the API service.",
  },
};

function resolveAssistantProvider(aiProvider?: AIProvider | null) {
  return assistantProviders[aiProvider ?? DEFAULT_AI_PROVIDER];
}

export function normalizeAIProvider(
  aiProvider?: AIProvider | null,
): AIProvider {
  return aiProvider ?? DEFAULT_AI_PROVIDER;
}

export function getAssistantModel(
  aiProvider: AIProvider,
  tier: AssistantModelTier,
) {
  const provider = resolveAssistantProvider(aiProvider);

  return provider.provider.chat(provider.models[tier]);
}

export function getAIProviderConfigurationError(
  aiProvider: AIProvider,
): string | null {
  return resolveAssistantProvider(aiProvider).configurationError ?? null;
}
