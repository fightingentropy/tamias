import { accountingRouter } from "../accounting";
import { bankAccountsRouter } from "../bank-accounts";
import { bankConnectionsRouter } from "../bank-connections";
import { bankingRouter } from "../banking";
import { payrollRouter } from "../payroll";
import { reportsRouter } from "../reports";
import { transactionAttachmentsRouter } from "../transaction-attachments";
import { transactionCategoriesRouter } from "../transaction-categories";
import { transactionTagsRouter } from "../transaction-tags";
import { transactionsRouter } from "../transactions";
import { vatRouter } from "../vat";
import { yearEndRouter } from "../year-end";

export const financeRouters = {
  accounting: accountingRouter,
  bankAccounts: bankAccountsRouter,
  bankConnections: bankConnectionsRouter,
  banking: bankingRouter,
  payroll: payrollRouter,
  reports: reportsRouter,
  transactionAttachments: transactionAttachmentsRouter,
  transactionCategories: transactionCategoriesRouter,
  transactionTags: transactionTagsRouter,
  transactions: transactionsRouter,
  vat: vatRouter,
  yearEnd: yearEndRouter,
};
