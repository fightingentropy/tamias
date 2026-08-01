import type { Database } from "@tamias/app-data/client";
import {
  beginIdempotentOperation,
  completeIdempotentOperation,
  failIdempotentOperation,
  requireIdempotentOperationReconciliation,
} from "@tamias/app-data/queries";

export async function runIdempotentInvoiceMutation<Result>(args: {
  db: Database;
  teamId: string;
  userId: string;
  action: string;
  resourceId: string;
  idempotencyKey: string;
  request: Record<string, unknown>;
  mutate: (controls: {
    markMutationApplied: (reconciliationResult?: unknown) => void;
  }) => Promise<Result>;
}) {
  const scope = `invoice.${args.action}`;
  const operation = await beginIdempotentOperation(args.db, {
    teamId: args.teamId,
    scope,
    idempotencyKey: args.idempotencyKey,
    request: args.request,
  });
  if (operation.state === "replayed") {
    return operation.result as Result;
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
        resourceType: "invoice",
        resourceId: args.resourceId,
        environment: process.env.TAMIAS_ENVIRONMENT ?? "unknown",
        payload: { fields: Object.keys(args.request).sort() },
      },
      outbox: {
        topic: scope,
        aggregateType: "invoice",
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
