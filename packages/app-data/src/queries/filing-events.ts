import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "../client";

export type SubmissionEventRecord = {
  id: string;
  teamId: string;
  filingProfileId: string;
  provider: string;
  obligationType: string;
  vatReturnId: string | null;
  status: string;
  eventType: string;
  correlationId: string | null;
  requestPayload?: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
  errorMessage: string | null;
  createdAt: string;
};

type SubmissionEventRow = {
  id: string;
  team_id: string;
  filing_profile_id: string;
  provider: string;
  obligation_type: string;
  vat_return_id: string | null;
  status: string;
  event_type: string;
  correlation_id: string | null;
  request_payload_json: string | null;
  response_payload_json: string | null;
  error_message: string | null;
  created_at: string;
};

function getFilingEventsD1(db: Database) {
  return requireCloudflareD1Database(db);
}

function parsePayload(value: string | null) {
  if (!value) {
    return undefined;
  }

  return JSON.parse(value) as Record<string, unknown>;
}

function serializePayload(value: Record<string, unknown> | undefined) {
  return value === undefined ? null : JSON.stringify(value);
}

function toSubmissionEvent(row: SubmissionEventRow): SubmissionEventRecord {
  return {
    id: row.id,
    teamId: row.team_id,
    filingProfileId: row.filing_profile_id,
    provider: row.provider,
    obligationType: row.obligation_type,
    vatReturnId: row.vat_return_id,
    status: row.status,
    eventType: row.event_type,
    correlationId: row.correlation_id,
    requestPayload: parsePayload(row.request_payload_json),
    responsePayload: parsePayload(row.response_payload_json),
    errorMessage: row.error_message,
    createdAt: row.created_at,
  };
}

export async function allocateFilingSequence(db: Database, args: { scope: string }) {
  const scope = args.scope.trim();

  if (!scope) {
    throw new Error("Filing sequence scope is required");
  }

  const timestamp = new Date().toISOString();
  const row = await getFilingEventsD1(db)
    .prepare(
      `insert into filing_sequences (
        scope,
        next_value,
        created_at,
        updated_at
      ) values (?, 2, ?, ?)
      on conflict(scope) do update set
        next_value = filing_sequences.next_value + 1,
        updated_at = excluded.updated_at
      returning next_value - 1 as sequence`,
    )
    .bind(scope, timestamp, timestamp)
    .first<{ sequence: number }>();

  if (!row) {
    throw new Error("Failed to allocate filing sequence");
  }

  return row.sequence;
}

export async function createSubmissionEvent(
  db: Database,
  args: {
    teamId: string;
    filingProfileId: string;
    provider: string;
    obligationType: string;
    vatReturnId?: string | null;
    status: string;
    eventType: string;
    correlationId?: string | null;
    requestPayload?: Record<string, unknown>;
    responsePayload?: Record<string, unknown>;
    errorMessage?: string | null;
  },
) {
  const timestamp = new Date().toISOString();
  const id = crypto.randomUUID();

  await getFilingEventsD1(db)
    .prepare(
      `insert into submission_events (
        id,
        team_id,
        filing_profile_id,
        provider,
        obligation_type,
        vat_return_id,
        status,
        event_type,
        correlation_id,
        request_payload_json,
        response_payload_json,
        error_message,
        created_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      args.teamId,
      args.filingProfileId,
      args.provider,
      args.obligationType,
      args.vatReturnId ?? null,
      args.status,
      args.eventType,
      args.correlationId ?? null,
      serializePayload(args.requestPayload),
      serializePayload(args.responsePayload),
      args.errorMessage ?? null,
      timestamp,
    )
    .run();

  return {
    id,
    teamId: args.teamId,
    filingProfileId: args.filingProfileId,
    provider: args.provider,
    obligationType: args.obligationType,
    vatReturnId: args.vatReturnId ?? null,
    status: args.status,
    eventType: args.eventType,
    correlationId: args.correlationId ?? null,
    requestPayload: args.requestPayload,
    responsePayload: args.responsePayload,
    errorMessage: args.errorMessage ?? null,
    createdAt: timestamp,
  } satisfies SubmissionEventRecord;
}

export async function listSubmissionEvents(
  db: Database,
  args: {
    teamId: string;
    provider?: string;
    obligationType?: string;
  },
) {
  const filters = ["team_id = ?"];
  const values: unknown[] = [args.teamId];

  if (args.provider) {
    filters.push("provider = ?");
    values.push(args.provider);
  }

  if (args.obligationType) {
    filters.push("obligation_type = ?");
    values.push(args.obligationType);
  }

  const { results = [] } = await getFilingEventsD1(db)
    .prepare(
      `select
        id,
        team_id,
        filing_profile_id,
        provider,
        obligation_type,
        vat_return_id,
        status,
        event_type,
        correlation_id,
        request_payload_json,
        response_payload_json,
        error_message,
        created_at
      from submission_events
      where ${filters.join(" and ")}
      order by created_at desc`,
    )
    .bind(...values)
    .all<SubmissionEventRow>();

  return results.map(toSubmissionEvent);
}
