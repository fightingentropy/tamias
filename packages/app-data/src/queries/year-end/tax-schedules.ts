import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "../../client";

export type CorporationTaxAdjustmentRecord = {
  id: string;
  teamId: string;
  filingProfileId: string;
  periodKey: string;
  category: string;
  label: string;
  amount: number;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CorporationTaxRateScheduleRecord = {
  id: string;
  teamId: string;
  filingProfileId: string;
  periodKey: string;
  exemptDistributions: number | null;
  associatedCompaniesThisPeriod: number | null;
  associatedCompaniesFirstYear: number | null;
  associatedCompaniesSecondYear: number | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CloseCompanyLoansScheduleRecord = {
  id: string;
  teamId: string;
  filingProfileId: string;
  periodKey: string;
  beforeEndPeriod: boolean;
  loansMade: Array<{
    name: string;
    amountOfLoan: number;
  }>;
  taxChargeable: number | null;
  reliefEarlierThan: Array<{
    name: string;
    amountRepaid: number | null;
    amountReleasedOrWrittenOff: number | null;
    date: string;
  }>;
  reliefEarlierDue: number | null;
  loanLaterReliefNow: Array<{
    name: string;
    amountRepaid: number | null;
    amountReleasedOrWrittenOff: number | null;
    date: string;
  }>;
  reliefLaterDue: number | null;
  totalLoansOutstanding: number | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type CorporationTaxAdjustmentRow = {
  id: string;
  team_id: string;
  filing_profile_id: string;
  period_key: string;
  category: string | null;
  label: string;
  amount: number;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type CorporationTaxRateScheduleRow = {
  id: string;
  team_id: string;
  filing_profile_id: string;
  period_key: string;
  exempt_distributions: number | null;
  associated_companies_this_period: number | null;
  associated_companies_first_year: number | null;
  associated_companies_second_year: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type CloseCompanyLoansScheduleRow = {
  id: string;
  team_id: string;
  filing_profile_id: string;
  period_key: string;
  before_end_period: number;
  loans_made_json: string | null;
  tax_chargeable: number | null;
  relief_earlier_than_json: string | null;
  relief_earlier_due: number | null;
  loan_later_relief_now_json: string | null;
  relief_later_due: number | null;
  total_loans_outstanding: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type TaxSchedulePeriodParams = {
  teamId: string;
  filingProfileId: string;
  periodKey: string;
};

export type UpsertCorporationTaxAdjustmentParams = TaxSchedulePeriodParams & {
  id?: string;
  category?: string;
  label: string;
  amount: number;
  note?: string | null;
  createdBy?: string | null;
};

export type UpsertCorporationTaxRateScheduleParams = TaxSchedulePeriodParams & {
  exemptDistributions: number | null;
  associatedCompaniesThisPeriod: number | null;
  associatedCompaniesFirstYear: number | null;
  associatedCompaniesSecondYear: number | null;
  createdBy?: string | null;
};

export type UpsertCloseCompanyLoansScheduleParams = TaxSchedulePeriodParams & {
  beforeEndPeriod: boolean;
  loansMade: CloseCompanyLoansScheduleRecord["loansMade"];
  taxChargeable: number | null;
  reliefEarlierThan: CloseCompanyLoansScheduleRecord["reliefEarlierThan"];
  reliefEarlierDue: number | null;
  loanLaterReliefNow: CloseCompanyLoansScheduleRecord["loanLaterReliefNow"];
  reliefLaterDue: number | null;
  totalLoansOutstanding: number | null;
  createdBy?: string | null;
};

function requireYearEndTaxSchedulesD1(db: Database) {
  return requireCloudflareD1Database(db);
}

function serializeJson(value: unknown) {
  return JSON.stringify(value ?? []);
}

function parseJsonArray<T>(value: string | null): T[] {
  if (!value) {
    return [];
  }

  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) ? (parsed as T[]) : [];
}

function toCorporationTaxAdjustmentRecord(
  row: CorporationTaxAdjustmentRow,
): CorporationTaxAdjustmentRecord {
  return {
    id: row.id,
    teamId: row.team_id,
    filingProfileId: row.filing_profile_id,
    periodKey: row.period_key,
    category: row.category ?? "other",
    label: row.label,
    amount: row.amount,
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCorporationTaxRateScheduleRecord(
  row: CorporationTaxRateScheduleRow,
): CorporationTaxRateScheduleRecord {
  return {
    id: row.id,
    teamId: row.team_id,
    filingProfileId: row.filing_profile_id,
    periodKey: row.period_key,
    exemptDistributions: row.exempt_distributions,
    associatedCompaniesThisPeriod: row.associated_companies_this_period,
    associatedCompaniesFirstYear: row.associated_companies_first_year,
    associatedCompaniesSecondYear: row.associated_companies_second_year,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCloseCompanyLoansScheduleRecord(
  row: CloseCompanyLoansScheduleRow,
): CloseCompanyLoansScheduleRecord {
  return {
    id: row.id,
    teamId: row.team_id,
    filingProfileId: row.filing_profile_id,
    periodKey: row.period_key,
    beforeEndPeriod: row.before_end_period === 1,
    loansMade: parseJsonArray<CloseCompanyLoansScheduleRecord["loansMade"][number]>(
      row.loans_made_json,
    ),
    taxChargeable: row.tax_chargeable,
    reliefEarlierThan: parseJsonArray<CloseCompanyLoansScheduleRecord["reliefEarlierThan"][number]>(
      row.relief_earlier_than_json,
    ),
    reliefEarlierDue: row.relief_earlier_due,
    loanLaterReliefNow: parseJsonArray<
      CloseCompanyLoansScheduleRecord["loanLaterReliefNow"][number]
    >(row.loan_later_relief_now_json),
    reliefLaterDue: row.relief_later_due,
    totalLoansOutstanding: row.total_loans_outstanding,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getCorporationTaxAdjustmentById(
  d1: CloudflareD1DatabaseBinding,
  params: { teamId: string; id: string },
) {
  const row = await d1
    .prepare("select * from corporation_tax_adjustments where team_id = ? and id = ? limit 1")
    .bind(params.teamId, params.id)
    .first<CorporationTaxAdjustmentRow>();

  return row ? toCorporationTaxAdjustmentRecord(row) : null;
}

async function getCorporationTaxRateScheduleByPeriodFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: TaxSchedulePeriodParams,
) {
  const row = await d1
    .prepare(
      `select * from corporation_tax_rate_schedules
       where team_id = ? and filing_profile_id = ? and period_key = ?
       limit 1`,
    )
    .bind(params.teamId, params.filingProfileId, params.periodKey)
    .first<CorporationTaxRateScheduleRow>();

  return row ? toCorporationTaxRateScheduleRecord(row) : null;
}

async function getCloseCompanyLoansScheduleByPeriodFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: TaxSchedulePeriodParams,
) {
  const row = await d1
    .prepare(
      `select * from close_company_loans_schedules
       where team_id = ? and filing_profile_id = ? and period_key = ?
       limit 1`,
    )
    .bind(params.teamId, params.filingProfileId, params.periodKey)
    .first<CloseCompanyLoansScheduleRow>();

  return row ? toCloseCompanyLoansScheduleRecord(row) : null;
}

export async function listCorporationTaxAdjustmentsForPeriod(
  db: Database,
  params: TaxSchedulePeriodParams,
) {
  const d1 = requireYearEndTaxSchedulesD1(db);
  const result = await d1
    .prepare(
      `select * from corporation_tax_adjustments
       where team_id = ? and filing_profile_id = ? and period_key = ?
       order by created_at asc, id asc`,
    )
    .bind(params.teamId, params.filingProfileId, params.periodKey)
    .all<CorporationTaxAdjustmentRow>();

  return (result.results ?? []).map(toCorporationTaxAdjustmentRecord);
}

export async function upsertCorporationTaxAdjustmentRecord(
  db: Database,
  params: UpsertCorporationTaxAdjustmentParams,
) {
  const d1 = requireYearEndTaxSchedulesD1(db);
  const timestamp = new Date().toISOString();
  const id = params.id ?? crypto.randomUUID();
  const existing = params.id
    ? await getCorporationTaxAdjustmentById(d1, {
        teamId: params.teamId,
        id: params.id,
      })
    : null;

  if (existing) {
    await d1
      .prepare(
        `update corporation_tax_adjustments
         set filing_profile_id = ?,
             period_key = ?,
             category = ?,
             label = ?,
             amount = ?,
             note = ?,
             created_by = ?,
             updated_at = ?
         where team_id = ? and id = ?`,
      )
      .bind(
        params.filingProfileId,
        params.periodKey,
        params.category ?? "other",
        params.label,
        params.amount,
        params.note ?? null,
        params.createdBy ?? null,
        timestamp,
        params.teamId,
        id,
      )
      .run();
  } else {
    await d1
      .prepare(
        `insert into corporation_tax_adjustments (
          id,
          team_id,
          filing_profile_id,
          period_key,
          category,
          label,
          amount,
          note,
          created_by,
          created_at,
          updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        params.teamId,
        params.filingProfileId,
        params.periodKey,
        params.category ?? "other",
        params.label,
        params.amount,
        params.note ?? null,
        params.createdBy ?? null,
        timestamp,
        timestamp,
      )
      .run();
  }

  const record = await getCorporationTaxAdjustmentById(d1, {
    teamId: params.teamId,
    id,
  });

  if (!record) {
    throw new Error("Failed to save corporation tax adjustment");
  }

  return record;
}

export async function deleteCorporationTaxAdjustmentRecord(
  db: Database,
  params: { teamId: string; id: string },
) {
  const d1 = requireYearEndTaxSchedulesD1(db);
  const existing = await getCorporationTaxAdjustmentById(d1, params);

  if (!existing) {
    return { deleted: false };
  }

  await d1
    .prepare("delete from corporation_tax_adjustments where team_id = ? and id = ?")
    .bind(params.teamId, params.id)
    .run();

  return { deleted: true };
}

export async function getCorporationTaxRateScheduleByPeriod(
  db: Database,
  params: TaxSchedulePeriodParams,
) {
  return getCorporationTaxRateScheduleByPeriodFromD1(requireYearEndTaxSchedulesD1(db), params);
}

export async function upsertCorporationTaxRateScheduleRecord(
  db: Database,
  params: UpsertCorporationTaxRateScheduleParams,
) {
  const d1 = requireYearEndTaxSchedulesD1(db);
  const existing = await getCorporationTaxRateScheduleByPeriodFromD1(d1, params);
  const timestamp = new Date().toISOString();
  const id = existing?.id ?? crypto.randomUUID();

  await d1
    .prepare(
      `insert into corporation_tax_rate_schedules (
        id,
        team_id,
        filing_profile_id,
        period_key,
        exempt_distributions,
        associated_companies_this_period,
        associated_companies_first_year,
        associated_companies_second_year,
        created_by,
        created_at,
        updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(team_id, filing_profile_id, period_key) do update set
        exempt_distributions = excluded.exempt_distributions,
        associated_companies_this_period = excluded.associated_companies_this_period,
        associated_companies_first_year = excluded.associated_companies_first_year,
        associated_companies_second_year = excluded.associated_companies_second_year,
        created_by = excluded.created_by,
        updated_at = excluded.updated_at`,
    )
    .bind(
      id,
      params.teamId,
      params.filingProfileId,
      params.periodKey,
      params.exemptDistributions,
      params.associatedCompaniesThisPeriod,
      params.associatedCompaniesFirstYear,
      params.associatedCompaniesSecondYear,
      params.createdBy ?? null,
      existing?.createdAt ?? timestamp,
      timestamp,
    )
    .run();

  const record = await getCorporationTaxRateScheduleByPeriodFromD1(d1, params);

  if (!record) {
    throw new Error("Failed to save corporation tax rate schedule");
  }

  return record;
}

export async function deleteCorporationTaxRateScheduleRecord(
  db: Database,
  params: TaxSchedulePeriodParams,
) {
  const d1 = requireYearEndTaxSchedulesD1(db);
  const existing = await getCorporationTaxRateScheduleByPeriodFromD1(d1, params);

  if (!existing) {
    return { deleted: false };
  }

  await d1
    .prepare(
      `delete from corporation_tax_rate_schedules
       where team_id = ? and filing_profile_id = ? and period_key = ?`,
    )
    .bind(params.teamId, params.filingProfileId, params.periodKey)
    .run();

  return { deleted: true };
}

export async function getCloseCompanyLoansScheduleByPeriod(
  db: Database,
  params: TaxSchedulePeriodParams,
) {
  return getCloseCompanyLoansScheduleByPeriodFromD1(requireYearEndTaxSchedulesD1(db), params);
}

export async function upsertCloseCompanyLoansScheduleRecord(
  db: Database,
  params: UpsertCloseCompanyLoansScheduleParams,
) {
  const d1 = requireYearEndTaxSchedulesD1(db);
  const existing = await getCloseCompanyLoansScheduleByPeriodFromD1(d1, params);
  const timestamp = new Date().toISOString();
  const id = existing?.id ?? crypto.randomUUID();

  await d1
    .prepare(
      `insert into close_company_loans_schedules (
        id,
        team_id,
        filing_profile_id,
        period_key,
        before_end_period,
        loans_made_json,
        tax_chargeable,
        relief_earlier_than_json,
        relief_earlier_due,
        loan_later_relief_now_json,
        relief_later_due,
        total_loans_outstanding,
        created_by,
        created_at,
        updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(team_id, filing_profile_id, period_key) do update set
        before_end_period = excluded.before_end_period,
        loans_made_json = excluded.loans_made_json,
        tax_chargeable = excluded.tax_chargeable,
        relief_earlier_than_json = excluded.relief_earlier_than_json,
        relief_earlier_due = excluded.relief_earlier_due,
        loan_later_relief_now_json = excluded.loan_later_relief_now_json,
        relief_later_due = excluded.relief_later_due,
        total_loans_outstanding = excluded.total_loans_outstanding,
        created_by = excluded.created_by,
        updated_at = excluded.updated_at`,
    )
    .bind(
      id,
      params.teamId,
      params.filingProfileId,
      params.periodKey,
      params.beforeEndPeriod ? 1 : 0,
      serializeJson(params.loansMade),
      params.taxChargeable,
      serializeJson(params.reliefEarlierThan),
      params.reliefEarlierDue,
      serializeJson(params.loanLaterReliefNow),
      params.reliefLaterDue,
      params.totalLoansOutstanding,
      params.createdBy ?? null,
      existing?.createdAt ?? timestamp,
      timestamp,
    )
    .run();

  const record = await getCloseCompanyLoansScheduleByPeriodFromD1(d1, params);

  if (!record) {
    throw new Error("Failed to save close company loans schedule");
  }

  return record;
}

export async function deleteCloseCompanyLoansScheduleRecord(
  db: Database,
  params: TaxSchedulePeriodParams,
) {
  const d1 = requireYearEndTaxSchedulesD1(db);
  const existing = await getCloseCompanyLoansScheduleByPeriodFromD1(d1, params);

  if (!existing) {
    return { deleted: false };
  }

  await d1
    .prepare(
      `delete from close_company_loans_schedules
       where team_id = ? and filing_profile_id = ? and period_key = ?`,
    )
    .bind(params.teamId, params.filingProfileId, params.periodKey)
    .run();

  return { deleted: true };
}
