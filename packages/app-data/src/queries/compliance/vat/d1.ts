import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "../../../client";
import type {
  ComplianceAdjustmentLineCode,
  ComplianceAdjustmentRecord,
  ComplianceObligationRecord,
  EvidencePackRecord,
  VatFilingActorId,
  VatReturnLineRecord,
  VatReturnRecord,
} from "./types";

type VatObligationRow = {
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

type VatReturnRow = {
  id: string;
  team_id: string;
  filing_profile_id: string;
  obligation_id: string | null;
  period_key: string;
  period_start: string;
  period_end: string;
  status: VatReturnRecord["status"];
  currency: string;
  net_vat_due: number;
  submitted_at: string | null;
  external_submission_id: string | null;
  declaration_accepted: number;
  lines_json: string;
  created_at: string;
  updated_at: string;
};

type ComplianceAdjustmentRow = {
  id: string;
  team_id: string;
  filing_profile_id: string;
  vat_return_id: string | null;
  obligation_id: string | null;
  effective_date: string;
  line_code: ComplianceAdjustmentLineCode;
  amount: number;
  reason: string;
  note: string | null;
  created_by: string | null;
  meta_json: string | null;
  created_at: string;
};

type EvidencePackRow = {
  id: string;
  team_id: string;
  filing_profile_id: string;
  vat_return_id: string;
  checksum: string;
  payload_json: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }

  return JSON.parse(value) as T;
}

function serializeJson(value: unknown | null | undefined) {
  return value === undefined || value === null ? null : JSON.stringify(value);
}

function serializeRequiredJson(value: unknown) {
  return JSON.stringify(value);
}

function toBoolean(value: number | boolean | null | undefined) {
  return value === true || value === 1;
}

