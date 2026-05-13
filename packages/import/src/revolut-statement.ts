import type { ExtractedPdfStatement } from "./pdf-extraction";

const DATE_PATTERN = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, \d{4} /g;
const TABLE_HEADER = "Date Description Money out Money in Balance";

const MONTHS: Record<string, string> = {
  Jan: "01",
  Feb: "02",
  Mar: "03",
  Apr: "04",
  May: "05",
  Jun: "06",
  Jul: "07",
  Aug: "08",
  Sep: "09",
  Oct: "10",
  Nov: "11",
  Dec: "12",
};

type ParsedSummary = {
  openingBalance: number;
  moneyOut: number;
  moneyIn: number;
  closingBalance: number;
};

function parseMoney(value: string): number {
  return Number(value.replace(/,/g, ""));
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.011;
}

function parseStatementDate(value: string): string | null {
  const match = value.match(/^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})$/);
  if (!match) return null;

  const [, month, day, year] = match;
  if (!month || !day || !year) return null;

  const monthNumber = MONTHS[month];
  if (!monthNumber) return null;

  return `${year}-${monthNumber}-${day.padStart(2, "0")}`;
}

function parseSummary(text: string): ParsedSummary | null {
  const match = text.match(
    /Total\s+£([\d,]+\.\d{2})\s+£([\d,]+\.\d{2})\s+£([\d,]+\.\d{2})\s+£([\d,]+\.\d{2})/,
  );

  if (!match) return null;

  const [, openingBalance, moneyOut, moneyIn, closingBalance] = match;
  if (!openingBalance || !moneyOut || !moneyIn || !closingBalance) return null;

  return {
    openingBalance: parseMoney(openingBalance),
    moneyOut: parseMoney(moneyOut),
    moneyIn: parseMoney(moneyIn),
    closingBalance: parseMoney(closingBalance),
  };
}

function detectCurrency(text: string): string | null {
  const match = text.match(/\b([A-Z]{3}) Statement\b/);
  return match?.[1] ?? null;
}

function parseCounterparty(description: string, details: string): string | null {
  if (description.startsWith("Payment from ")) {
    return description.slice("Payment from ".length).trim() || null;
  }

  if (description.startsWith("Transfer from ")) {
    return description.slice("Transfer from ".length).trim() || null;
  }

  if (description.startsWith("To ")) {
    return description.slice("To ".length).trim() || null;
  }

  const detailsMatch = details.match(
    /\b(?:To|From):\s+(.+?)(?:\s+Card:|\s+IBAN\b|\s+BIC\b|\s+Sort Code\b|\s+Account Number\b|$)/,
  );
  return detailsMatch?.[1]?.trim() || null;
}

export function extractRevolutStatementFromText(text: string): ExtractedPdfStatement | null {
  if (!text.includes("Revolut Ltd") || !text.includes("Account transactions from")) {
    return null;
  }

  const summary = parseSummary(text);
  if (!summary) {
    return null;
  }

  const accountTableIndex = text.indexOf(TABLE_HEADER, text.indexOf("Account transactions from"));
  if (accountTableIndex === -1) {
    return null;
  }

  const revertedIndex = text.indexOf("Reverted from", accountTableIndex);
  const tableText = text.slice(
    accountTableIndex + TABLE_HEADER.length,
    revertedIndex === -1 ? undefined : revertedIndex,
  );

  const dateMatches = [...tableText.matchAll(DATE_PATTERN)];
  if (dateMatches.length === 0) {
    return null;
  }

  const transactions: ExtractedPdfStatement["transactions"] = [];
  let previousBalance = summary.openingBalance;

  for (let index = 0; index < dateMatches.length; index += 1) {
    const start = dateMatches[index]?.index;
    if (start == null) return null;

    const end = dateMatches[index + 1]?.index ?? tableText.length;
    const rowText = tableText.slice(start, end).replace(/\s+/g, " ").trim();

    const rowMatch = rowText.match(
      /^((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, \d{4}) (.*?) £([\d,]+\.\d{2}) £([\d,]+\.\d{2})(?:\s|$)/,
    );

    if (!rowMatch) {
      continue;
    }

    const [rawMatchedRow, rawDate, rawDescription, rawAmount, rawBalance] = rowMatch;
    if (!rawMatchedRow || !rawDate || !rawDescription || !rawAmount || !rawBalance) {
      return null;
    }

    const date = parseStatementDate(rawDate);
    if (!date) {
      return null;
    }

    const unsignedAmount = parseMoney(rawAmount);
    const balance = parseMoney(rawBalance);
    const balanceDelta = roundMoney(balance - previousBalance);

    let signedAmount: number;
    if (nearlyEqual(balanceDelta, unsignedAmount)) {
      signedAmount = unsignedAmount;
    } else if (nearlyEqual(balanceDelta, -unsignedAmount)) {
      signedAmount = -unsignedAmount;
    } else {
      return null;
    }

    const description = rawDescription.trim();
    const details = rowText.slice(rawMatchedRow.length).trim();

    transactions.push({
      date,
      description,
      counterparty: parseCounterparty(description, details),
      amount: signedAmount,
      balance,
    });

    previousBalance = balance;
  }

  const moneyOut = roundMoney(
    transactions
      .filter((transaction) => transaction.amount < 0)
      .reduce((sum, transaction) => sum - transaction.amount, 0),
  );
  const moneyIn = roundMoney(
    transactions
      .filter((transaction) => transaction.amount > 0)
      .reduce((sum, transaction) => sum + transaction.amount, 0),
  );
  const closingBalance = transactions.at(-1)?.balance;

  if (
    closingBalance == null ||
    !nearlyEqual(moneyOut, summary.moneyOut) ||
    !nearlyEqual(moneyIn, summary.moneyIn) ||
    !nearlyEqual(closingBalance, summary.closingBalance)
  ) {
    return null;
  }

  return {
    detectedCurrency: detectCurrency(text),
    transactions,
  };
}
