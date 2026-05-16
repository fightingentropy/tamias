create table if not exists document_tags (
  id text primary key,
  team_id text not null,
  name text not null,
  slug text not null,
  created_at text not null,
  updated_at text not null
);

create unique index if not exists document_tags_team_slug_idx on document_tags (team_id, slug);
create index if not exists document_tags_team_id_idx on document_tags (team_id);
create index if not exists document_tags_updated_at_idx on document_tags (updated_at);

create table if not exists document_tag_assignments (
  team_id text not null,
  document_id text not null,
  tag_id text not null,
  document_created_at text,
  document_date text,
  created_at text not null,
  updated_at text not null,
  primary key (team_id, document_id, tag_id)
);

create index if not exists document_tag_assignments_team_document_idx
  on document_tag_assignments (team_id, document_id);

create index if not exists document_tag_assignments_team_tag_idx
  on document_tag_assignments (team_id, tag_id);

create index if not exists document_tag_assignments_team_tag_document_created_at_idx
  on document_tag_assignments (team_id, tag_id, document_created_at, document_id);
