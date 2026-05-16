import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "../client";
import type { PayrollRunRecord } from "./payroll-shared";

type PayrollRunRow = {
  id: string;
  team_id: string;
  filing_profile_id: string;
  period_key: string;
  pay_period_start: string;
  pay_period_end: string;
  run_date: string;
  source: "csv" | "manual";
  status: "imported" | "exported";
  checksum: string;
  currency: string;
  journal_entry_id: string;
  line_count: number;
  liability_gross_pay: number;
  liability_employer_taxes: number;
  liability_paye: number;
  export_bundles_json: string;
  latest_exported_at: string | null;
  meta_json: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type UpsertPayrollRunInD1Params = {
  id?: string;
  teamId: string;
  filingProfileId: string;
  periodKey: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  runDate: string;
  source: "csv" | "manual";
  status: "imported" | "exported";
  checksum: string;
  currency: string;
  journalEntryId: string;
  lineCount: number;
  liabilityTotals: {
    grossPay: number;
    employerTaxes: number;
    payeLiability: number;
  };
  exportBundles: PayrollRunRecord["exportBundles"];
  latestExportedAt?: string | null;
  meta?: Record<string, unknown> | null;
  createdBy?: string | null;
};

export function requirePayrollRunsD1(db: Database) {
  return requireCloudflareD1Database(db);
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }

  return JSON.parse(value) as T;
}

function toPayrollRunRecord(row: PayrollRunRow): PayrollRunRecord {
  return {
    id: row.id,
    teamId: row.team_id,
    filingProfileId: row.filing_profile_id,
    periodKey: row.period_key,
    payPeriodStart: row.pay_period_start,
    payPeriodEnd: row.pay_period_end,
    runDate: row.run_date,
    source: row.source,
    status: row.status,
    checksum: row.checksum,
    currency: row.currency,
    journalEntryId: row.journal_entry_id,
    lineCount: row.line_count,
    liabilityTotals: {
      grossPay: row.liability_gross_pay,
      employerTaxes: row.liability_employer_taxes,
      payeLiability: row.liability_paye,
    },
    exportBundles: parseJson<PayrollRunRecord["exportBundles"]>(row.export_bundles_json, []),
    latestExportedAt: row.latest_exported_at,
    meta: parseJson<Record<string, unknown> | null>(row.meta_json, null),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listPayrollRunsFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: { teamId: string },
) {
  const { results = [] } = await d1
    .prepare(
      `select *
       from payroll_runs
       where team_id = ?
       order by pay_period_end desc, run_date desc, created_at desc`,
    )
    .bind(args.teamId)
    .all<PayrollRunRow>();

  return results.map(toPayrollRunRecord);
}

export async function getPayrollRunByPeriodFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: { teamId: string; periodKey: string },
) {
  const row = await d1
    .prepare(
      `select *
       from payroll_runs
       where team_id = ? and period_key = ?
       limit 1`,
    )
    .bind(args.teamId, args.periodKey)
    .first<PayrollRunRow>();

  return row ? toPayrollRunRecord(row) : null;
}

export async function upsertPayrollRunInD1(
  d1: CloudflareD1DatabaseBinding,
  args: UpsertPayrollRunInD1Params,
) {
  const existing = await getPayrollRunByPeriodFromD1(d1, {
    teamId: args.teamId,
    periodKey: args.periodKey,
  });
  const timestamp = new Date().toISOString();
  const id = existing?.id ?? args.id ?? crypto.randomUUID();
  const createdAt = existing?.createdAt ?? timestamp;
  const latestExportedAt = args.latestExportedAt ?? null;

  await d1
    .prepare(
      `insert into payroll_runs (
        id,
        team_id,
        filing_profile_id,
        period_key,
        pay_period_start,
        pay_period_end,
        run_date,
        source,
        status,
        checksum,
        currency,
        journal_entry_id,
        line_count,
        liability_gross_pay,
        liability_employer_taxes,
        liability_paye,
        export_bundles_json,
        latest_exported_at,
        meta_json,
        created_by,
        created_at,
        updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(team_id, period_key) do update set
        id = excluded.id,
        filing_profile_id = excluded.filing_profile_id,
        pay_period_start = excluded.pay_period_start,
        pay_period_end = excluded.pay_period_end,
        run_date = excluded.run_date,
        source = excluded.source,
        status = excluded.status,
        checksum = excluded.checksum,
        currency = excluded.currency,
        journal_entry_id = excluded.journal_entry_id,
        line_count = excluded.line_count,
        liability_gross_pay = excluded.liability_gross_pay,
        liability_employer_taxes = excluded.liability_employer_taxes,
        liability_paye = excluded.liability_paye,
        export_bundles_json = excluded.export_bundles_json,
        latest_exported_at = excluded.latest_exported_at,
        meta_json = excluded.meta_json,
        created_by = excluded.created_by,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at`,
    )
    .bind(
      id,
      args.teamId,
      args.filingProfileId,
      args.periodKey,
      args.payPeriodStart,
      args.payPeriodEnd,
      args.runDate,
      args.source,
      args.status,
      args.checksum,
      args.currency,
      args.journalEntryId,
      args.lineCount,
      args.liabilityTotals.grossPay,
      args.liabilityTotals.employerTaxes,
      args.liabilityTotals.payeLiability,
      JSON.stringify(args.exportBundles),
      latestExportedAt,
      args.meta ? JSON.stringify(args.meta) : null,
      args.createdBy ?? null,
      createdAt,
      timestamp,
    )
    .run();

  const updated = await getPayrollRunByPeriodFromD1(d1, {
    teamId: args.teamId,
    periodKey: args.periodKey,
  });

  if (!updated) {
    throw new Error("Failed to upsert payroll run");
  }

  return updated;
}
