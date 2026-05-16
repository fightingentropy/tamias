import {
  createDatabase,
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
} from "../client";

export type AsyncRunProvider = "cloudflare-queue" | "cloudflare-workflow" | "cloudflare-schedule";
export type AsyncRunKind = "job" | "workflow" | "schedule";
export type AsyncRunStatus =
  | "waiting"
  | "active"
  | "completed"
  | "failed"
  | "delayed"
  | "canceled"
  | "unknown";

export type AsyncRunRecord = {
  id: string;
  teamId: string | null;
  appUserId: string | null;
  provider: AsyncRunProvider;
  kind: AsyncRunKind;
  providerRunId: string | null;
  providerQueueName: string | null;
  providerJobName: string | null;
  status: AsyncRunStatus;
  progress: number | null;
  progressStep: string | null;
  result: unknown;
  error: string | null;
  metadata: unknown;
  startedAt: string | null;
  completedAt: string | null;
  canceledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateAsyncRunInput = {
  publicRunId?: string;
  publicTeamId?: string;
  appUserId?: string;
  provider: AsyncRunProvider;
  kind: AsyncRunKind;
  providerRunId?: string;
  providerQueueName?: string;
  providerJobName?: string;
  status?: AsyncRunStatus;
  progress?: number;
  progressStep?: string;
  result?: unknown;
  error?: string;
  metadata?: unknown;
  startedAt?: string;
  completedAt?: string;
  canceledAt?: string;
};

export type UpdateAsyncRunInput = {
  runId: string;
  providerRunId?: string;
  providerQueueName?: string;
  providerJobName?: string;
  status?: AsyncRunStatus;
  progress?: number;
  progressStep?: string;
  result?: unknown;
  error?: string;
  metadata?: unknown;
  startedAt?: string;
  completedAt?: string;
  canceledAt?: string;
};

type AsyncRunRow = {
  id: string;
  team_id: string | null;
  app_user_id: string | null;
  provider: AsyncRunProvider;
  kind: AsyncRunKind;
  provider_run_id: string | null;
  provider_queue_name: string | null;
  provider_job_name: string | null;
  status: AsyncRunStatus;
  progress: number | null;
  progress_step: string | null;
  result_json: string | null;
  error: string | null;
  metadata_json: string | null;
  started_at: string | null;
  completed_at: string | null;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
};

function getConfiguredD1() {
  const db = createDatabase();
  return requireCloudflareD1Database(db);
}

function serializeJson(value: unknown) {
  return value === undefined ? null : JSON.stringify(value);
}

function parseJson(value: string | null) {
  if (!value) {
    return null;
  }

  return JSON.parse(value) as unknown;
}

function toAsyncRunRecord(row: AsyncRunRow): AsyncRunRecord {
  return {
    id: row.id,
    teamId: row.team_id,
    appUserId: row.app_user_id,
    provider: row.provider,
    kind: row.kind,
    providerRunId: row.provider_run_id,
    providerQueueName: row.provider_queue_name,
    providerJobName: row.provider_job_name,
    status: row.status,
    progress: row.progress,
    progressStep: row.progress_step,
    result: parseJson(row.result_json),
    error: row.error,
    metadata: parseJson(row.metadata_json),
    startedAt: row.started_at,
    completedAt: row.completed_at,
    canceledAt: row.canceled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getAsyncRunFromD1(d1: CloudflareD1DatabaseBinding, runId: string) {
  const row = await d1
    .prepare("select * from async_runs where id = ? limit 1")
    .bind(runId)
    .first<AsyncRunRow>();

  return row ? toAsyncRunRecord(row) : null;
}

async function getAsyncRunByProviderRunIdFromD1(
  d1: CloudflareD1DatabaseBinding,
  provider: AsyncRunProvider,
  providerRunId: string,
) {
  const row = await d1
    .prepare("select * from async_runs where provider = ? and provider_run_id = ? limit 1")
    .bind(provider, providerRunId)
    .first<AsyncRunRow>();

  return row ? toAsyncRunRecord(row) : null;
}

export async function createAsyncRun(input: CreateAsyncRunInput) {
  const d1 = getConfiguredD1();
  const timestamp = new Date().toISOString();
  const runId = input.publicRunId ?? crypto.randomUUID();
  await d1
    .prepare(
      `insert into async_runs (
        id,
        team_id,
        app_user_id,
        provider,
        kind,
        provider_run_id,
        provider_queue_name,
        provider_job_name,
        status,
        progress,
        progress_step,
        result_json,
        error,
        metadata_json,
        started_at,
        completed_at,
        canceled_at,
        created_at,
        updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      runId,
      input.publicTeamId ?? null,
      input.appUserId ?? null,
      input.provider,
      input.kind,
      input.providerRunId ?? null,
      input.providerQueueName ?? null,
      input.providerJobName ?? null,
      input.status ?? "waiting",
      input.progress ?? null,
      input.progressStep ?? null,
      serializeJson(input.result),
      input.error ?? null,
      serializeJson(input.metadata),
      input.startedAt ?? null,
      input.completedAt ?? null,
      input.canceledAt ?? null,
      timestamp,
      timestamp,
    )
    .run();

  const run = await getAsyncRunFromD1(d1, runId);

  if (!run) {
    throw new Error("Failed to create async run");
  }

  return run;
}

export async function getAsyncRun(runId: string) {
  const d1 = getConfiguredD1();
  return getAsyncRunFromD1(d1, runId);
}

export async function getAsyncRunByProviderRunId(
  provider: AsyncRunProvider,
  providerRunId: string,
) {
  const d1 = getConfiguredD1();
  return getAsyncRunByProviderRunIdFromD1(d1, provider, providerRunId);
}

export async function updateAsyncRun(input: UpdateAsyncRunInput) {
  const d1 = getConfiguredD1();
  const assignments = ["updated_at = ?"];
  const values: unknown[] = [new Date().toISOString()];

  const add = (column: string, value: unknown) => {
    assignments.push(`${column} = ?`);
    values.push(value);
  };

  if (input.providerRunId !== undefined) add("provider_run_id", input.providerRunId);
  if (input.providerQueueName !== undefined) add("provider_queue_name", input.providerQueueName);
  if (input.providerJobName !== undefined) add("provider_job_name", input.providerJobName);
  if (input.status !== undefined) add("status", input.status);
  if (input.progress !== undefined) add("progress", input.progress);
  if (input.progressStep !== undefined) add("progress_step", input.progressStep);
  if (input.result !== undefined) add("result_json", serializeJson(input.result));
  if (input.error !== undefined) add("error", input.error);
  if (input.metadata !== undefined) add("metadata_json", serializeJson(input.metadata));
  if (input.startedAt !== undefined) add("started_at", input.startedAt);
  if (input.completedAt !== undefined) add("completed_at", input.completedAt);
  if (input.canceledAt !== undefined) add("canceled_at", input.canceledAt);

  values.push(input.runId);

  await d1
    .prepare(`update async_runs set ${assignments.join(", ")} where id = ?`)
    .bind(...values)
    .run();

  return getAsyncRunFromD1(d1, input.runId);
}
