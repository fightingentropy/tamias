create table if not exists ai_working_memory (
  memory_key text primary key,
  scope text not null check (scope in ('chat', 'user')),
  chat_id text,
  user_id text,
  content text not null,
  updated_at text not null,
  check (
    (scope = 'chat' and chat_id is not null)
    or (scope = 'user' and user_id is not null)
  )
);

create index if not exists ai_working_memory_scope_chat_user_idx on ai_working_memory (
  scope,
  chat_id,
  user_id
);

create table if not exists ai_chat_sessions (
  chat_id text primary key,
  user_id text,
  title text,
  created_at text not null,
  updated_at text not null,
  message_count integer not null check (message_count >= 0)
);

create index if not exists ai_chat_sessions_user_updated_idx on ai_chat_sessions (
  user_id,
  updated_at desc,
  chat_id
);

create table if not exists ai_conversation_messages (
  id integer primary key autoincrement,
  chat_id text not null,
  user_id text,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  timestamp text not null,
  created_at text not null
);

create index if not exists ai_conversation_messages_chat_order_idx on ai_conversation_messages (
  chat_id,
  timestamp,
  role,
  id
);

create index if not exists ai_conversation_messages_user_chat_idx on ai_conversation_messages (
  user_id,
  chat_id
);
