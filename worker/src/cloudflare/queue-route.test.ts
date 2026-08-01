import { describe, expect, test } from "bun:test";
import {
  isCaptureConsumerQueue,
  isDeadLetterQueue,
  isLedgerConsumerQueue,
  isOutboxConsumerQueue,
} from "./queue-route";

describe("Cloudflare queue routing", () => {
  test("routes poison queues only to dead-letter persistence", () => {
    expect(isDeadLetterQueue("tamias-capture-dlq")).toBe(true);
    expect(isDeadLetterQueue("tamias-ledger-dlq-local")).toBe(true);
    expect(isCaptureConsumerQueue("tamias-capture-dlq")).toBe(false);
    expect(isLedgerConsumerQueue("tamias-ledger-dlq-local")).toBe(false);
  });

  test("keeps ordinary queues on their domain consumers", () => {
    expect(isCaptureConsumerQueue("tamias-capture")).toBe(true);
    expect(isLedgerConsumerQueue("tamias-ledger-local")).toBe(true);
    expect(isDeadLetterQueue("tamias-ledger")).toBe(false);
    expect(isOutboxConsumerQueue("tamias-outbox")).toBe(true);
    expect(isOutboxConsumerQueue("tamias-outbox-dlq")).toBe(false);
  });
});
