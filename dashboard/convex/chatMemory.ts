import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireServiceKey } from "./lib/service";

function getMemoryKey(args: { scope: "chat" | "user"; chatId?: string; userId?: string }) {
  const value = args.scope === "chat" ? args.chatId : args.userId;

  if (!value) {
    throw new Error(`Missing ${args.scope} memory identifier`);
  }

  return `${args.scope}:${value}`;
}

function parseContent(content: string) {
  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}

function compareMessages(
  a: { timestamp: string; role: "user" | "assistant" | "system"; _creationTime: number },
  b: { timestamp: string; role: "user" | "assistant" | "system"; _creationTime: number },
) {
  const timestampCompare = a.timestamp.localeCompare(b.timestamp);

  if (timestampCompare !== 0) {
    return timestampCompare;
  }

  const assistantWeightA = a.role === "assistant" ? 1 : 0;
  const assistantWeightB = b.role === "assistant" ? 1 : 0;
  const roleCompare = assistantWeightA - assistantWeightB;

  if (roleCompare !== 0) {
    return roleCompare;
  }

  return a._creationTime - b._creationTime;
}

export const serviceGetWorkingMemory = query({
  args: {
    serviceKey: v.string(),
    scope: v.union(v.literal("chat"), v.literal("user")),
    chatId: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const memoryKey = getMemoryKey(args);
    const record = await ctx.db
      .query("aiWorkingMemory")
      .withIndex("by_memory_key", (q) => q.eq("memoryKey", memoryKey))
      .unique();

    if (!record) {
      return null;
    }

    return {
      content: record.content,
      updatedAt: record.updatedAt,
    };
  },
});

export const serviceUpdateWorkingMemory = mutation({
  args: {
    serviceKey: v.string(),
    scope: v.union(v.literal("chat"), v.literal("user")),
    chatId: v.optional(v.string()),
    userId: v.optional(v.string()),
    content: v.string(),
    updatedAt: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const memoryKey = getMemoryKey(args);
    const existing = await ctx.db
      .query("aiWorkingMemory")
      .withIndex("by_memory_key", (q) => q.eq("memoryKey", memoryKey))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        scope: args.scope,
        chatId: args.chatId,
        userId: args.userId,
        content: args.content,
        updatedAt: args.updatedAt,
      });
    } else {
      await ctx.db.insert("aiWorkingMemory", {
        memoryKey,
        scope: args.scope,
        chatId: args.chatId,
        userId: args.userId,
        content: args.content,
        updatedAt: args.updatedAt,
      });
    }
  },
});

export const serviceSaveMessage = mutation({
  args: {
    serviceKey: v.string(),
    chatId: v.string(),
    userId: v.optional(v.string()),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    timestamp: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    await ctx.db.insert("aiConversationMessages", {
      chatId: args.chatId,
      userId: args.userId,
      role: args.role,
      content: args.content,
      timestamp: args.timestamp,
    });
  },
});

export const serviceGetMessages = query({
  args: {
    serviceKey: v.string(),
    chatId: v.string(),
    userId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const messages = await ctx.db
      .query("aiConversationMessages")
      .withIndex("by_chat_id", (q) => q.eq("chatId", args.chatId))
      .collect();

    const filtered = messages.filter(
      (message) => !args.userId || !message.userId || message.userId === args.userId,
    );

    filtered.sort(compareMessages);

    const limited = args.limit ? filtered.slice(-args.limit) : filtered;

    return limited.map((message) => parseContent(message.content));
  },
});

export const serviceSaveChat = mutation({
  args: {
    serviceKey: v.string(),
    chatId: v.string(),
    userId: v.optional(v.string()),
    title: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
    messageCount: v.number(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const existing = await ctx.db
      .query("aiChatSessions")
      .withIndex("by_chat_id", (q) => q.eq("chatId", args.chatId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        userId: args.userId,
        title: args.title ?? existing.title,
        updatedAt: args.updatedAt,
        messageCount: args.messageCount,
      });

      return;
    }

    await ctx.db.insert("aiChatSessions", {
      chatId: args.chatId,
      userId: args.userId,
      title: args.title,
      createdAt: args.createdAt,
      updatedAt: args.updatedAt,
      messageCount: args.messageCount,
    });
  },
});

export const serviceGetChats = query({
  args: {
    serviceKey: v.string(),
    userId: v.optional(v.string()),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const chats = args.userId
      ? await ctx.db
          .query("aiChatSessions")
          .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
          .collect()
      : await ctx.db.query("aiChatSessions").collect();

    const search = args.search?.trim().toLowerCase();
    const filtered = search
      ? chats.filter((chat) => chat.title?.toLowerCase().includes(search))
      : chats;

    filtered.sort((a, b) => {
      const updatedAtCompare = b.updatedAt.localeCompare(a.updatedAt);

      if (updatedAtCompare !== 0) {
        return updatedAtCompare;
      }

      return b._creationTime - a._creationTime;
    });

    const limited = args.limit ? filtered.slice(0, args.limit) : filtered;

    return limited.map((chat) => ({
      chatId: chat.chatId,
      userId: chat.userId,
      title: chat.title,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      messageCount: chat.messageCount,
    }));
  },
});

export const serviceGetChat = query({
  args: {
    serviceKey: v.string(),
    chatId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const chat = await ctx.db
      .query("aiChatSessions")
      .withIndex("by_chat_id", (q) => q.eq("chatId", args.chatId))
      .unique();

    if (!chat) {
      return null;
    }

    return {
      chatId: chat.chatId,
      userId: chat.userId,
      title: chat.title,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      messageCount: chat.messageCount,
    };
  },
});

export const serviceUpdateChatTitle = mutation({
  args: {
    serviceKey: v.string(),
    chatId: v.string(),
    title: v.string(),
    updatedAt: v.optional(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const existing = await ctx.db
      .query("aiChatSessions")
      .withIndex("by_chat_id", (q) => q.eq("chatId", args.chatId))
      .unique();
    const updatedAt = args.updatedAt ?? new Date().toISOString();

    if (existing) {
      await ctx.db.patch(existing._id, {
        title: args.title,
        updatedAt,
      });

      return;
    }

    await ctx.db.insert("aiChatSessions", {
      chatId: args.chatId,
      title: args.title,
      createdAt: updatedAt,
      updatedAt,
      messageCount: 0,
    });
  },
});

export const serviceDeleteChat = mutation({
  args: {
    serviceKey: v.string(),
    chatId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const [chat, messages] = await Promise.all([
      ctx.db
        .query("aiChatSessions")
        .withIndex("by_chat_id", (q) => q.eq("chatId", args.chatId))
        .unique(),
      ctx.db
        .query("aiConversationMessages")
        .withIndex("by_chat_id", (q) => q.eq("chatId", args.chatId))
        .collect(),
    ]);

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    if (chat) {
      await ctx.db.delete(chat._id);
    }
  },
});
