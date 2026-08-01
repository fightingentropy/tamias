import type { Session } from "@tamias/auth-session";
import { DEFAULT_TEMPLATE } from "@tamias/invoice/defaults";
import { createLoggerWithContext } from "@tamias/logger";
import { TRPCError } from "@trpc/server";
import {
  assertScheduledAtInFuture as assertInvoiceScheduledAtInFuture,
  requireSessionUserId,
} from "../../invoice/transport";

export { runIdempotentInvoiceMutation } from "../../invoice/mutation-safety";

export const invoiceLogger = createLoggerWithContext("trpc:invoice");
export const defaultTemplate = DEFAULT_TEMPLATE;

export function requireUserId(session: Session) {
  return requireSessionUserId(session, () => {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Missing user id",
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
