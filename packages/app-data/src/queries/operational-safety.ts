import { createHash } from "node:crypto";
import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type CloudflareD1PreparedStatementBinding,
  type Database,
} from "../client";

export type AuditActorType = "user" | "customer" | "service" | "webhook" | "system" | "mcp";

type OperationGuard = {
  teamId: string;
  scope: string;
  idempotencyKey: string;
  leaseToken: string;
};

type IdempotencyRow = {
  request_hash: string;
  status: "pending" | "succeeded" | "failed" | "reconciliation_required";
  result_json: string | null;
  lease_token: string | null;
  lease_expires_at: string | null;
  attempt_count: number;
};

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }
  return value;
}

export function hashOperationRequest(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(stableValue(value)))
    .digest("hex");
}

function validateIdempotencyKey(value: string) {
  const key = value.trim();
  if (key.length < 8 || key.length > 200 || !/^[A-Za-z0-9._:-]+$/.test(key)) {
    throw new Error("Idempotency key must be 8-200 URL-safe characters");
  }
  return key;
}

export async function beginIdempotentOperation(
  db: Database,
  args: {
    teamId: string;
    scope: string;
    idempotencyKey: string;
    request: unknown;
    leaseMilliseconds?: number;
  },
) {
  const d1 = requireCloudflareD1Database(db);
  const idempotencyKey = validateIdempotencyKey(args.idempotencyKey);
  const requestHash = hashOperationRequest(args.request);
  const now = new Date();
  const timestamp = now.toISOString();
  const leaseToken = crypto.randomUUID();
  const leaseExpiresAt = new Date(
    now.getTime() + (args.leaseMilliseconds ?? 300_000),
  ).toISOString();
  const inserted = await d1
    .prepare(
      `insert into operation_idempotency (
        team_id, operation_scope, idempotency_key, request_hash, status,
        attempt_count, lease_token, lease_expires_at, created_at, updated_at
      ) values (?, ?, ?, ?, 'pending', 1, ?, ?, ?, ?)
      on conflict(team_id, operation_scope, idempotency_key) do nothing
      returning status`,
    )
    .bind(
      args.teamId,
      args.scope,
      idempotencyKey,
      requestHash,
      leaseToken,
      leaseExpiresAt,
      timestamp,
      timestamp,
    )
    .first<{ status: string }>();

  if (inserted) {
    return {
      state: "started" as const,
      idempotencyKey,
      requestHash,
      attemptCount: 1,
      leaseToken,
    };
  }

  const existing = await d1
    .prepare(
      `select request_hash, status, result_json, lease_token, lease_expires_at, attempt_count
       from operation_idempotency
       where team_id = ? and operation_scope = ? and idempotency_key = ?`,
    )
    .bind(args.teamId, args.scope, idempotencyKey)
    .first<IdempotencyRow>();
  if (!existing) {
    throw new Error("Idempotency record disappeared during acquisition");
  }
  if (existing.request_hash !== requestHash) {
    throw new Error("Idempotency key was already used with a different request");
  }
  if (existing.status === "succeeded") {
    return {
      state: "replayed" as const,
      idempotencyKey,
      requestHash,
      attemptCount: existing.attempt_count,
      result: existing.result_json ? (JSON.parse(existing.result_json) as unknown) : null,
    };
  }
  if (existing.status === "reconciliation_required") {
    throw new Error(
      "This operation requires manual reconciliation before it can be attempted again",
    );
  }
  if (
    existing.status === "pending" &&
    existing.lease_expires_at &&
    existing.lease_expires_at > timestamp
  ) {
    throw new Error("An operation with this idempotency key is already in progress");
  }

  const reacquired = await d1
    .prepare(
      `update operation_idempotency
       set status = 'pending', error_message = null, attempt_count = attempt_count + 1,
           lease_token = ?, lease_expires_at = ?, updated_at = ?
       where team_id = ? and operation_scope = ? and idempotency_key = ?
         and request_hash = ?
         and (status = 'failed' or lease_expires_at is null or lease_expires_at <= ?)
       returning attempt_count`,
    )
    .bind(
      leaseToken,
      leaseExpiresAt,
      timestamp,
      args.teamId,
      args.scope,
      idempotencyKey,
      requestHash,
      timestamp,
    )
    .first<{ attempt_count: number }>();
  if (!reacquired) {
    throw new Error("Unable to acquire idempotent operation lease");
  }

  return {
    state: "started" as const,
    idempotencyKey,
    requestHash,
    attemptCount: reacquired.attempt_count,
    leaseToken,
  };
}

