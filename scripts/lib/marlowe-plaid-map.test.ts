import { describe, expect, test } from "bun:test";
import {
  buildMarlowePlaidUpsert,
  normalizeBankingMethodForConvex,
  stablePlaidTransactionPublicId,
} from "./marlowe-plaid-map";
import type { Transaction } from "../../packages/banking/src/types";

describe("normalizeBankingMethodForConvex", () => {
  test("passes through known methods", () => {
    expect(normalizeBankingMethodForConvex("card_purchase")).toBe("card_purchase");
    expect(normalizeBankingMethodForConvex("payment")).toBe("payment");
  });

  test("maps unknown to other", () => {
    expect(normalizeBankingMethodForConvex("weird")).toBe("other");
  });
});

describe("stablePlaidTransactionPublicId", () => {
  test("is deterministic", () => {
    expect(stablePlaidTransactionPublicId("team-1", "txn-a")).toBe(
      stablePlaidTransactionPublicId("team-1", "txn-a"),
    );
    expect(stablePlaidTransactionPublicId("team-1", "txn-a")).not.toBe(
      stablePlaidTransactionPublicId("team-1", "txn-b"),
    );
  });
});

describe("buildMarlowePlaidUpsert", () => {
  test("builds Convex payload from provider transaction", () => {
    const transaction = {
      id: "plaid-txn-1",
      date: "2026-03-15",
      name: "Coffee Shop",
      method: "purchase",
      amount: -450,
      currency: "GBP",
      status: "posted" as const,
      balance: null,
      category: null,
      counterparty_name: null,
      merchant_name: "Coffee Shop",
      description: null,
      currency_rate: null,
      currency_source: null,
    } satisfies Transaction;

    const row = buildMarlowePlaidUpsert({
      transaction,
      teamId: "pub-team",
      bankAccountPublicId: "pub-bank-acct",
      createdAt: "2026-03-15T12:00:00.000Z",
    });

    expect(row.internalId).toBe("pub-team_plaid-txn-1");
    expect(row.bankAccountId).toBe("pub-bank-acct");
    expect(row.method).toBe("other");
    expect(row.merchantName).toBe("Coffee Shop");
  });
});
