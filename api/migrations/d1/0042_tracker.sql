create table if not exists tracker_projects (
  id text primary key,
  team_id text not null,
  name text not null,
  description text,
  status text not null check (status in ('in_progress', 'completed')),
  customer_id text,
  estimate real,
  currency text,
  billable integer not null default 0 check (billable in (0, 1)),
  rate real,
  search_text text,
  created_at text not null,
  updated_at text not null
);

create index if not exists tracker_projects_team_id_idx on tracker_projects (team_id);
create index if not exists tracker_projects_team_created_at_idx
  on tracker_projects (team_id, created_at);
create index if not exists tracker_projects_team_status_created_at_idx
  on tracker_projects (team_id, status, created_at);
create index if not exists tracker_projects_team_customer_idx
  on tracker_projects (team_id, customer_id);
create index if not exists tracker_projects_team_search_text_idx
  on tracker_projects (team_id, search_text);

create table if not exists tracker_entries (
  id text primary key,
  team_id text not null,
  project_id text,
  assigned_id text,
  description text,
  start text,
  stop text,
  duration real,
  date text not null,
  rate real,
  currency text,
  billed integer not null default 0 check (billed in (0, 1)),
  created_at text not null,
  updated_at text not null
);

create index if not exists tracker_entries_team_id_idx on tracker_entries (team_id);
create index if not exists tracker_entries_team_date_idx on tracker_entries (team_id, date);
create index if not exists tracker_entries_team_project_idx
  on tracker_entries (team_id, project_id);
create index if not exists tracker_entries_team_assigned_idx
  on tracker_entries (team_id, assigned_id);
create index if not exists tracker_entries_team_project_date_idx
  on tracker_entries (team_id, project_id, date);
create index if not exists tracker_entries_team_assigned_date_idx
  on tracker_entries (team_id, assigned_id, date);
create index if not exists tracker_entries_team_open_timer_idx
  on tracker_entries (team_id, assigned_id, stop, start);

create table if not exists tracker_project_tag_assignments (
  tracker_project_id text not null,
  tag_id text not null,
  team_id text not null,
  project_created_at text,
  created_at text not null,
  updated_at text not null,
  primary key (team_id, tracker_project_id, tag_id)
);

create index if not exists tracker_project_tag_assignments_team_project_idx
  on tracker_project_tag_assignments (team_id, tracker_project_id);
create index if not exists tracker_project_tag_assignments_team_tag_idx
  on tracker_project_tag_assignments (team_id, tag_id);
create index if not exists tracker_project_tag_assignments_team_tag_project_created_idx
  on tracker_project_tag_assignments (team_id, tag_id, project_created_at, tracker_project_id);
