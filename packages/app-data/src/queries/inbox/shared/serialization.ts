import type {
  InboxItemRecord,
  TransactionMatchSuggestionRecord,
  TransactionRecord,
} from "@tamias/app-data-convex";

export function toUpsertInboxItem(item: InboxItemRecord, overrides: Partial<InboxItemRecord> = {}) {
  const next = { ...item, ...overrides };

  return {
    teamId: next.teamId,
    id: next.id,
    createdAt: next.createdAt,
    updatedAt: next.updatedAt,
    filePath: next.filePath,
    fileName: next.fileName,
    transactionId: next.transactionId,
    amount: next.amount,
    currency: next.currency,
    contentType: next.contentType,
    size: next.size,
    attachmentId: next.attachmentId,
    date: next.date,
    forwardedTo: next.forwardedTo,
    referenceId: next.referenceId,
    meta: next.meta,
    status: next.status,
    website: next.website,
    senderEmail: next.senderEmail,
    displayName: next.displayName,
    type: next.type,
    description: next.description,
    baseAmount: next.baseAmount,
    baseCurrency: next.baseCurrency,
    taxAmount: next.taxAmount,
    taxRate: next.taxRate,
    taxType: next.taxType,
    inboxAccountId: next.inboxAccountId,
    invoiceNumber: next.invoiceNumber,
    groupedInboxId: next.groupedInboxId,
  };
}

export function toUpsertTransaction(
  transaction: TransactionRecord,
  overrides: Partial<TransactionRecord> = {},
) {
  const next = { ...transaction, ...overrides };

  return {
    id: next.id,
    createdAt: next.createdAt,
    date: next.date,
    name: next.name,
    method: next.method,
    amount: next.amount,
    currency: next.currency,
    assignedId: next.assignedId,
    note: next.note,
    bankAccountId: next.bankAccountId,
    internalId: next.internalId,
    status: next.status,
    balance: next.balance,
    manual: next.manual,
    internal: next.internal,
    description: next.description,
    categorySlug: next.categorySlug,
    baseAmount: next.baseAmount,
    counterpartyName: next.counterpartyName,
    baseCurrency: next.baseCurrency,
    taxAmount: next.taxAmount,
    taxRate: next.taxRate,
    taxType: next.taxType,
    recurring: next.recurring,
    frequency: next.frequency,
    merchantName: next.merchantName,
    enrichmentCompleted: next.enrichmentCompleted,
  };
}

export function toUpsertSuggestion(
  suggestion: TransactionMatchSuggestionRecord,
  overrides: Partial<TransactionMatchSuggestionRecord> = {},
) {
  const next = { ...suggestion, ...overrides };

  return {
    teamId: next.teamId,
    id: next.id,
    inboxId: next.inboxId,
    transactionId: next.transactionId,
    confidenceScore: next.confidenceScore,
    amountScore: next.amountScore,
    currencyScore: next.currencyScore,
    dateScore: next.dateScore,
    nameScore: next.nameScore,
    matchType: next.matchType,
    matchDetails: next.matchDetails,
    status: next.status,
    userActionAt: next.userActionAt,
    userId: next.userId,
    createdAt: next.createdAt,
    updatedAt: next.updatedAt,
  };
}
