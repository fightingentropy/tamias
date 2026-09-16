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

  it("reads both migration sections and excludes pending and reverted authorisations", () => {
    const second = [
      "GBP Statement Revolut Bank UK Ltd Balance summary",
      "Total £114.50 £20.00 £30.00 £124.50",
      "Pending from February 1, 2026 to February 28, 2026",
      "Feb 28, 2026 Pending Shop £7.00",
      "Account transactions from February 1, 2026 to February 28, 2026",
      "Date Description Money out Money in Balance",
      "Feb 2, 2026 Payment from SECOND LTD £30.00 £144.50",
      "Feb 3, 2026 Shop £20.00 £124.50",
      "Reverted from February 1, 2026 to February 28, 2026",
      "Feb 4, 2026 Reverted Shop £9.00",
    ].join("\n");
    const result = extractRevolutStatementFromText(`${sampleStatement}\n${second}`);
    expect(result?.transactions).toHaveLength(6);
    expect(result?.transactions.at(-1)).toMatchObject({
      date: "2026-02-03",
      amount: -20,
      balance: 124.5,
    });
    expect(
      result?.transactions.some(
        (t) => t.description.includes("Pending") || t.description.includes("Reverted"),
      ),
    ).toBe(false);
    expect(
      extractRevolutStatementFromText(
        `${sampleStatement}\n${second.replace("£124.50", "£125.50")}`,
      ),
    ).toBeNull();
    expect(
      extractRevolutStatementFromText(
        `${sampleStatement}\n${second.replace("£114.50", "£115.50")}`,
      ),
    ).toBeNull();
  });

  it("reconciles an incoming exchange using its printed gross credit and fee", () => {
    const statement = [
      "GBP Statement Revolut Ltd Balance summary Total £100.00 £1.20 £50.00 £148.80",
      "Account transactions from March 1, 2026 to March 31, 2026",
      "Date Description Money out Money in Balance",
      "Mar 1, 2026 Exchanged to GBP £48.80 £148.80 Fee: £1.20 £50.00 $60.00",
    ].join(" ");
    const result = extractRevolutStatementFromText(statement);
    expect(result?.transactions).toEqual([
      {
        date: "2026-03-01",
        description: "Exchanged to GBP (before fee)",
        counterparty: null,
        amount: 50,
        balance: null,
      },
      {
        date: "2026-03-01",
        description: "Currency exchange fee",
        counterparty: "Revolut",
        amount: -1.2,
        balance: 148.8,
      },
    ]);
    expect(
      extractRevolutStatementFromText(statement.replace("Fee: £1.20", "Fee: £1.21")),
    ).toBeNull();
  });

  it("rejects a one-penny balance mismatch and mixed-currency statements", () => {
    expect(extractRevolutStatementFromText(sampleStatement.replace("£87.50", "£87.51"))).toBeNull();
    expect(
      extractRevolutStatementFromText(`${sampleStatement} EUR Statement Revolut Bank`),
    ).toBeNull();
  });
});
