import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "../../client";

export type ExportBundleRecord = {
  id: string;
  filePath: string;
  fileName: string;
  checksum: string;
  generatedAt: string;
  manifest: Record<string, unknown>;
};

export type YearEndPackRecord = {
  id: string;
  teamId: string;
  filingProfileId: string;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  accountsDueDate: string;
  corporationTaxDueDate: string;
  status: "draft" | "ready" | "exported";
  currency: string;
  trialBalance: unknown;
  profitAndLoss: unknown;
  balanceSheet: unknown;
  retainedEarnings: unknown;
  workingPapers: unknown;
  corporationTax: unknown;
  manualJournalCount: number;
  payrollRunCount: number;
  exportBundles: ExportBundleRecord[];
  latestExportedAt: string | null;
  snapshotChecksum: string;
  createdAt: string;
  updatedAt: string;
};

type YearEndPackRow = {
  id: string;
  team_id: string;
  filing_profile_id: string;
  period_key: string;
  period_start: string;
  period_end: string;
  accounts_due_date: string;
  corporation_tax_due_date: string;
  status: "draft" | "ready" | "exported";
  currency: string;
  trial_balance_json: string;
  profit_and_loss_json: string;
  balance_sheet_json: string;
  retained_earnings_json: string;
  working_papers_json: string;
  corporation_tax_json: string;
  manual_journal_count: number;
  payroll_run_count: number;
  export_bundles_json: string;
  latest_exported_at: string | null;
  snapshot_checksum: string;
  created_at: string;
  updated_at: string;
};

export type YearEndPackPeriodParams = {
  teamId: string;
  filingProfileId: string;
  periodKey: string;
};

export type UpsertYearEndPackParams = YearEndPackPeriodParams & {
  id?: string;
  periodStart: string;
  periodEnd: string;
  accountsDueDate: string;
  corporationTaxDueDate: string;
  status: "draft" | "ready" | "exported";
  currency: string;
  trialBalance: unknown;
  profitAndLoss: unknown;
  balanceSheet: unknown;
  retainedEarnings: unknown;
  workingPapers: unknown;
  corporationTax: unknown;
  manualJournalCount: number;
  payrollRunCount: number;
  exportBundles: ExportBundleRecord[];
  latestExportedAt?: string | null;
  snapshotChecksum: string;
};

function requireYearEndPacksD1(db: Database) {
  return requireCloudflareD1Database(db);
}

function serializeJson(value: unknown) {
  return JSON.stringify(value ?? null);
}

function parseJson(value: string) {
  return JSON.parse(value) as unknown;
}

function parseExportBundles(value: string): ExportBundleRecord[] {
  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) ? (parsed as ExportBundleRecord[]) : [];
}

function toYearEndPackRecord(row: YearEndPackRow): YearEndPackRecord {
  return {
    id: row.id,
    teamId: row.team_id,
    filingProfileId: row.filing_profile_id,
    periodKey: row.period_key,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    accountsDueDate: row.accounts_due_date,
    corporationTaxDueDate: row.corporation_tax_due_date,
    status: row.status,
    currency: row.currency,
    trialBalance: parseJson(row.trial_balance_json),
    profitAndLoss: parseJson(row.profit_and_loss_json),
    balanceSheet: parseJson(row.balance_sheet_json),
    retainedEarnings: parseJson(row.retained_earnings_json),
    workingPapers: parseJson(row.working_papers_json),
    corporationTax: parseJson(row.corporation_tax_json),
    manualJournalCount: row.manual_journal_count,
    payrollRunCount: row.payroll_run_count,
    exportBundles: parseExportBundles(row.export_bundles_json),
    latestExportedAt: row.latest_exported_at,
    snapshotChecksum: row.snapshot_checksum,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getYearEndPackByIdFromD1(d1: CloudflareD1DatabaseBinding, id: string) {
  const row = await d1
    .prepare("select * from year_end_packs where id = ? limit 1")
    .bind(id)
    .first<YearEndPackRow>();

  return row ? toYearEndPackRecord(row) : null;
}

export async function getYearEndPackByPeriod(db: Database, params: YearEndPackPeriodParams) {
  const row = await requireYearEndPacksD1(db)
    .prepare(
      `select * from year_end_packs
       where team_id = ? and filing_profile_id = ? and period_key = ?
       limit 1`,
    )
    .bind(params.teamId, params.filingProfileId, params.periodKey)
    .first<YearEndPackRow>();

  return row ? toYearEndPackRecord(row) : null;
}

export async function upsertYearEndPack(db: Database, params: UpsertYearEndPackParams) {
  const d1 = requireYearEndPacksD1(db);
  const existing = await getYearEndPackByPeriod(db, params);
  const timestamp = new Date().toISOString();
  const id = existing?.id ?? params.id ?? crypto.randomUUID();

  await d1
    .prepare(
      `insert into year_end_packs (
        id,
        team_id,
        filing_profile_id,
        period_key,
        period_start,
        period_end,
        accounts_due_date,
        corporation_tax_due_date,
        status,
        currency,
        trial_balance_json,
        profit_and_loss_json,
        balance_sheet_json,
        retained_earnings_json,
        working_papers_json,
        corporation_tax_json,
        manual_journal_count,
        payroll_run_count,
        export_bundles_json,
        latest_exported_at,
        snapshot_checksum,
        created_at,
        updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(team_id, filing_profile_id, period_key) do update set
        period_start = excluded.period_start,
        period_end = excluded.period_end,
        accounts_due_date = excluded.accounts_due_date,
        corporation_tax_due_date = excluded.corporation_tax_due_date,
        status = excluded.status,
        currency = excluded.currency,
        trial_balance_json = excluded.trial_balance_json,
        profit_and_loss_json = excluded.profit_and_loss_json,
        balance_sheet_json = excluded.balance_sheet_json,
        retained_earnings_json = excluded.retained_earnings_json,
        working_papers_json = excluded.working_papers_json,
        corporation_tax_json = excluded.corporation_tax_json,
        manual_journal_count = excluded.manual_journal_count,
        payroll_run_count = excluded.payroll_run_count,
        export_bundles_json = excluded.export_bundles_json,
        latest_exported_at = excluded.latest_exported_at,
        snapshot_checksum = excluded.snapshot_checksum,
        updated_at = excluded.updated_at`,
    )
    .bind(
      id,
      params.teamId,
      params.filingProfileId,
      params.periodKey,
      params.periodStart,
      params.periodEnd,
      params.accountsDueDate,
      params.corporationTaxDueDate,
      params.status,
      params.currency,
      serializeJson(params.trialBalance),
      serializeJson(params.profitAndLoss),
      serializeJson(params.balanceSheet),
      serializeJson(params.retainedEarnings),
      serializeJson(params.workingPapers),
      serializeJson(params.corporationTax),
      params.manualJournalCount,
      params.payrollRunCount,
      serializeJson(params.exportBundles),
      params.latestExportedAt ?? null,
      params.snapshotChecksum,
      existing?.createdAt ?? timestamp,
      timestamp,
    )
    .run();

  const record = await getYearEndPackByIdFromD1(d1, id);

  if (!record) {
    throw new Error("Failed to save year-end pack");
  }

  return record;
}
