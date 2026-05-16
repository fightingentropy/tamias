create table if not exists vat_obligations (
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

create unique index if not exists vat_obligations_team_profile_period_idx
  on vat_obligations (team_id, filing_profile_id, provider, obligation_type, period_key);
create index if not exists vat_obligations_team_id_idx on vat_obligations (team_id);
create index if not exists vat_obligations_team_status_idx on vat_obligations (team_id, status);
create index if not exists vat_obligations_period_start_idx on vat_obligations (period_start);
create index if not exists vat_obligations_updated_at_idx on vat_obligations (updated_at);

create table if not exists vat_returns (
  id text primary key,
  team_id text not null,
  filing_profile_id text not null,
  obligation_id text,
  period_key text not null,
  period_start text not null,
  period_end text not null,
  status text not null check (status in ('draft', 'ready', 'submitted', 'accepted', 'rejected')),
  currency text not null,
  net_vat_due real not null,
  submitted_at text,
  external_submission_id text,
  declaration_accepted integer not null default 0 check (declaration_accepted in (0, 1)),
  lines_json text not null,
  created_at text not null,
  updated_at text not null
);

create unique index if not exists vat_returns_team_profile_period_idx
  on vat_returns (team_id, filing_profile_id, period_key);
create index if not exists vat_returns_team_id_idx on vat_returns (team_id);
create index if not exists vat_returns_team_obligation_idx on vat_returns (team_id, obligation_id);
create index if not exists vat_returns_team_status_idx on vat_returns (team_id, status);
create index if not exists vat_returns_updated_at_idx on vat_returns (updated_at);

create table if not exists vat_compliance_adjustments (
  id text primary key,
  team_id text not null,
  filing_profile_id text not null,
  vat_return_id text,
  obligation_id text,
  effective_date text not null,
  line_code text not null check (
    line_code in (
      'box1',
      'box2',
      'box3',
      'box4',
      'box5',
      'box6',
      'box7',
      'box8',
      'box9'
    )
  ),
  amount real not null,
  reason text not null,
  note text,
  created_by text,
  meta_json text,
  created_at text not null
);

create index if not exists vat_compliance_adjustments_profile_period_idx
  on vat_compliance_adjustments (team_id, filing_profile_id, effective_date);
create index if not exists vat_compliance_adjustments_vat_return_idx
  on vat_compliance_adjustments (team_id, vat_return_id);
create index if not exists vat_compliance_adjustments_obligation_idx
  on vat_compliance_adjustments (team_id, obligation_id);
create index if not exists vat_compliance_adjustments_created_at_idx
  on vat_compliance_adjustments (created_at);

create table if not exists vat_evidence_packs (
  id text primary key,
  team_id text not null,
  filing_profile_id text not null,
  vat_return_id text not null,
  checksum text not null,
  payload_json text not null,
  created_by text,
  created_at text not null,
  updated_at text not null
);

create unique index if not exists vat_evidence_packs_team_vat_return_idx
  on vat_evidence_packs (team_id, vat_return_id);
create index if not exists vat_evidence_packs_team_id_idx on vat_evidence_packs (team_id);
create index if not exists vat_evidence_packs_updated_at_idx on vat_evidence_packs (updated_at);
