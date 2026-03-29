import { DeleteConnectionProcessor } from "./delete-connection";
import { EnrichTransactionProcessor } from "./enrich-transaction";
import { ExportTransactionsProcessor } from "./export";
import { ImportTransactionsProcessor } from "./import-transactions";
import { ProcessTransactionAttachmentProcessor } from "./process-attachment";
import { ReconnectConnectionProcessor } from "./reconnect-connection";
import { SyncConnectionProcessor } from "./sync-connection";
import { TransactionNotificationsProcessor } from "./transaction-notifications";
import { UpdateAccountBaseCurrencyProcessor } from "./update-account-base-currency";
import { UpdateBaseCurrencyProcessor } from "./update-base-currency";

/**
 * Export all transaction processors (for type imports)
 */
export { DeleteConnectionProcessor } from "./delete-connection";
export { EnrichTransactionProcessor } from "./enrich-transaction";
export { ExportTransactionsProcessor } from "./export";
export { ImportTransactionsProcessor } from "./import-transactions";
export { ProcessTransactionAttachmentProcessor } from "./process-attachment";
export { ReconnectConnectionProcessor } from "./reconnect-connection";
export { SyncConnectionProcessor } from "./sync-connection";
export { TransactionNotificationsProcessor } from "./transaction-notifications";
export { UpdateAccountBaseCurrencyProcessor } from "./update-account-base-currency";
export { UpdateBaseCurrencyProcessor } from "./update-base-currency";

/**
 * Transaction processor registry
 * Maps job names to processor instances
 * Job names are derived from class names: ExportTransactionsProcessor -> export-transactions
 */
export const transactionProcessors = {
  "delete-connection": new DeleteConnectionProcessor(),
  "enrich-transactions": new EnrichTransactionProcessor(),
  "export-transactions": new ExportTransactionsProcessor(),
  "import-transactions": new ImportTransactionsProcessor(),
  "process-transaction-attachment": new ProcessTransactionAttachmentProcessor(),
  "reconnect-connection": new ReconnectConnectionProcessor(),
  "sync-connection": new SyncConnectionProcessor(),
  "transaction-notifications": new TransactionNotificationsProcessor(),
  "update-account-base-currency": new UpdateAccountBaseCurrencyProcessor(),
  "update-base-currency": new UpdateBaseCurrencyProcessor(),
};
