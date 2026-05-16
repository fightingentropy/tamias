create table if not exists document_tag_embeddings (
  slug text primary key,
  name text not null,
  embedding_json text not null,
  model text not null,
  created_at text not null,
  updated_at text not null
);

create index if not exists document_tag_embeddings_updated_at_idx on document_tag_embeddings (updated_at);
