import type { Database } from "@tamias/app-data/client";
import {
  beginIdempotentOperation,
  completeIdempotentOperation,
  failIdempotentOperation,
  requireIdempotentOperationReconciliation,
} from "@tamias/app-data/queries";

export class IdempotentMutationConflict extends Error {
  constructor(readonly reason: "in_progress" | "different_request" | "reconciliation_required") {
    const messages = {
      in_progress:
        "This request is still processing. Retry with the same Idempotency-Key after it finishes.",
      different_request:
        "This Idempotency-Key belongs to a different request. Review the existing result before starting another request.",
      reconciliation_required:
        "This request may have been applied and requires reconciliation. Refresh the existing item and contact support before trying again; do not use a new retry key.",
    };
    super(messages[reason]);
    this.name = "IdempotentMutationConflict";
  }
}

function translateIdempotencyError(error: unknown): never {
  if (error instanceof Error) {
    if (error.message === "Idempotency key was already used with a different request")
      throw new IdempotentMutationConflict("different_request");
    if (
      error.message === "An operation with this idempotency key is already in progress" ||
      error.message === "Unable to acquire idempotent operation lease"
    )
      throw new IdempotentMutationConflict("in_progress");
    if (
      error.message ===
      "This operation requires manual reconciliation before it can be attempted again"
    )
      throw new IdempotentMutationConflict("reconciliation_required");
  }
  throw error;
}

export async function runIdempotentMutation<Result>(args: {
  db: Database;
  teamId: string;
  userId: string;
  scope: string;
  resourceType: string;
  resourceId: string;
  idempotencyKey: string;
  request: Record<string, unknown>;
  mutate: (controls: {
    markMutationApplied: (reconciliationResult?: unknown) => void;
  }) => Promise<Result>;
}) {
  const scope = args.scope;
  let operation: Awaited<ReturnType<typeof beginIdempotentOperation>>;
  try {
    operation = await beginIdempotentOperation(args.db, {
      teamId: args.teamId,
      scope,
      idempotencyKey: args.idempotencyKey,
      request: args.request,
    });
  } catch (error) {
    translateIdempotencyError(error);
  }
  if (operation.state === "replayed") {
    return operation.result as Result;
  }
  if ("resumedFrom" in operation && operation.resumedFrom === "expired_lease") {
    await requireIdempotentOperationReconciliation(args.db, {
      teamId: args.teamId,
      scope,
      idempotencyKey: args.idempotencyKey,
      leaseToken: operation.leaseToken,
      error: new Error("Previous attempt expired before its outcome was recorded"),
      providerResult: { resourceId: args.resourceId },
    });
    throw new IdempotentMutationConflict("reconciliation_required");
  }

  let mutationCompleted = false;
  let reconciliationResult: unknown;
  let result: Result | undefined;
  try {
    result = await args.mutate({
      markMutationApplied(value) {
        mutationCompleted = true;
        reconciliationResult = value;
      },
    });
    mutationCompleted = true;
    await completeIdempotentOperation(args.db, {
      teamId: args.teamId,
      scope,
      idempotencyKey: args.idempotencyKey,
      leaseToken: operation.leaseToken,
      result,
      audit: {
        actorType: "user",
        actorId: args.userId,
        action: scope,
        resourceType: args.resourceType,
        resourceId: args.resourceId,
        environment: process.env.TAMIAS_ENVIRONMENT ?? "unknown",
        payload: { fields: Object.keys(args.request).sort() },
      },
      outbox: {
        topic: scope,
        aggregateType: args.resourceType,
        aggregateId: args.resourceId,
        payload: { actorId: args.userId },
      },
    });
    return result;
  } catch (error) {
    if (mutationCompleted) {
      await requireIdempotentOperationReconciliation(args.db, {
        teamId: args.teamId,
        scope,
        idempotencyKey: args.idempotencyKey,
        leaseToken: operation.leaseToken,
        error,
        providerResult: reconciliationResult ?? { resourceId: args.resourceId },
      });
      throw new IdempotentMutationConflict("reconciliation_required");
    } else {
      await failIdempotentOperation(args.db, {
        teamId: args.teamId,
        scope,
        idempotencyKey: args.idempotencyKey,
        leaseToken: operation.leaseToken,
        error,
      });
    }
    throw error;
  }
}
