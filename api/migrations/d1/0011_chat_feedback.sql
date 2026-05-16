create table if not exists chat_feedback (
  chat_id text not null,
  message_id text not null,
  user_id text not null,
  team_id text not null,
  type text not null check (type in ('positive', 'negative', 'other')),
  comment text,
  created_at text not null,
  updated_at text not null,
  primary key (chat_id, message_id, user_id)
);

create index if not exists chat_feedback_chat_id_idx on chat_feedback (chat_id);
create index if not exists chat_feedback_team_id_idx on chat_feedback (team_id);
create index if not exists chat_feedback_user_id_idx on chat_feedback (user_id);
create index if not exists chat_feedback_updated_at_idx on chat_feedback (updated_at);
