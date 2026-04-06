import type { Session } from "@tamias/auth-session";
import { DEFAULT_TEMPLATE } from "@tamias/invoice";
import { createLoggerWithContext } from "@tamias/logger";
import { TRPCError } from "@trpc/server";
import {
  assertScheduledAtInFuture as assertInvoiceScheduledAtInFuture,
  requireSessionConvexUserId,
} from "../../invoice/transport";

export const invoiceLogger = createLoggerWithContext("trpc:invoice");
export const defaultTemplate = DEFAULT_TEMPLATE;

export function requireConvexUserId(session: Session) {
  return requireSessionConvexUserId(session, () => {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Missing Convex user id",
    });
  });
}

export function assertScheduledAtInFuture(scheduledAt: string) {
  return assertInvoiceScheduledAtInFuture(scheduledAt, () => {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "scheduledAt must be in the future",
    });
  });
}