export function prepareImmutableAuditEvent(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    actorType: AuditActorType;
    actorId: string;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    idempotencyKey?: string | null;
    confirmationId?: string | null;
    environment: string;
    payload?: Record<string, unknown>;
    timestamp?: string;
  },
  operationGuard?: OperationGuard,
) {
  const timestamp = args.timestamp ?? new Date().toISOString();
  const guardClause = operationGuard
    ? `select ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       where exists (
         select 1 from operation_idempotency
         where team_id = ? and operation_scope = ? and idempotency_key = ?
           and status = 'succeeded' and lease_token = ?
       )`
    : "values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
  return d1
    .prepare(
      `insert into immutable_audit_events (
        id, team_id, actor_type, actor_id, action, resource_type, resource_id,
        idempotency_key, confirmation_id, environment, payload_json, created_at
      ) ${guardClause}`,
    )
    .bind(
      crypto.randomUUID(),
      args.teamId,
      args.actorType,
      args.actorId,
      args.action,
      args.resourceType,
      args.resourceId ?? null,
      args.idempotencyKey ?? null,
      args.confirmationId ?? null,
      args.environment,
      JSON.stringify(args.payload ?? {}),
      timestamp,
      ...(operationGuard
        ? [
            operationGuard.teamId,
            operationGuard.scope,
            validateIdempotencyKey(operationGuard.idempotencyKey),
            operationGuard.leaseToken,
          ]
        : []),
    );
}

export async function recordImmutableAuditEvent(
  db: Database,
  args: Parameters<typeof prepareImmutableAuditEvent>[1],
) {
  await prepareImmutableAuditEvent(requireCloudflareD1Database(db), args).run();
}

export function prepareOutboxEvent(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    topic: string;
    aggregateType: string;
    aggregateId: string;
    idempotencyKey: string;
    payload: Record<string, unknown>;
    timestamp?: string;
  },
  operationGuard?: OperationGuard,
) {
  const timestamp = args.timestamp ?? new Date().toISOString();
  const guardClause = operationGuard
    ? `select ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?
       where exists (
         select 1 from operation_idempotency
         where team_id = ? and operation_scope = ? and idempotency_key = ?
           and status = 'succeeded' and lease_token = ?
       )`
    : "values (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)";
  return d1
    .prepare(
      `insert into transactional_outbox (
        id, team_id, topic, aggregate_type, aggregate_id, idempotency_key,
        payload_json, attempt_count, available_at, created_at, updated_at
      ) ${guardClause}
      on conflict(team_id, topic, idempotency_key) do nothing`,
    )
    .bind(
      crypto.randomUUID(),
      args.teamId,
      args.topic,
      args.aggregateType,
      args.aggregateId,
      validateIdempotencyKey(args.idempotencyKey),
      JSON.stringify(args.payload),
      timestamp,
      timestamp,
      timestamp,
      ...(operationGuard
        ? [
            operationGuard.teamId,
            operationGuard.scope,
            validateIdempotencyKey(operationGuard.idempotencyKey),
            operationGuard.leaseToken,
          ]
        : []),
    );
}

export async function completeIdempotentOperation(
  db: Database,
  args: {
    teamId: string;
    scope: string;
    idempotencyKey: string;
    leaseToken: string;
    result: unknown;
    audit: Omit<Parameters<typeof prepareImmutableAuditEvent>[1], "teamId" | "idempotencyKey">;
    outbox?: Omit<Parameters<typeof prepareOutboxEvent>[1], "teamId" | "idempotencyKey">;
  },
) {
  const d1 = requireCloudflareD1Database(db);
  const timestamp = new Date().toISOString();
  const operationGuard = {
    teamId: args.teamId,
    scope: args.scope,
    idempotencyKey: args.idempotencyKey,
    leaseToken: args.leaseToken,
  };
  const statements: CloudflareD1PreparedStatementBinding[] = [
    d1
      .prepare(
        `update operation_idempotency
         set status = 'succeeded', result_json = ?, error_message = null,
             lease_expires_at = null, updated_at = ?
         where team_id = ? and operation_scope = ? and idempotency_key = ?
           and status = 'pending' and lease_token = ?`,
      )
      .bind(
        JSON.stringify(args.result),
        timestamp,
        args.teamId,
        args.scope,
        validateIdempotencyKey(args.idempotencyKey),
        args.leaseToken,
      ),
    prepareImmutableAuditEvent(
      d1,
      {
        ...args.audit,
        teamId: args.teamId,
        idempotencyKey: args.idempotencyKey,
        timestamp,
      },
      operationGuard,
    ),
  ];
  if (args.outbox) {
    statements.push(
      prepareOutboxEvent(
        d1,
        {
          ...args.outbox,
          teamId: args.teamId,
          idempotencyKey: args.idempotencyKey,
          timestamp,
        },
        operationGuard,
      ),
    );
  }

  await d1.batch(statements);
  const completed = await d1
    .prepare(
      `select 1 as completed from operation_idempotency
       where team_id = ? and operation_scope = ? and idempotency_key = ?
         and status = 'succeeded' and lease_token = ?`,
    )
    .bind(args.teamId, args.scope, validateIdempotencyKey(args.idempotencyKey), args.leaseToken)
    .first<{ completed: number }>();
  if (!completed) {
    throw new Error("Idempotent operation lease was lost before completion");
  }
}

