import { createDatabase } from "../client";
import {
  deleteChatFromD1,
  getChatFromD1,
  getChatMemoryD1,
  getChatsFromD1,
  getMessagesFromD1,
  getWorkingMemoryFromD1,
  saveChatInD1,
  saveMessageInD1,
  updateChatTitleInD1,
  updateWorkingMemoryInD1,
} from "./chat-memory/d1";

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

function createRuntimeDatabase() {
  return createDatabase();
}

function requireChatMemoryD1() {
  const d1 = getChatMemoryD1(createRuntimeDatabase());

  if (!d1) {
    throw new Error("Chat memory requires Cloudflare D1");
  }

  return d1;
}

export class AppDataChatMemoryProvider {
  async getWorkingMemory(params: { chatId?: string; userId?: string; scope: ChatMemoryScope }) {
    return getWorkingMemoryFromD1(requireChatMemoryD1(), params);
  }

  async updateWorkingMemory(params: {
    chatId?: string;
    userId?: string;
    scope: ChatMemoryScope;
    content: string;
  }): Promise<void> {
    await updateWorkingMemoryInD1(requireChatMemoryD1(), params);
  }

  async saveMessage(message: ChatConversationMessage): Promise<void> {
    await saveMessageInD1(requireChatMemoryD1(), message);
  }

  async getMessages<T = unknown>(params: {
    chatId: string;
    userId?: string;
    limit?: number;
  }): Promise<T[]> {
    return getMessagesFromD1<T>(requireChatMemoryD1(), params);
  }

  async saveChat(chat: ChatSessionRecord): Promise<void> {
    await saveChatInD1(requireChatMemoryD1(), chat);
  }

  async getChats(params: { userId?: string; search?: string; limit?: number }) {
    return getChatsFromD1(requireChatMemoryD1(), params);
  }

  async getChat(chatId: string) {
    return getChatFromD1(requireChatMemoryD1(), chatId);
  }

  async updateChatTitle(chatId: string, title: string): Promise<void> {
    await updateChatTitleInD1(requireChatMemoryD1(), chatId, title);
  }

  async deleteChat(chatId: string): Promise<void> {
    await deleteChatFromD1(requireChatMemoryD1(), chatId);
  }
}
