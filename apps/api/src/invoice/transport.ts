import type { Session } from "@tamias/auth-session";
import { cancelRun, enqueue } from "@tamias/job-client";

type InvoiceTransportLogger = {
  error: (message: string, payload?: Record<string, unknown>) => void;
};

export function requireSessionConvexUserId(
  session: Session,
  onMissing: () => never,
) {
  if (!session.user.convexId) {
    return onMissing();
  }

  return session.user.convexId;
}

export function assertScheduledAtInFuture(
  scheduledAt: string,
  onInvalid: () => never,
) {
  const scheduledDate = new Date(scheduledAt);
  const now = new Date();

  if (scheduledDate <= now) {
    return onInvalid();
  }

  return {
    scheduledDate,
    now,
    delayMs: scheduledDate.getTime() - now.getTime(),
  };
}

export async function createScheduledInvoiceJob(
  invoiceId: string,
  delayMs: number,
) {
  const scheduledRun = await enqueue(
    "schedule-invoice",
    {
      invoiceId,
    },
    "invoices",
    {
      delay: delayMs,
    },
  );

  if (!scheduledRun?.runId) {
    throw new Error("Failed to create scheduled job - no run ID returned");
  }

  return scheduledRun.runId;
}

export async function removeInvoiceJob(
  scheduledJobId: string,
  options?: {
    logFailureMessage?: string;
    logger?: InvoiceTransportLogger;
  },
) {
  const removed = await cancelRun(scheduledJobId).catch((error) => {
    if (options?.logFailureMessage && options.logger) {
      options.logger.error(options.logFailureMessage, {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }

    throw error;
  });

  if (removed || !options?.logFailureMessage || !options.logger) {
    return;
  }

  options.logger.error(options.logFailureMessage, {
    error: "Scheduled invoice run not found",
  });
}

export async function enqueueInvoiceGeneration(args: {
  invoiceId: string;
  deliveryType: "create" | "create_and_send" | "scheduled";
}) {
  await enqueue(
    "generate-invoice",
    {
      invoiceId: args.invoiceId,
      deliveryType: args.deliveryType,
    },
    "invoices",
  );
}

export function enqueueInvoiceScheduledNotification(args: {
  teamId: string;
  invoiceId: string;
  invoiceNumber: string;
  scheduledAt: string;
  customerName?: string;
}) {
  return enqueue(
    "notification",
    {
      type: "invoice_scheduled",
      teamId: args.teamId,
      invoiceId: args.invoiceId,
      invoiceNumber: args.invoiceNumber,
      scheduledAt: args.scheduledAt,
      customerName: args.customerName,
    },
    "notifications",
  ).catch(() => {});
}
