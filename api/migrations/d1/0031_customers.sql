create table if not exists customers (
  id text primary key,
  team_id text not null,
  name text not null,
  email text not null,
  billing_email text,
  country text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  zip text,
  note text,
  website text,
  phone text,
  vat_number text,
  country_code text,
  token text,
  contact text,
  status text,
  preferred_currency text,
  default_payment_terms integer,
  is_archived integer not null default 0 check (is_archived in (0, 1)),
  source text,
  external_id text,
  logo_url text,
  description text,
  industry text,
  company_type text,
  employee_count text,
  founded_year integer,
  estimated_revenue text,
  funding_stage text,
  total_funding text,
  headquarters_location text,
  timezone text,
  linkedin_url text,
  twitter_url text,
  instagram_url text,
  facebook_url text,
  ceo_name text,
  finance_contact text,
  finance_contact_email text,
  primary_language text,
  fiscal_year_end text,
  enrichment_status text,
  enriched_at text,
  portal_enabled integer not null default 0 check (portal_enabled in (0, 1)),
  portal_id text,
  search_text text,
  created_at text not null,
  updated_at text not null
);

create index if not exists customers_team_id_idx on customers (team_id);
create index if not exists customers_team_created_at_idx on customers (team_id, created_at);
create index if not exists customers_team_name_idx on customers (team_id, name);
create index if not exists customers_team_enrichment_status_idx
  on customers (team_id, enrichment_status);
create unique index if not exists customers_portal_id_idx
  on customers (portal_id)
  where portal_id is not null;
create index if not exists customers_search_text_idx on customers (team_id, search_text);

create table if not exists customer_tag_assignments (
  customer_id text not null,
  tag_id text not null,
  team_id text not null,
  created_at text not null,
  updated_at text not null,
  primary key (team_id, customer_id, tag_id)
);

create index if not exists customer_tag_assignments_team_customer_idx
  on customer_tag_assignments (team_id, customer_id);
create index if not exists customer_tag_assignments_team_tag_idx
  on customer_tag_assignments (team_id, tag_id);
