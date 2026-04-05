import { UTCDate } from "@date-fns/utc";
import { format, parseISO } from "date-fns";
import { getBankAccountsFromConvex } from "../../../convex";
import type { Database } from "../../../client";
import { getCashBalance } from "../../bank-accounts";
import {
  getExcludedCategorySlugs,
  getReportInboxLiabilityAggregateRows,
  getReportInvoiceDateAggregateRows,
  getReportTransactionAggregateRows,
  getTeamReportContext,
  getTargetCurrency,
} from "../shared";
import type {
  BalanceSheetBankAccount,
  BalanceSheetContext,
  BalanceSheetInvoiceRow,
  BalanceSheetLiabilityRow,
  BalanceSheetTransactionRow,
  GetBalanceSheetParams,
} from "./types";

export async function loadBalanceSheetContext(
  db: Database,
  params: GetBalanceSheetParams,
): Promise<BalanceSheetContext> {
  const { teamId, currency: inputCurrency, asOf } = params;

  const targetCurrency = await getTargetCurrency(db, teamId, inputCurrency);
  const { countryCode } = await getTeamReportContext(db, teamId, inputCurrency);
  const currency = targetCurrency || "USD";
  const excludedCategorySlugs = getExcludedCategorySlugs();

  const asOfDate = asOf ? parseISO(asOf) : new UTCDate();
  const asOfDateStr = format(asOfDate, "yyyy-MM-dd");

  const [
    accountBalanceData,
    transactionAggregateData,
    accountsReceivableInvoices,
    bankAccountsData,
    unmatchedBillsData,
  ] = await Promise.all([
    getCashBalance(db, {
      teamId,
      currency: inputCurrency,
    }),
    getReportTransactionAggregateRows(db, {
      teamId,
      from: "1900-01-01",
      to: asOfDateStr,
      inputCurrency,
    }),
    Promise.all([
      getReportInvoiceDateAggregateRows(db, {
        teamId,
        inputCurrency,
        statuses: ["unpaid", "overdue"],
        dateField: "issueDate",
      }),
      getReportInvoiceDateAggregateRows(db, {
        teamId,
        inputCurrency,
        statuses: ["scheduled"],
        dateField: "issueDate",
        to: asOfDateStr,
      }),
    ]).then(([outstandingInvoices, scheduledInvoices]) => [
      ...(outstandingInvoices ?? []),
      ...(scheduledInvoices ?? []),
    ]),
    getBankAccountsFromConvex({
      teamId,
      enabled: true,
    }).then((accounts) =>
      accounts
        .filter(
          (account) =>
            account.type === "credit" ||
            account.type === "loan" ||
            account.type === "other_asset" ||
            account.type === "other_liability",
        )
        .map(
          (account): BalanceSheetBankAccount => ({
            id: account.id,
            name: account.name,
            currency: account.currency || currency,
            balance: Number(account.balance) || 0,
            baseCurrency: account.baseCurrency ?? null,
            baseBalance: account.baseBalance ?? null,
            type: account.type as BalanceSheetBankAccount["type"],
          }),
        ),
    ),
    getReportInboxLiabilityAggregateRows(db, {
      teamId,
      to: asOfDateStr,
    }),
  ]);

  return {
    db,
    teamId,
    currency,
    countryCode,
    asOfDate,
    asOfDateStr,
    excludedCategorySlugs,
    accountBalanceData,
    transactions: (transactionAggregateData.rows as BalanceSheetTransactionRow[]).filter(
      (row) => {
        const slug = row.categorySlug;
        return !slug || !excludedCategorySlugs.includes(slug);
      },
    ),
    accountsReceivableInvoices: accountsReceivableInvoices as BalanceSheetInvoiceRow[],
    bankAccounts: bankAccountsData,
    unmatchedBills: unmatchedBillsData as BalanceSheetLiabilityRow[],
  };
}
