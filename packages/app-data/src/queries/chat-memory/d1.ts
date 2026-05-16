import {
  type ChatConversationMessage,
  type ChatConversationRole,
  type ChatMemoryScope,
  type ChatSessionRecord,
  type ChatWorkingMemory,
} from "../chat-memory";
import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "../../client";

type WorkingMemoryRow = {
  memory_key: string;
  scope: ChatMemoryScope;
  chat_id: string | null;
  user_id: string | null;
  content: string;
  updated_at: string;
};

type ChatMessageRow = {
  id: number;
  chat_id: string;
  user_id: string | null;
  role: ChatConversationRole;
  content: string;
  timestamp: string;
  created_at: string;
};

type ChatSessionRow = {
  chat_id: string;
  user_id: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
};

export function getChatMemoryD1(db: Database) {
  return requireCloudflareD1Database(db);
}

function getMemoryKey(args: { scope: ChatMemoryScope; chatId?: string; userId?: string }) {
  const value = args.scope === "chat" ? args.chatId : args.userId;

  if (!value) {
    throw new Error(`Missing ${args.scope} memory identifier`);
  }

  return `${args.scope}:${value}`;
}

function normalizeContent(content: string | unknown) {
  return typeof content === "string" ? content : JSON.stringify(content);
}

function parseContent(content: string) {
  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}

function toWorkingMemory(row: WorkingMemoryRow): ChatWorkingMemory {
  return {
    content: row.content,
    updatedAt: new Date(row.updated_at),
  };
}

function toChatSession(row: ChatSessionRow): ChatSessionRecord {
  return {
    chatId: row.chat_id,
    userId: row.user_id ?? undefined,
    title: row.title ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    messageCount: row.message_count,
  };
}

export async function getWorkingMemoryFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: {
    chatId?: string;
    userId?: string;
    scope: ChatMemoryScope;
  },
) {
  const row = await d1
    .prepare("select * from ai_working_memory where memory_key = ? limit 1")
    .bind(getMemoryKey(params))
    .first<WorkingMemoryRow>();

  return row ? toWorkingMemory(row) : null;
}

export async function updateWorkingMemoryInD1(
  d1: CloudflareD1DatabaseBinding,
  params: {
    chatId?: string;
    userId?: string;
    scope: ChatMemoryScope;
    content: string;
    updatedAt?: Date;
  },
) {
  const updatedAt = (params.updatedAt ?? new Date()).toISOString();

  await d1
    .prepare(
      `insert into ai_working_memory (
        memory_key,
        scope,
        chat_id,
        user_id,
        content,
        updated_at
      ) values (?, ?, ?, ?, ?, ?)
      on conflict(memory_key) do update set
        scope = excluded.scope,
        chat_id = excluded.chat_id,
        user_id = excluded.user_id,
        content = excluded.content,
        updated_at = excluded.updated_at`,
    )
    .bind(
      getMemoryKey(params),
      params.scope,
      params.chatId ?? null,
      params.userId ?? null,
      params.content,
      updatedAt,
    )
    .run();
}

export async function saveMessageInD1(
  d1: CloudflareD1DatabaseBinding,
  message: ChatConversationMessage,
) {
  const timestamp = message.timestamp.toISOString();

  await d1
    .prepare(
      `insert into ai_conversation_messages (
        chat_id,
        user_id,
        role,
        content,
        timestamp,
        created_at
      ) values (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      message.chatId,
      message.userId ?? null,
      message.role,
      normalizeContent(message.content),
      timestamp,
      new Date().toISOString(),
    )
    .run();
}

export async function getMessagesFromD1<T = unknown>(
  d1: CloudflareD1DatabaseBinding,
  params: {
    chatId: string;
    userId?: string;
    limit?: number;
  },
): Promise<T[]> {
  const userId = params.userId ?? null;

  const query = params.limit
    ? `select content from (
        select id, role, content, timestamp
        from ai_conversation_messages
        where chat_id = ?
          and (? is null or user_id is null or user_id = ?)
        order by timestamp desc, case when role = 'assistant' then 1 else 0 end desc, id desc
        limit ?
      )
      order by timestamp asc, case when role = 'assistant' then 1 else 0 end asc, id asc`
    : `select content
      from ai_conversation_messages
      where chat_id = ?
        and (? is null or user_id is null or user_id = ?)
      order by timestamp asc, case when role = 'assistant' then 1 else 0 end asc, id asc`;

  const result = params.limit
    ? await d1
        .prepare(query)
        .bind(params.chatId, userId, userId, params.limit)
        .all<ChatMessageRow>()
    : await d1.prepare(query).bind(params.chatId, userId, userId).all<ChatMessageRow>();

  return (result.results ?? []).map((message) => parseContent(message.content) as T);
}

export async function saveChatInD1(d1: CloudflareD1DatabaseBinding, chat: ChatSessionRecord) {
  await d1
    .prepare(
      `insert into ai_chat_sessions (
        chat_id,
        user_id,
        title,
        created_at,
        updated_at,
        message_count
      ) values (?, ?, ?, ?, ?, ?)
      on conflict(chat_id) do update set
        user_id = coalesce(excluded.user_id, ai_chat_sessions.user_id),
        title = coalesce(excluded.title, ai_chat_sessions.title),
        updated_at = excluded.updated_at,
        message_count = excluded.message_count`,
    )
    .bind(
      chat.chatId,
      chat.userId ?? null,
      chat.title ?? null,
      chat.createdAt.toISOString(),
      chat.updatedAt.toISOString(),
      chat.messageCount,
    )
    .run();
}

export async function getChatsFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: {
    userId?: string;
    search?: string;
    limit?: number;
  },
) {
  const userId = params.userId ?? null;
  const search = params.search?.trim().toLowerCase();
  const searchPattern = search ? `%${search}%` : null;

  const result = await d1
    .prepare(
      `select *
      from ai_chat_sessions
      where (? is null or user_id = ?)
        and (? is null or lower(coalesce(title, '')) like ?)
      order by updated_at desc, created_at desc, chat_id desc
      limit ?`,
    )
    .bind(userId, userId, searchPattern, searchPattern, params.limit ?? 50)
    .all<ChatSessionRow>();

  return (result.results ?? []).map(toChatSession);
}

export async function getChatFromD1(d1: CloudflareD1DatabaseBinding, chatId: string) {
  const row = await d1
    .prepare("select * from ai_chat_sessions where chat_id = ? limit 1")
    .bind(chatId)
    .first<ChatSessionRow>();

  return row ? toChatSession(row) : null;
}

export async function updateChatTitleInD1(
  d1: CloudflareD1DatabaseBinding,
  chatId: string,
  title: string,
) {
  const updatedAt = new Date().toISOString();

  await d1
    .prepare(
      `insert into ai_chat_sessions (
        chat_id,
        title,
        created_at,
        updated_at,
        message_count
      ) values (?, ?, ?, ?, 0)
      on conflict(chat_id) do update set
        title = excluded.title,
        updated_at = excluded.updated_at`,
    )
    .bind(chatId, title, updatedAt, updatedAt)
    .run();
}

export async function deleteChatFromD1(d1: CloudflareD1DatabaseBinding, chatId: string) {
  await d1.prepare("delete from ai_conversation_messages where chat_id = ?").bind(chatId).run();
  await d1.prepare("delete from ai_chat_sessions where chat_id = ?").bind(chatId).run();
}
