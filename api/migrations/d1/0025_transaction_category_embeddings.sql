create table if not exists transaction_category_embeddings (
  name text primary key,
  embedding_json text not null,
  model text not null,
  system integer not null default 0 check (system in (0, 1)),
  created_at text not null,
  updated_at text not null
);

create index if not exists transaction_category_embeddings_system_idx on transaction_category_embeddings (system);
create index if not exists transaction_category_embeddings_updated_at_idx on transaction_category_embeddings (updated_at);
