import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "../../client";

export type FilingProfileRecord = {
  id: string;
  teamId: string;
  provider: string;
  legalEntityType: string;
  enabled: boolean;
  countryCode: string;
  companyName: string | null;
  companyNumber: string | null;
  companyAuthenticationCode: string | null;
  utr: string | null;
  vrn: string | null;
  vatScheme: string | null;
  accountingBasis: string;
  filingMode: string;
  agentReferenceNumber: string | null;
  yearEndMonth: number | null;
  yearEndDay: number | null;
  baseCurrency: string | null;
  principalActivity: string | null;
  directors: string[];
  signingDirectorName: string | null;
  approvalDate: string | null;
  averageEmployeeCount: number | null;
  ordinaryShareCount: number | null;
  ordinaryShareNominalValue: number | null;
  dormant: boolean | null;
  auditExemptionClaimed: boolean | null;
  membersDidNotRequireAudit: boolean | null;
  directorsAcknowledgeResponsibilities: boolean | null;
  accountsPreparedUnderSmallCompaniesRegime: boolean | null;
  createdAt: string;
  updatedAt: string;
};

export type ComplianceObligationRecord = {
  id: string;
  teamId: string;
  filingProfileId: string;
  provider: string;
  obligationType: string;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  status: string;
  externalId: string | null;
  raw: unknown;
  createdAt: string;
  updatedAt: string;
};

type FilingProfileRow = {
  id: string;
  team_id: string;
  provider: string;
  legal_entity_type: string;
  enabled: number;
  country_code: string;
  company_name: string | null;
  company_number: string | null;
  company_authentication_code: string | null;
  utr: string | null;
  vrn: string | null;
  vat_scheme: string | null;
  accounting_basis: string;
  filing_mode: string;
  agent_reference_number: string | null;
  year_end_month: number | null;
  year_end_day: number | null;
  base_currency: string | null;
  principal_activity: string | null;
  directors_json: string | null;
  signing_director_name: string | null;
  approval_date: string | null;
  average_employee_count: number | null;
  ordinary_share_count: number | null;
  ordinary_share_nominal_value: number | null;
  dormant: number | null;
  audit_exemption_claimed: number | null;
  members_did_not_require_audit: number | null;
  directors_acknowledge_responsibilities: number | null;
  accounts_prepared_under_small_companies_regime: number | null;
  created_at: string;
  updated_at: string;
};

type ComplianceObligationRow = {
  id: string;
  team_id: string;
  filing_profile_id: string;
  provider: string;
  obligation_type: string;
  period_key: string;
  period_start: string;
  period_end: string;
  due_date: string;
  status: string;
  external_id: string | null;
  raw_json: string | null;
  created_at: string;
  updated_at: string;
};

export type UpsertFilingProfileRecordParams = {
  id?: string;
  teamId: string;
  provider: string;
  legalEntityType: string;
  enabled: boolean;
  countryCode: string;
  companyName?: string | null;
  companyNumber?: string | null;
  companyAuthenticationCode?: string | null;
  utr?: string | null;
  vrn?: string | null;
  vatScheme?: string | null;
  accountingBasis: string;
  filingMode: string;
  agentReferenceNumber?: string | null;
  yearEndMonth?: number | null;
  yearEndDay?: number | null;
  baseCurrency?: string | null;
  principalActivity?: string | null;
  directors?: string[];
  signingDirectorName?: string | null;
  approvalDate?: string | null;
  averageEmployeeCount?: number | null;
  ordinaryShareCount?: number | null;
  ordinaryShareNominalValue?: number | null;
  dormant?: boolean | null;
  auditExemptionClaimed?: boolean | null;
  membersDidNotRequireAudit?: boolean | null;
  directorsAcknowledgeResponsibilities?: boolean | null;
  accountsPreparedUnderSmallCompaniesRegime?: boolean | null;
};

export type UpsertComplianceObligationRecordParams = {
  id?: string;
  teamId: string;
  filingProfileId: string;
  provider: string;
  obligationType: string;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  status: string;
  externalId?: string | null;
  raw?: unknown;
};

