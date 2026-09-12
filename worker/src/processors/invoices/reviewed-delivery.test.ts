import { describe, expect, test } from "bun:test";
import { requireAcceptedInvoiceEmail, runReviewedDelivery } from "./reviewed-delivery";

describe("reviewed invoice email delivery", () => {
  test("does not mark failed or skipped email notifications as sent", () => {
    expect(() => requireAcceptedInvoiceEmail({ sent: 1, failed: 0 })).not.toThrow();
    expect(() => requireAcceptedInvoiceEmail({ sent: 0, failed: 1 })).toThrow();
    expect(() => requireAcceptedInvoiceEmail({ sent: 0 })).toThrow();
  });

  test("completed queue redelivery does not send again", async () => {
    let sends = 0;
    await runReviewedDelivery(
      {
        claim: async () => ({ state: "replayed" }),
        complete: async () => {
          throw new Error("unexpected completion");
        },
        reconcile: async () => {
          throw new Error("unexpected reconciliation");
        },
      },
      async () => {
        sends++;
      },
    );
    expect(sends).toBe(0);
  });

  test("expired claims stop for reconciliation without sending", async () => {
    let sends = 0;
    let reconciled = false;
    await expect(
      runReviewedDelivery(
        {
          claim: async () => ({ state: "started", attemptCount: 2, leaseToken: "fixture" }),
          complete: async () => {},
          reconcile: async () => {
            reconciled = true;
          },
        },
        async () => {
          sends++;
        },
      ),
    ).rejects.toThrow("reconciliation");
    expect(sends).toBe(0);
    expect(reconciled).toBe(true);
  });

  test("records only a successful accepted delivery", async () => {
    const events: string[] = [];
    await runReviewedDelivery(
      {
        claim: async () => ({ state: "started", attemptCount: 1, leaseToken: "fixture" }),
        complete: async () => {
          events.push("complete");
        },
        reconcile: async () => {
          events.push("reconcile");
        },
      },
      async () => {
        events.push("send");
      },
    );
    expect(events).toEqual(["send", "complete"]);
  });

  test("an uncertain provider response or persistence failure is never silently retried", async () => {
    for (const failure of ["provider", "persistence"]) {
      let reconciled = false;
      await expect(
        runReviewedDelivery(
          {
            claim: async () => ({ state: "started", attemptCount: 1, leaseToken: "fixture" }),
            complete: async () => {
              if (failure === "persistence") throw new Error("D1 disconnected");
            },
            reconcile: async () => {
              reconciled = true;
            },
          },
          async () => {
            if (failure === "provider") throw new Error("Response interrupted");
          },
        ),
      ).rejects.toThrow("reconciliation");
      expect(reconciled).toBe(true);
    }
  });
});