function toVatObligationRecord(row: VatObligationRow): ComplianceObligationRecord {
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

function normalizeVatReturnLines(lines: Array<Partial<VatReturnLineRecord>>) {
  return lines.map((line) => ({
    code: line.code ?? "",
    label: line.label ?? "",
    amount: line.amount ?? 0,
    meta: line.meta ?? null,
  }));
}

function toVatReturnRecord(row: VatReturnRow): VatReturnRecord {
  return {
    id: row.id,
    teamId: row.team_id,
    filingProfileId: row.filing_profile_id,
    obligationId: row.obligation_id,
    periodKey: row.period_key,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    status: row.status,
    currency: row.currency,
    netVatDue: row.net_vat_due,
    submittedAt: row.submitted_at,
    externalSubmissionId: row.external_submission_id,
    declarationAccepted: toBoolean(row.declaration_accepted),
    lines: normalizeVatReturnLines(parseJson<VatReturnLineRecord[]>(row.lines_json, [])),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toComplianceAdjustmentRecord(row: ComplianceAdjustmentRow): ComplianceAdjustmentRecord {
  return {
    id: row.id,
    teamId: row.team_id,
    filingProfileId: row.filing_profile_id,
    vatReturnId: row.vat_return_id,
    obligationId: row.obligation_id,
    effectiveDate: row.effective_date,
    lineCode: row.line_code,
    amount: row.amount,
    reason: row.reason,
    note: row.note,
    createdBy: row.created_by,
    meta: parseJson<unknown>(row.meta_json, null),
    createdAt: row.created_at,
  };
}

function toEvidencePackRecord(row: EvidencePackRow): EvidencePackRecord {
  return {
    id: row.id,
    teamId: row.team_id,
    filingProfileId: row.filing_profile_id,
    vatReturnId: row.vat_return_id,
    checksum: row.checksum,
    payload: parseJson<Record<string, unknown>>(row.payload_json, {}),
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export function getVatFilingStateD1(db: Database) {
  return requireCloudflareD1Database(db);
}

export function requireVatFilingStateD1(db: Database) {
  const d1 = getVatFilingStateD1(db);

  if (!d1) {
    throw new Error("VAT filing state requires Cloudflare D1");
  }

  return d1;
}

async function getVatObligationByNaturalKey(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    filingProfileId: string;
    provider: string;
    obligationType: string;
    periodKey: string;
  },
) {
  return d1
    .prepare(
      `select *
       from vat_obligations
       where team_id = ?
         and filing_profile_id = ?
         and provider = ?
         and obligation_type = ?
         and period_key = ?
       limit 1`,
    )
    .bind(args.teamId, args.filingProfileId, args.provider, args.obligationType, args.periodKey)
    .first<VatObligationRow>();
}

async function getVatReturnByNaturalKey(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    filingProfileId: string;
    periodKey: string;
  },
) {
  return d1
    .prepare(
      `select *
       from vat_returns
       where team_id = ? and filing_profile_id = ? and period_key = ?
       limit 1`,
    )
    .bind(args.teamId, args.filingProfileId, args.periodKey)
    .first<VatReturnRow>();
}

export async function upsertVatObligationInD1(
  db: Database,
  args: {
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
  },
) {
  const d1 = requireVatFilingStateD1(db);
  const existing =
    (args.id
      ? await d1
          .prepare("select * from vat_obligations where id = ? limit 1")
          .bind(args.id)
          .first<VatObligationRow>()
      : null) ?? (await getVatObligationByNaturalKey(d1, args));
  const timestamp = new Date().toISOString();
  const id = existing?.id ?? args.id ?? crypto.randomUUID();
  const createdAt = existing?.created_at ?? timestamp;

  await d1
    .prepare(
      `insert into vat_obligations (
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
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(id) do update set
        team_id = excluded.team_id,
        filing_profile_id = excluded.filing_profile_id,
        provider = excluded.provider,
        obligation_type = excluded.obligation_type,
        period_key = excluded.period_key,
        period_start = excluded.period_start,
        period_end = excluded.period_end,
        due_date = excluded.due_date,
        status = excluded.status,
        external_id = excluded.external_id,
        raw_json = excluded.raw_json,
        updated_at = excluded.updated_at`,
    )
    .bind(
      id,
      args.teamId,
      args.filingProfileId,
      args.provider,
      args.obligationType,
      args.periodKey,
      args.periodStart,
      args.periodEnd,
      args.dueDate,
      args.status,
      args.externalId ?? null,
      serializeJson(args.raw ?? null),
      createdAt,
      timestamp,
    )
    .run();

  return getVatObligationByIdFromD1(db, { id }).then((record) => {
    if (!record) {
      throw new Error("Failed to upsert VAT obligation");
    }

    return record;
  });
}

export async function listVatObligationsFromD1(db: Database, args: { teamId: string }) {
  const { results = [] } = await requireVatFilingStateD1(db)
    .prepare(
      `select *
       from vat_obligations
       where team_id = ?
       order by period_start asc, created_at asc`,
    )
    .bind(args.teamId)
    .all<VatObligationRow>();

  return results.map(toVatObligationRecord);
}

export async function getVatObligationByIdFromD1(db: Database, args: { id: string }) {
  const row = await requireVatFilingStateD1(db)
    .prepare("select * from vat_obligations where id = ? limit 1")
    .bind(args.id)
    .first<VatObligationRow>();

  return row ? toVatObligationRecord(row) : null;
}

export async function getVatReturnByIdFromD1(db: Database, args: { id: string }) {
  const row = await requireVatFilingStateD1(db)
    .prepare("select * from vat_returns where id = ? limit 1")
    .bind(args.id)
    .first<VatReturnRow>();

  return row ? toVatReturnRecord(row) : null;
}

export async function getVatReturnByObligationIdFromD1(
  db: Database,
  args: {
    teamId: string;
    obligationId: string;
  },
) {
  const row = await requireVatFilingStateD1(db)
    .prepare(
      `select *
       from vat_returns
       where team_id = ? and obligation_id = ?
       limit 1`,
    )
    .bind(args.teamId, args.obligationId)
    .first<VatReturnRow>();

  return row ? toVatReturnRecord(row) : null;
}

export async function getLatestVatReturnFromD1(db: Database, args: { teamId: string }) {
  const row = await requireVatFilingStateD1(db)
    .prepare(
      `select *
       from vat_returns
       where team_id = ?
       order by updated_at desc
       limit 1`,
    )
    .bind(args.teamId)
    .first<VatReturnRow>();

  return row ? toVatReturnRecord(row) : null;
}

export async function upsertVatReturnInD1(
  db: Database,
  args: {
    id?: string;
    teamId: string;
    filingProfileId: string;
    obligationId?: string | null;
    periodKey: string;
    periodStart: string;
    periodEnd: string;
    status: VatReturnRecord["status"];
    currency: string;
    netVatDue: number;
    submittedAt?: string | null;
    externalSubmissionId?: string | null;
    declarationAccepted?: boolean | null;
    lines: Array<{
      code: string;
      label: string;
      amount: number;
      meta?: unknown;
    }>;
  },
) {
  const d1 = requireVatFilingStateD1(db);
  const existing =
    (args.id
      ? await d1
          .prepare("select * from vat_returns where id = ? limit 1")
          .bind(args.id)
          .first<VatReturnRow>()
      : null) ?? (await getVatReturnByNaturalKey(d1, args));
  const timestamp = new Date().toISOString();
  const id = existing?.id ?? args.id ?? crypto.randomUUID();
  const createdAt = existing?.created_at ?? timestamp;
  const declarationAccepted =
    args.declarationAccepted ?? (existing ? toBoolean(existing.declaration_accepted) : false);

  await d1
    .prepare(
      `insert into vat_returns (
        id,
        team_id,
        filing_profile_id,
        obligation_id,
        period_key,
        period_start,
        period_end,
        status,
        currency,
        net_vat_due,
        submitted_at,
        external_submission_id,
        declaration_accepted,
        lines_json,
        created_at,
        updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(id) do update set
        team_id = excluded.team_id,
        filing_profile_id = excluded.filing_profile_id,
        obligation_id = excluded.obligation_id,
        period_key = excluded.period_key,
        period_start = excluded.period_start,
        period_end = excluded.period_end,
        status = excluded.status,
        currency = excluded.currency,
        net_vat_due = excluded.net_vat_due,
        submitted_at = excluded.submitted_at,
        external_submission_id = excluded.external_submission_id,
        declaration_accepted = excluded.declaration_accepted,
        lines_json = excluded.lines_json,
        updated_at = excluded.updated_at`,
    )
    .bind(
      id,
      args.teamId,
      args.filingProfileId,
      args.obligationId ?? null,
      args.periodKey,
      args.periodStart,
      args.periodEnd,
      args.status,
      args.currency,
      args.netVatDue,
      args.submittedAt ?? existing?.submitted_at ?? null,
      args.externalSubmissionId ?? existing?.external_submission_id ?? null,
      declarationAccepted ? 1 : 0,
      serializeRequiredJson(normalizeVatReturnLines(args.lines)),
      createdAt,
      timestamp,
    )
    .run();

  return getVatReturnByIdFromD1(db, { id }).then((record) => {
    if (!record) {
      throw new Error("Failed to upsert VAT return");
    }

    return record;
  });
}

export async function markVatReturnAcceptedInD1(
  db: Database,
  args: {
    vatReturnId: string;
    submittedAt: string;
    externalSubmissionId?: string | null;
  },
) {
  const timestamp = new Date().toISOString();

  await requireVatFilingStateD1(db)
    .prepare(
      `update vat_returns
       set status = 'accepted',
           submitted_at = ?,
           external_submission_id = ?,
           declaration_accepted = 1,
           updated_at = ?
       where id = ?`,
    )
    .bind(args.submittedAt, args.externalSubmissionId ?? null, timestamp, args.vatReturnId)
    .run();

  const record = await getVatReturnByIdFromD1(db, { id: args.vatReturnId });

  if (!record) {
    throw new Error("VAT return not found");
  }

  return record;
}

export async function listVatSubmissionsFromD1(db: Database, args: { teamId: string }) {
  const { results = [] } = await requireVatFilingStateD1(db)
    .prepare(
      `select *
       from vat_returns
       where team_id = ?
       order by updated_at desc`,
    )
    .bind(args.teamId)
    .all<VatReturnRow>();

  return results.map(toVatReturnRecord);
}

export async function listComplianceAdjustmentsForPeriodFromD1(
  db: Database,
  args: {
    teamId: string;
    filingProfileId: string;
    periodStart: string;
    periodEnd: string;
  },
) {
  const { results = [] } = await requireVatFilingStateD1(db)
    .prepare(
      `select *
       from vat_compliance_adjustments
       where team_id = ?
         and filing_profile_id = ?
         and effective_date >= ?
         and effective_date <= ?
       order by effective_date asc, created_at asc`,
    )
    .bind(args.teamId, args.filingProfileId, args.periodStart, args.periodEnd)
    .all<ComplianceAdjustmentRow>();

  return results.map(toComplianceAdjustmentRecord);
}

export async function countComplianceAdjustmentsByVatReturnIdFromD1(
  db: Database,
  args: {
    teamId: string;
    vatReturnId: string;
  },
) {
  const row = await requireVatFilingStateD1(db)
    .prepare(
      `select count(*) as count
       from vat_compliance_adjustments
       where team_id = ? and vat_return_id = ?`,
    )
    .bind(args.teamId, args.vatReturnId)
    .first<{ count: number }>();

  return row?.count ?? 0;
}

export async function createComplianceAdjustmentInD1(
  db: Database,
  args: {
    id?: string;
    teamId: string;
    filingProfileId: string;
    vatReturnId?: string | null;
    obligationId?: string | null;
    effectiveDate: string;
    lineCode: ComplianceAdjustmentLineCode;
    amount: number;
    reason: string;
    note?: string | null;
    createdBy?: VatFilingActorId | null;
    meta?: Record<string, unknown> | null;
  },
) {
  const timestamp = new Date().toISOString();
  const id = args.id ?? crypto.randomUUID();

  await requireVatFilingStateD1(db)
    .prepare(
      `insert into vat_compliance_adjustments (
        id,
        team_id,
        filing_profile_id,
        vat_return_id,
        obligation_id,
        effective_date,
        line_code,
        amount,
        reason,
        note,
        created_by,
        meta_json,
        created_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      args.teamId,
      args.filingProfileId,
      args.vatReturnId ?? null,
      args.obligationId ?? null,
      args.effectiveDate,
      args.lineCode,
      args.amount,
      args.reason,
      args.note ?? null,
      args.createdBy ?? null,
      serializeJson(args.meta ?? null),
      timestamp,
    )
    .run();

  const record = await requireVatFilingStateD1(db)
    .prepare("select * from vat_compliance_adjustments where id = ? limit 1")
    .bind(id)
    .first<ComplianceAdjustmentRow>();

  if (!record) {
    throw new Error("Failed to create compliance adjustment");
  }

  return toComplianceAdjustmentRecord(record);
}

export async function upsertEvidencePackInD1(
  db: Database,
  args: {
    teamId: string;
    id?: string;
    filingProfileId: string;
    vatReturnId: string;
    checksum: string;
    payload: Record<string, unknown>;
    createdBy?: VatFilingActorId | null;
  },
) {
  const d1 = requireVatFilingStateD1(db);
  const existing = await d1
    .prepare(
      `select *
       from vat_evidence_packs
       where team_id = ? and vat_return_id = ?
       limit 1`,
    )
    .bind(args.teamId, args.vatReturnId)
    .first<EvidencePackRow>();
  const timestamp = new Date().toISOString();
  const id = existing?.id ?? args.id ?? crypto.randomUUID();
  const createdAt = existing?.created_at ?? timestamp;

  await d1
    .prepare(
      `insert into vat_evidence_packs (
        id,
        team_id,
        filing_profile_id,
        vat_return_id,
        checksum,
        payload_json,
        created_by,
        created_at,
        updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(id) do update set
        team_id = excluded.team_id,
        filing_profile_id = excluded.filing_profile_id,
        vat_return_id = excluded.vat_return_id,
        checksum = excluded.checksum,
        payload_json = excluded.payload_json,
        created_by = excluded.created_by,
        updated_at = excluded.updated_at`,
    )
    .bind(
      id,
      args.teamId,
      args.filingProfileId,
      args.vatReturnId,
      args.checksum,
      serializeRequiredJson(args.payload),
      args.createdBy ?? null,
      createdAt,
      timestamp,
    )
    .run();

  const record = await getEvidencePackByIdFromD1(db, {
    teamId: args.teamId,
    id,
  });

  if (!record) {
    throw new Error("Failed to upsert evidence pack");
  }

  return record;
}

export async function getEvidencePackByIdFromD1(
  db: Database,
  args: {
    teamId: string;
    id: string;
  },
) {
  const row = await requireVatFilingStateD1(db)
    .prepare(
      `select *
       from vat_evidence_packs
       where team_id = ? and id = ?
       limit 1`,
    )
    .bind(args.teamId, args.id)
    .first<EvidencePackRow>();

  return row ? toEvidencePackRecord(row) : null;
}
