import { getAccountBalancesTool } from "./get-account-balances";
import { getBankAccountsTool } from "./get-bank-accounts";
import { getCustomersTool } from "./get-customers";
import { getDocumentsTool } from "./get-documents";
import { getInboxTool } from "./get-inbox";
import { getInvoicesTool } from "./get-invoices";
import { getNetPositionTool } from "./get-net-position";
import { getTransactionsTool } from "./get-transactions";

export {
  getAccountBalancesTool,
  getBankAccountsTool,
  getCustomersTool,
  getDocumentsTool,
  getInboxTool,
  getInvoicesTool,
  getNetPositionTool,
  getTransactionsTool,
};

export const operationsTools = {
  getAccountBalances: getAccountBalancesTool,
  getNetPosition: getNetPositionTool,
  getBankAccounts: getBankAccountsTool,
  getTransactions: getTransactionsTool,
  getInvoices: getInvoicesTool,
  getCustomers: getCustomersTool,
  getDocuments: getDocumentsTool,
  getInbox: getInboxTool,
} as const;
