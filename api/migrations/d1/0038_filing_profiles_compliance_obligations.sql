create table if not exists filing_profiles (
  id text primary key,
  team_id text not null,
  provider text not null,
  legal_entity_type text not null,
  enabled integer not null,
  country_code text not null,
  company_name text,
  company_number text,
  company_authentication_code text,
  utr text,
  vrn text,
  vat_scheme text,
  accounting_basis text not null,
  filing_mode text not null,
  agent_reference_number text,
  year_end_month integer,
  year_end_day integer,
  base_currency text,
  principal_activity text,
  directors_json text not null default '[]',
  signing_director_name text,
  approval_date text,
  average_employee_count integer,
  ordinary_share_count integer,
  ordinary_share_nominal_value real,
  dormant integer,
  audit_exemption_claimed integer,
  members_did_not_require_audit integer,
  directors_acknowledge_responsibilities integer,
  accounts_prepared_under_small_companies_regime integer,
  created_at text not null,
  updated_at text not null
);

create unique index if not exists filing_profiles_team_provider_idx
  on filing_profiles (team_id, provider);
create index if not exists filing_profiles_team_id_idx on filing_profiles (team_id);

create table if not exists compliance_obligations (
  id text primary key,
  team_id text not null,
  filing_profile_id text not null,
  provider text not null,
  obligation_type text not null,
  period_key text not null,
  period_start text not null,
  period_end text not null,
  due_date text not null,
  status text not null,
  external_id text,
  raw_json text,
  created_at text not null,
  updated_at text not null
);

create unique index if not exists compliance_obligations_natural_key_idx
  on compliance_obligations (
    team_id,
    filing_profile_id,
    provider,
    obligation_type,
    period_key
  );
create index if not exists compliance_obligations_team_id_idx
  on compliance_obligations (team_id);
create index if not exists compliance_obligations_filing_profile_idx
  on compliance_obligations (team_id, filing_profile_id);
