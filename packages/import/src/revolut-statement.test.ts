import { describe, expect, it } from "bun:test";
import { extractRevolutStatementFromText } from "./revolut-statement";

const sampleStatement = [
  "GBP Statement Generated on May 13, 2026 Revolut Ltd",
  "Balance summary Product Opening balance Money out Money in Closing balance",
  "Account (E-Money) Where your transactions are remitted £100.00 £40.50 £55.00 £114.50",
  "Total £100.00 £40.50 £55.00 £114.50",
  "Account transactions from January 1, 2026 to January 31, 2026",
  "Date Description Money out Money in Balance",
  "Jan 1, 2026 Coffee Shop £12.50 £87.50 To: Coffee Shop, London Card: 1234",
  "Jan 2, 2026 Payment from ACME LTD £50.00 £137.50 Reference: invoice From: ACME LTD, 00000001",
  "Jan 3, 2026 Refund Shop £5.00 £142.50 From: Refund Shop, London Card: 1234",
  "Jan 4, 2026 To Rent Ltd £28.00 £114.50 Reference: Rent To: Rent Ltd, 12345678",
  "Reverted from January 1, 2026 to January 31, 2026",
  "Start date Description Money out Money in",
  "Jan 5, 2026 Uber £10.00 To: Uber Card: 1234",
].join(" ");

describe("extractRevolutStatementFromText", () => {
  it("extracts posted account transactions and excludes reverted authorisations", () => {
    const result = extractRevolutStatementFromText(sampleStatement);

    expect(result?.detectedCurrency).toBe("GBP");
    expect(result?.transactions).toHaveLength(4);
    expect(result?.transactions.map((transaction) => transaction.amount)).toEqual([
      -12.5, 50, 5, -28,
    ]);
    expect(result?.transactions.at(-1)?.balance).toBe(114.5);
    expect(result?.transactions.some((transaction) => transaction.description === "Uber")).toBe(
      false,
    );
    expect(result?.transactions[1]?.counterparty).toBe("ACME LTD");
  });

  it("returns null when the running balance does not match statement totals", () => {
    const tampered = sampleStatement.replace("£114.50 Reference: Rent", "£115.50 Reference: Rent");

    expect(extractRevolutStatementFromText(tampered)).toBeNull();
  });
});
