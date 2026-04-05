import {
  createActivityInConvex,
  type CurrentUserIdentityRecord,
} from "../convex";
import type { DatabaseOrTransaction } from "../client";

export type InvoiceActivityType =
  | "invoice_paid"
  | "invoice_cancelled"
  | "invoice_duplicated";

type ConvexUserId = CurrentUserIdentityRecord["convexId"];

export function logActivity(options: {
  db: DatabaseOrTransaction;
  teamId: string;
  userId: ConvexUserId;
  type: InvoiceActivityType;
  metadata: Record<string, any>;
  priority?: number;
  source?: "user" | "system";
}) {
  createActivityInConvex({
    teamId: options.teamId,
    userId: options.userId,
    type: options.type,
    source: options.source ?? "user",
    status: "read",
    priority: options.priority ?? 7,
    metadata: options.metadata,
  }).catch((error) => {
    console.warn("Activity logging failed", {
      error,
      teamId: options.teamId,
      type: options.type,
    });
  });
}