export async function failIdempotentOperation(
  db: Database,
  args: {
    teamId: string;
    scope: string;
    idempotencyKey: string;
    leaseToken: string;
    error: unknown;
  },
) {
  const failed = await requireCloudflareD1Database(db)
    .prepare(
      `update operation_idempotency
       set status = 'failed', error_message = ?, lease_expires_at = null, updated_at = ?
       where team_id = ? and operation_scope = ? and idempotency_key = ?
         and status = 'pending' and lease_token = ?
       returning status`,
    )
    .bind(
      args.error instanceof Error ? args.error.message : String(args.error),
      new Date().toISOString(),
      args.teamId,
      args.scope,
      validateIdempotencyKey(args.idempotencyKey),
      args.leaseToken,
    )
    .first<{ status: "failed" }>();
  if (!failed) {
    throw new Error("Idempotent operation lease was lost before failure could be recorded");
  }
}

export async function requireIdempotentOperationReconciliation(
  db: Database,
  args: {
    teamId: string;
    scope: string;
    idempotencyKey: string;
    leaseToken: string;
    error: unknown;
    providerResult?: unknown;
  },
) {
  const reconciliation = await requireCloudflareD1Database(db)
    .prepare(
      `update operation_idempotency
       set status = 'reconciliation_required', result_json = ?, error_message = ?,
           lease_expires_at = null, updated_at = ?
       where team_id = ? and operation_scope = ? and idempotency_key = ?
         and status = 'pending' and lease_token = ?
       returning status`,
    )
    .bind(
      args.providerResult === undefined ? null : JSON.stringify(args.providerResult),
      args.error instanceof Error ? args.error.message : String(args.error),
      new Date().toISOString(),
      args.teamId,
      args.scope,
      validateIdempotencyKey(args.idempotencyKey),
      args.leaseToken,
    )
    .first<{ status: "reconciliation_required" }>();
  if (!reconciliation) {
    throw new Error("Idempotent operation lease was lost before reconciliation was recorded");
  }
}

export async function recordDeadLetterMessage(
  db: Database,
  args: {
    queueName: string;
    messageId: string;
    teamId?: string | null;
    body: unknown;
    failureReason: string;
    deliveryAttempts: number;
  },
) {
  await requireCloudflareD1Database(db)
    .prepare(
      `insert into dead_letter_messages (
        id, queue_name, message_id, team_id, body_json, failure_reason,
        delivery_attempts, created_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(queue_name, message_id) do nothing`,
    )
    .bind(
      crypto.randomUUID(),
      args.queueName,
      args.messageId,
      args.teamId ?? null,
      JSON.stringify(args.body),
      args.failureReason,
      args.deliveryAttempts,
      new Date().toISOString(),
    )
    .run();
}

export type PendingOutboxEvent = {
  id: string;
  teamId: string;
  topic: string;
  aggregateType: string;
  aggregateId: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  attemptCount: number;
};

export async function listPendingOutboxEvents(db: Database, limit = 100) {
  const boundedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  const { results = [] } = await requireCloudflareD1Database(db)
    .prepare(
      `select id, team_id, topic, aggregate_type, aggregate_id, idempotency_key,
              payload_json, attempt_count
       from transactional_outbox
       where published_at is null and available_at <= ?
       order by created_at asc
       limit ?`,
    )
    .bind(new Date().toISOString(), boundedLimit)
    .all<{
      id: string;
      team_id: string;
      topic: string;
      aggregate_type: string;
      aggregate_id: string;
      idempotency_key: string;
      payload_json: string;
      attempt_count: number;
    }>();

  return results.map(
    (row): PendingOutboxEvent => ({
      id: row.id,
      teamId: row.team_id,
      topic: row.topic,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      idempotencyKey: row.idempotency_key,
      payload: JSON.parse(row.payload_json) as Record<string, unknown>,
      attemptCount: row.attempt_count,
    }),
  );
}

export async function markOutboxEventPublished(db: Database, eventId: string) {
  const timestamp = new Date().toISOString();
  await requireCloudflareD1Database(db)
    .prepare(
      `update transactional_outbox
       set published_at = ?, updated_at = ?, last_error = null
       where id = ? and published_at is null`,
    )
    .bind(timestamp, timestamp, eventId)
    .run();
}

export async function markOutboxEventFailed(db: Database, eventId: string, error: unknown) {
  const now = new Date();
  await requireCloudflareD1Database(db)
    .prepare(
      `update transactional_outbox
       set attempt_count = attempt_count + 1, last_error = ?, available_at = ?, updated_at = ?
       where id = ? and published_at is null`,
    )
    .bind(
      error instanceof Error ? error.message : String(error),
      new Date(now.getTime() + 300_000).toISOString(),
      now.toISOString(),
      eventId,
    )
    .run();
}
