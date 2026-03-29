import type { UIMessage } from "ai";

export type UITools = Record<string, any>;

export type ChatMessageMetadata = {
  webSearch?: boolean;
  toolCall?: {
    toolName: string;
    toolParams: Record<string, any>;
  };
};

export type MessageDataParts = Record<string, any> & {
  toolChoice?: string;
  agentChoice?: string;
};

export type UIChatMessage = UIMessage<
  ChatMessageMetadata,
  MessageDataParts,
  UITools
>;