function requireComplianceFilingsD1(db: Database) {
  return requireCloudflareD1Database(db);
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }

  return JSON.parse(value) as T;
}

function serializeJson(value: unknown | null | undefined) {
  return value === undefined || value === null ? null : JSON.stringify(value);
}

function nullableBoolean(value: number | null) {
  return value === null ? null : value === 1;
}

function serializeNullableBoolean(value: boolean | null | undefined) {
  return value === undefined || value === null ? null : value ? 1 : 0;
}

function toFilingProfileRecord(row: FilingProfileRow): FilingProfileRecord {
  return {
    id: row.id,
    teamId: row.team_id,
    provider: row.provider,
    legalEntityType: row.legal_entity_type,
    enabled: row.enabled === 1,
    countryCode: row.country_code,
    companyName: row.company_name,
    companyNumber: row.company_number,
    companyAuthenticationCode: row.company_authentication_code,
    utr: row.utr,
    vrn: row.vrn,
    vatScheme: row.vat_scheme,
    accountingBasis: row.accounting_basis,
    filingMode: row.filing_mode,
    agentReferenceNumber: row.agent_reference_number,
    yearEndMonth: row.year_end_month,
    yearEndDay: row.year_end_day,
    baseCurrency: row.base_currency,
    principalActivity: row.principal_activity,
    directors: parseJson<string[]>(row.directors_json, []),
    signingDirectorName: row.signing_director_name,
    approvalDate: row.approval_date,
    averageEmployeeCount: row.average_employee_count,
    ordinaryShareCount: row.ordinary_share_count,
    ordinaryShareNominalValue: row.ordinary_share_nominal_value,
    dormant: nullableBoolean(row.dormant),
    auditExemptionClaimed: nullableBoolean(row.audit_exemption_claimed),
    membersDidNotRequireAudit: nullableBoolean(row.members_did_not_require_audit),
    directorsAcknowledgeResponsibilities: nullableBoolean(
      row.directors_acknowledge_responsibilities,
    ),
    accountsPreparedUnderSmallCompaniesRegime: nullableBoolean(
      row.accounts_prepared_under_small_companies_regime,
    ),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toComplianceObligationRecord(row: ComplianceObligationRow): ComplianceObligationRecord {
  return {
    id: row.id,
    teamId: row.team_id,
    filingProfileId: row.filing_profile_id,
    provider: row.provider,
    obligationType: row.obligation_type,
    periodKey: row.period_key,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    dueDate: row.due_date,
    status: row.status,
    externalId: row.external_id,
    raw: parseJson<unknown>(row.raw_json, null),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getFilingProfileByIdFromD1(d1: CloudflareD1DatabaseBinding, id: string) {
  const row = await d1
    .prepare("select * from filing_profiles where id = ? limit 1")
    .bind(id)
    .first<FilingProfileRow>();

  return row ? toFilingProfileRecord(row) : null;
}

async function getComplianceObligationByNaturalKey(
  d1: CloudflareD1DatabaseBinding,
  params: {
    teamId: string;
    filingProfileId: string;
    provider: string;
    obligationType: string;
    periodKey: string;
  },
) {
  const row = await d1
    .prepare(
      `select *
       from compliance_obligations
       where team_id = ?
         and filing_profile_id = ?
         and provider = ?
         and obligation_type = ?
         and period_key = ?
       limit 1`,
    )
    .bind(
      params.teamId,
      params.filingProfileId,
      params.provider,
      params.obligationType,
      params.periodKey,
    )
    .first<ComplianceObligationRow>();

  return row ? toComplianceObligationRecord(row) : null;
}

export async function getFilingProfileRecord(
  db: Database,
  args: {
    teamId: string;
    provider?: string;
  },
) {
  const d1 = requireComplianceFilingsD1(db);
  const row = await d1
    .prepare(
      `select *
       from filing_profiles
       where team_id = ? and provider = ?
       limit 1`,
    )
    .bind(args.teamId, args.provider ?? "hmrc-vat")
    .first<FilingProfileRow>();

  return row ? toFilingProfileRecord(row) : null;
}

export async function upsertFilingProfileRecord(
  db: Database,
  params: UpsertFilingProfileRecordParams,
) {
  const d1 = requireComplianceFilingsD1(db);
  const existing = await getFilingProfileRecord(db, {
    teamId: params.teamId,
    provider: params.provider,
  });
  const timestamp = new Date().toISOString();
  const directorsJson = JSON.stringify(params.directors ?? []);

  if (existing) {
    await d1
      .prepare(
        `update filing_profiles
         set legal_entity_type = ?,
             enabled = ?,
             country_code = ?,
             company_name = ?,
             company_number = ?,
             company_authentication_code = ?,
             utr = ?,
             vrn = ?,
             vat_scheme = ?,
             accounting_basis = ?,
             filing_mode = ?,
             agent_reference_number = ?,
             year_end_month = ?,
             year_end_day = ?,
             base_currency = ?,
             principal_activity = ?,
             directors_json = ?,
             signing_director_name = ?,
             approval_date = ?,
             average_employee_count = ?,
             ordinary_share_count = ?,
             ordinary_share_nominal_value = ?,
             dormant = ?,
             audit_exemption_claimed = ?,
             members_did_not_require_audit = ?,
             directors_acknowledge_responsibilities = ?,
             accounts_prepared_under_small_companies_regime = ?,
             updated_at = ?
         where id = ?`,
      )
      .bind(
        params.legalEntityType,
        params.enabled ? 1 : 0,
        params.countryCode,
        params.companyName ?? null,
        params.companyNumber ?? null,
        params.companyAuthenticationCode ?? null,
        params.utr ?? null,
        params.vrn ?? null,
        params.vatScheme ?? null,
        params.accountingBasis,
        params.filingMode,
        params.agentReferenceNumber ?? null,
        params.yearEndMonth ?? null,
        params.yearEndDay ?? null,
        params.baseCurrency ?? null,
        params.principalActivity ?? null,
        directorsJson,
        params.signingDirectorName ?? null,
        params.approvalDate ?? null,
        params.averageEmployeeCount ?? null,
        params.ordinaryShareCount ?? null,
        params.ordinaryShareNominalValue ?? null,
        serializeNullableBoolean(params.dormant),
        serializeNullableBoolean(params.auditExemptionClaimed),
        serializeNullableBoolean(params.membersDidNotRequireAudit),
        serializeNullableBoolean(params.directorsAcknowledgeResponsibilities),
        serializeNullableBoolean(params.accountsPreparedUnderSmallCompaniesRegime),
        timestamp,
        existing.id,
      )
      .run();

    const updated = await getFilingProfileByIdFromD1(d1, existing.id);

    if (!updated) {
      throw new Error("Failed to update filing profile");
    }

    return updated;
  }

  const id = params.id ?? crypto.randomUUID();
  await d1
    .prepare(
      `insert into filing_profiles (
        id,
        team_id,
        provider,
        legal_entity_type,
        enabled,
        country_code,
        company_name,
        company_number,
        company_authentication_code,
        utr,
        vrn,
        vat_scheme,
        accounting_basis,
        filing_mode,
        agent_reference_number,
        year_end_month,
        year_end_day,
        base_currency,
        principal_activity,
        directors_json,
        signing_director_name,
        approval_date,
        average_employee_count,
        ordinary_share_count,
        ordinary_share_nominal_value,
        dormant,
        audit_exemption_claimed,
        members_did_not_require_audit,
        directors_acknowledge_responsibilities,
        accounts_prepared_under_small_companies_regime,
        created_at,
        updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      params.teamId,
      params.provider,
      params.legalEntityType,
      params.enabled ? 1 : 0,
      params.countryCode,
      params.companyName ?? null,
      params.companyNumber ?? null,
      params.companyAuthenticationCode ?? null,
      params.utr ?? null,
      params.vrn ?? null,
      params.vatScheme ?? null,
      params.accountingBasis,
      params.filingMode,
      params.agentReferenceNumber ?? null,
      params.yearEndMonth ?? null,
      params.yearEndDay ?? null,
      params.baseCurrency ?? null,
      params.principalActivity ?? null,
      directorsJson,
      params.signingDirectorName ?? null,
      params.approvalDate ?? null,
      params.averageEmployeeCount ?? null,
      params.ordinaryShareCount ?? null,
      params.ordinaryShareNominalValue ?? null,
      serializeNullableBoolean(params.dormant),
      serializeNullableBoolean(params.auditExemptionClaimed),
      serializeNullableBoolean(params.membersDidNotRequireAudit),
      serializeNullableBoolean(params.directorsAcknowledgeResponsibilities),
      serializeNullableBoolean(params.accountsPreparedUnderSmallCompaniesRegime),
      timestamp,
      timestamp,
    )
    .run();

  const inserted = await getFilingProfileByIdFromD1(d1, id);

  if (!inserted) {
    throw new Error("Failed to create filing profile");
  }

  return inserted;
}

export async function upsertComplianceObligationRecord(
  db: Database,
  params: UpsertComplianceObligationRecordParams,
) {
  const d1 = requireComplianceFilingsD1(db);
  const existing = await getComplianceObligationByNaturalKey(d1, params);
  const timestamp = new Date().toISOString();

  if (existing) {
    await d1
      .prepare(
        `update compliance_obligations
         set period_start = ?,
             period_end = ?,
             due_date = ?,
             status = ?,
             external_id = ?,
             raw_json = ?,
             updated_at = ?
         where id = ?`,
      )
      .bind(
        params.periodStart,
        params.periodEnd,
        params.dueDate,
        params.status,
        params.externalId ?? null,
        serializeJson(params.raw),
        timestamp,
        existing.id,
      )
      .run();

    const updated = await getComplianceObligationById(db, { id: existing.id });

    if (!updated) {
      throw new Error("Failed to update compliance obligation");
    }

    return updated;
  }

  const id = params.id ?? crypto.randomUUID();
  await d1
    .prepare(
      `insert into compliance_obligations (
        id,
        team_id,
        filing_profile_id,
        provider,
        obligation_type,
        period_key,
        period_start,
        period_end,
        due_date,
        status,
        external_id,
        raw_json,
        created_at,
        updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      params.teamId,
      params.filingProfileId,
      params.provider,
      params.obligationType,
      params.periodKey,
      params.periodStart,
      params.periodEnd,
      params.dueDate,
      params.status,
      params.externalId ?? null,
      serializeJson(params.raw),
      timestamp,
      timestamp,
    )
    .run();

  const inserted = await getComplianceObligationById(db, { id });

  if (!inserted) {
    throw new Error("Failed to create compliance obligation");
  }

  return inserted;
}

export async function listComplianceObligationRecords(
  db: Database,
  args: {
    teamId: string;
    provider?: string;
    obligationType?: string;
  },
) {
  const d1 = requireComplianceFilingsD1(db);
  const result = await d1
    .prepare(
      `select *
       from compliance_obligations
       where team_id = ?
       order by period_start asc`,
    )
    .bind(args.teamId)
    .all<ComplianceObligationRow>();

  return (result.results ?? []).map(toComplianceObligationRecord).filter((obligation) => {
    if (args.provider && obligation.provider !== args.provider) {
      return false;
    }

    if (args.obligationType && obligation.obligationType !== args.obligationType) {
      return false;
    }

    return true;
  });
}

export async function getComplianceObligationById(
  db: Database,
  args: {
    id: string;
  },
) {
  const d1 = requireComplianceFilingsD1(db);
  const row = await d1
    .prepare("select * from compliance_obligations where id = ? limit 1")
    .bind(args.id)
    .first<ComplianceObligationRow>();

  return row ? toComplianceObligationRecord(row) : null;
}
