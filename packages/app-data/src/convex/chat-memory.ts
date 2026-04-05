import { ConvexHttpClient } from "convex/browser";
import { api } from "./api";

export type ChatMemoryScope = "chat" | "user";
export type ChatConversationRole = "user" | "assistant" | "system";

export type ChatWorkingMemory = {
  content: string;
  updatedAt: Date;
};

export type ChatConversationMessage = {
  chatId: string;
  userId?: string;
  role: ChatConversationRole;
  content: string | unknown;
  timestamp: Date;
};

export type ChatSessionRecord = {
  chatId: string;
  userId?: string;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
};

function getConvexUrl() {
  return (
    process.env.CONVEX_URL ||
    process.env.TAMIAS_CONVEX_URL ||
    process.env.CONVEX_SITE_URL
  );
}

function getServiceKey() {
  const configuredKey = process.env.CONVEX_SERVICE_KEY;

  if (configuredKey) {
    return configuredKey;
  }

  const convexUrl = getConvexUrl();

  if (
    convexUrl?.includes("127.0.0.1") ||
    convexUrl?.includes("localhost")
  ) {
    return "local-dev";
  }

  throw new Error("Missing CONVEX_SERVICE_KEY");
}

function createClient() {
  const convexUrl = getConvexUrl();

  if (!convexUrl) {
    throw new Error("Missing CONVEX_URL");
  }

  return new ConvexHttpClient(convexUrl, { logger: false });
}

function serviceArgs<T extends Record<string, unknown>>(args: T) {
  return {
    serviceKey: getServiceKey(),
    ...args,
  };
}

function normalizeContent(content: string | unknown) {
  return typeof content === "string" ? content : JSON.stringify(content);
}

export class ConvexChatMemoryProvider {
  async getWorkingMemory(params: {
    chatId?: string;
    userId?: string;
    scope: ChatMemoryScope;
  }): Promise<ChatWorkingMemory | null> {
    const result = await createClient().query(
      api.chatMemory.serviceGetWorkingMemory,
      serviceArgs(params),
    );

    if (!result) {
      return null;
    }

    return {
      content: result.content,
      updatedAt: new Date(result.updatedAt),
    };
  }

  async updateWorkingMemory(params: {
    chatId?: string;
    userId?: string;
    scope: ChatMemoryScope;
    content: string;
  }): Promise<void> {
    await createClient().mutation(
      api.chatMemory.serviceUpdateWorkingMemory,
      serviceArgs({
        ...params,
        updatedAt: new Date().toISOString(),
      }),
    );
  }

  async saveMessage(message: ChatConversationMessage): Promise<void> {
    await createClient().mutation(
      api.chatMemory.serviceSaveMessage,
      serviceArgs({
        chatId: message.chatId,
        userId: message.userId,
        role: message.role,
        content: normalizeContent(message.content),
        timestamp: message.timestamp.toISOString(),
      }),
    );
  }

  async getMessages<T = unknown>(params: {
    chatId: string;
    userId?: string;
    limit?: number;
  }): Promise<T[]> {
    return createClient().query(
      api.chatMemory.serviceGetMessages,
      serviceArgs(params),
    ) as Promise<T[]>;
  }

  async saveChat(chat: ChatSessionRecord): Promise<void> {
    await createClient().mutation(
      api.chatMemory.serviceSaveChat,
      serviceArgs({
        chatId: chat.chatId,
        userId: chat.userId,
        title: chat.title,
        createdAt: chat.createdAt.toISOString(),
        updatedAt: chat.updatedAt.toISOString(),
        messageCount: chat.messageCount,
      }),
    );
  }

  async getChats(params: {
    userId?: string;
    search?: string;
    limit?: number;
  }): Promise<ChatSessionRecord[]> {
    const result = await createClient().query(
      api.chatMemory.serviceGetChats,
      serviceArgs(params),
    ) as Array<{
      chatId: string;
      userId?: string | null;
      title?: string | null;
      createdAt: string;
      updatedAt: string;
      messageCount: number;
    }>;

    return result.map((chat) => ({
      chatId: chat.chatId,
      userId: chat.userId ?? undefined,
      title: chat.title ?? undefined,
      createdAt: new Date(chat.createdAt),
      updatedAt: new Date(chat.updatedAt),
      messageCount: chat.messageCount,
    }));
  }

  async getChat(chatId: string): Promise<ChatSessionRecord | null> {
    const result = await createClient().query(
      api.chatMemory.serviceGetChat,
      serviceArgs({ chatId }),
    );

    if (!result) {
      return null;
    }

    return {
      chatId: result.chatId,
      userId: result.userId ?? undefined,
      title: result.title ?? undefined,
      createdAt: new Date(result.createdAt),
      updatedAt: new Date(result.updatedAt),
      messageCount: result.messageCount,
    };
  }

  async updateChatTitle(chatId: string, title: string): Promise<void> {
    await createClient().mutation(
      api.chatMemory.serviceUpdateChatTitle,
      serviceArgs({
        chatId,
        title,
        updatedAt: new Date().toISOString(),
      }),
    );
  }

  async deleteChat(chatId: string): Promise<void> {
    await createClient().mutation(
      api.chatMemory.serviceDeleteChat,
      serviceArgs({ chatId }),
    );
  }
}
