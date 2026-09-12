import { NonRetryableError } from "../../utils/error-classification";

type StartedDelivery = { state: "started"; attemptCount: number; leaseToken: string };
type DeliveryClaim = StartedDelivery | { state: "replayed" };

export function requireAcceptedInvoiceEmail(emails: { sent: number; failed?: number }) {
  if (emails.sent !== 1 || (emails.failed ?? 0) !== 0) {
    throw new Error("Invoice email was not confirmed as accepted by the mail service");
  }
}

/** An expired or ambiguous send needs reconciliation, never an automatic second email. */
export async function runReviewedDelivery(
  operations: {
    claim: () => Promise<DeliveryClaim>;
    complete: (claim: StartedDelivery) => Promise<void>;
    reconcile: (claim: StartedDelivery, error: unknown) => Promise<void>;
  },
  deliver: () => Promise<void>,
) {
  const claim = await operations.claim();
  if (claim.state === "replayed") return;
  if (claim.attemptCount > 1) {
    const error = new NonRetryableError(
      "Invoice email needs reconciliation before another delivery attempt",
    );
    await operations.reconcile(claim, error);
    throw error;
  }
  try {
    await deliver();
    await operations.complete(claim);
  } catch (error) {
    await operations.reconcile(claim, error);
    throw new NonRetryableError(
      "Invoice email outcome needs reconciliation before another delivery attempt",
      error,
    );
  }
}
