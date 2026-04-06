import type { UIMessage } from "ai";

export type UITools = Record<string, any>;

export type ChatMessageMetadata = {
  webSearch?: boolean;
  toolChoice?: string;
  agentChoice?: string;
  toolCall?: {
    toolName: string;
    toolParams: Record<string, any>;
  };
};

export type MessageDataParts = Record<string, any>;

export type UIChatMessage = UIMessage<ChatMessageMetadata, MessageDataParts, UITools>;
