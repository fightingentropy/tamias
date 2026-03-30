import { ConvexHttpClient } from "convex/browser";
import { api } from "@tamias/convex-model/api";
import type { Id } from "@tamias/convex-model/data-model";

export * from "./chat-memory";
export * from "./async-runs";

const convexApi = api as typeof api & Record<string, any>;
let sharedConvexClient: ConvexHttpClient | null = null;
let sharedConvexClientUrl: string | null = null;

type ConvexUserId = Id<"appUsers">;
type ConvexTeamId = Id<"teams">;

export type NotificationChannel = "in_app" | "email" | "push";
export type NotificationStatus = "unread" | "read" | "archived";
export type NotificationSetting = {
  id: string;
  userId: ConvexUserId | null;
  teamId: string;
  notificationType: string;
  channel: NotificationChannel;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ActivityRecord = {
  id: string;
  createdAt: string;
  teamId: string;
  userId: ConvexUserId | null;
  type: string;
  priority: number | null;
  groupId: string | null;
  source: "system" | "user";
  metadata: Record<string, unknown>;
  status: NotificationStatus;
  lastUsedAt: string | null;
};

export type ActivitiesResult = {
  meta: {
    cursor: string | null;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
  data: ActivityRecord[];
};

export type InstalledAppRecord = {
  id: string;
  teamId: string | null;
  createdBy: ConvexUserId | null;
  appId: string;
  config: unknown;
  settings: unknown;
  createdAt: string;
  updatedAt: string;
};

export type InboxBlocklistType = "email" | "domain";
export type InboxBlocklistRecord = {
  id: string;
  teamId: string;
  type: InboxBlocklistType;
  value: string;
  createdAt: string;
};

export type InboxAccountProvider = "gmail" | "outlook";
export type InboxAccountStatus = "connected" | "disconnected";

export type InboxAccountListRecord = {
  id: string;
  email: string;
  provider: InboxAccountProvider;
  lastAccessed: string;
  status: InboxAccountStatus;
  errorMessage: string | null;
};

export type InboxAccountRecord = {
  id: string;
  teamId: string;
  email: string;
  provider: InboxAccountProvider;
  accessToken: string;
  refreshToken: string;
  expiryDate: string;
  lastAccessed: string;
};

export type UpsertInboxAccountInput = {
  teamId: string;
  provider: InboxAccountProvider;
  accessToken: string;
  refreshToken: string;
  email: string;
  lastAccessed: string;
  externalId: string;
  expiryDate: string;
};

export type UpdateInboxAccountInput = {
  id: string;
  refreshToken?: string;
  accessToken?: string;
  expiryDate?: string;
  scheduleId?: string;
  lastAccessed?: string;
  status?: InboxAccountStatus;
  errorMessage?: string | null;
};

export type InboxAccountInfoRecord = {
  id: string;
  provider: InboxAccountProvider;
  teamId: string;
  lastAccessed: string;
};

export type InboxItemStatus =
  | "new"
  | "archived"
  | "processing"
  | "done"
  | "pending"
  | "analyzing"
  | "suggested_match"
  | "no_match"
  | "other"
  | "deleted";

export type InboxItemType = "invoice" | "expense" | "other";

export type InboxItemRecord = {
  id: string;
  teamId: string;
  createdAt: string;
  updatedAt: string;
  filePath: string[];
  fileName: string | null;
  transactionId: string | null;
  amount: number | null;
  currency: string | null;
  contentType: string | null;
  size: number | null;
  attachmentId: string | null;
  date: string | null;
  forwardedTo: string | null;
  referenceId: string | null;
  meta: Record<string, unknown> | null;
  status: InboxItemStatus;
  website: string | null;
  senderEmail: string | null;
  displayName: string | null;
  type: InboxItemType | null;
  description: string | null;
  baseAmount: number | null;
  baseCurrency: string | null;
  taxAmount: number | null;
  taxRate: number | null;
  taxType: string | null;
  inboxAccountId: string | null;
  invoiceNumber: string | null;
  groupedInboxId: string | null;
};

export type InboxLiabilityAggregateRowRecord = {
  date: string;
  currency: string | null;
  totalAmount: number;
  itemCount: number;
  updatedAt: string;
};

export type UpsertInboxItemInConvexInput = {
  teamId: string;
  id?: string;
  createdAt?: string;
  updatedAt?: string;
  filePath: string[];
  fileName?: string | null;
  transactionId?: string | null;
  amount?: number | null;
  currency?: string | null;
  contentType?: string | null;
  size?: number | null;
  attachmentId?: string | null;
  date?: string | null;
  forwardedTo?: string | null;
  referenceId?: string | null;
  meta?: Record<string, unknown> | null;
  status: InboxItemStatus;
  website?: string | null;
  senderEmail?: string | null;
  displayName?: string | null;
  type?: InboxItemType | null;
  description?: string | null;
  baseAmount?: number | null;
  baseCurrency?: string | null;
  taxAmount?: number | null;
  taxRate?: number | null;
  taxType?: string | null;
  inboxAccountId?: string | null;
  invoiceNumber?: string | null;
  groupedInboxId?: string | null;
};

export type MatchSuggestionStatus =
  | "pending"
  | "confirmed"
  | "declined"
  | "expired"
  | "unmatched";

export type MatchSuggestionType =
  | "auto_matched"
  | "high_confidence"
  | "suggested";

export type TransactionMatchSuggestionRecord = {
  id: string;
  teamId: string;
  inboxId: string;
  transactionId: string;
  confidenceScore: number;
  amountScore: number | null;
  currencyScore: number | null;
  dateScore: number | null;
  nameScore: number | null;
  matchType: MatchSuggestionType;
  matchDetails: Record<string, unknown> | null;
  status: MatchSuggestionStatus;
  userActionAt: string | null;
  userId: ConvexUserId | null;
  createdAt: string;
  updatedAt: string;
};

export type UpsertTransactionMatchSuggestionInConvexInput = {
  teamId: string;
  id?: string;
  inboxId: string;
  transactionId: string;
  confidenceScore: number;
  amountScore?: number | null;
  currencyScore?: number | null;
  dateScore?: number | null;
  nameScore?: number | null;
  matchType: MatchSuggestionType;
  matchDetails?: Record<string, unknown> | null;
  status: MatchSuggestionStatus;
  userActionAt?: string | null;
  userId?: ConvexUserId | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ShortLinkRecord = {
  id: string;
  shortId: string;
  url: string;
  teamId: string | null;
  userId: ConvexUserId | null;
  createdAt: string;
  fileName: string | null;
  teamName: string | null;
  type: "redirect" | "download" | null;
  size: number | null;
  mimeType: string | null;
  expiresAt: string | null;
};

export type CreatedShortLinkRecord = {
  id: string;
  shortId: string;
  url: string;
  type: "redirect" | "download" | null;
  fileName: string | null;
  mimeType: string | null;
  size: number | null;
  createdAt: string;
  expiresAt: string | null;
};

export type DocumentTagEmbeddingRecord = {
  slug: string;
  name: string;
  embedding: number[];
  model: string;
  createdAt: string;
  updatedAt: string;
};

export type DocumentTagRecord = {
  id: string;
  teamId: string;
  name: string;
  slug: string;
  createdAt: string;
};

export type UpsertDocumentTagInput = {
  teamId: string;
  name: string;
  slug: string;
};

export type DocumentTagAssignmentRecord = {
  documentId: string;
  tagId: string;
  teamId: string;
  createdAt: string;
  updatedAt: string;
  documentTag: {
    id: string;
    name: string;
    slug: string;
  };
};

export type UpsertDocumentTagAssignmentInput = {
  documentId: string;
  tagId: string;
  teamId: string;
};

export type DocumentProcessingStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export type DocumentRecord = {
  id: string;
  teamId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown> | null;
  pathTokens: string[];
  parentId: string | null;
  objectId: string | null;
  ownerId: string | null;
  tag: string | null;
  title: string | null;
  body: string | null;
  summary: string | null;
  content: string | null;
  date: string | null;
  language: string | null;
  processingStatus: DocumentProcessingStatus;
};

export type UpsertDocumentInConvexInput = {
  teamId: string;
  id?: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown> | null;
  pathTokens?: string[];
  parentId?: string | null;
  objectId?: string | null;
  ownerId?: string | null;
  tag?: string | null;
  title?: string | null;
  body?: string | null;
  summary?: string | null;
  content?: string | null;
  date?: string | null;
  language?: string | null;
  processingStatus?: DocumentProcessingStatus;
};

export type UpdateDocumentByNameInConvexInput = {
  teamId: string;
  name: string;
  title?: string | null;
  summary?: string | null;
  content?: string | null;
  body?: string | null;
  tag?: string | null;
  date?: string | null;
  language?: string | null;
  processingStatus?: DocumentProcessingStatus;
  metadata?: Record<string, unknown> | null;
};

export type TrackerProjectTagAssignmentRecord = {
  trackerProjectId: string;
  tagId: string;
  teamId: string;
  createdAt: string;
  updatedAt: string;
};

export type TrackerProjectRecord = {
  id: string;
  teamId: string;
  name: string;
  description: string | null;
  status: "in_progress" | "completed";
  customerId: string | null;
  estimate: number | null;
  currency: string | null;
  billable: boolean;
  rate: number | null;
  createdAt: string;
  updatedAt: string;
};

export type UpsertTrackerProjectInput = {
  id: string;
  teamId: string;
  name: string;
  description?: string | null;
  status?: "in_progress" | "completed";
  customerId?: string | null;
  estimate?: number | null;
  currency?: string | null;
  billable?: boolean | null;
  rate?: number | null;
};

export type TrackerEntryRecord = {
  id: string;
  teamId: string;
  projectId: string | null;
  assignedId: ConvexUserId | null;
  description: string | null;
  start: string | null;
  stop: string | null;
  duration: number | null;
  date: string;
  rate: number | null;
  currency: string | null;
  billed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UpsertTrackerEntryInput = {
  id: string;
  teamId: string;
  projectId?: string | null;
  assignedId?: ConvexUserId | null;
  description?: string | null;
  start?: string | null;
  stop?: string | null;
  duration?: number | null;
  date: string;
  rate?: number | null;
  currency?: string | null;
  billed?: boolean | null;
};

export type CustomerTagAssignmentRecord = {
  customerId: string;
  tagId: string;
  teamId: string;
  createdAt: string;
  updatedAt: string;
};

export type TransactionCategoryRecord = {
  id: string;
  teamId: string;
  name: string;
  color: string | null;
  slug: string;
  description: string | null;
  system: boolean;
  taxRate: number | null;
  taxType: string | null;
  taxReportingCode: string | null;
  excluded: boolean;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UpsertTransactionCategoryInput = {
  id?: string;
  teamId: string;
  name: string;
  slug?: string;
  color?: string | null;
  description?: string | null;
  system?: boolean;
  taxRate?: number | null;
  taxType?: string | null;
  taxReportingCode?: string | null;
  excluded?: boolean | null;
  parentId?: string | null;
};

export type TagRecord = {
  id: string;
  teamId: string;
  name: string;
  createdAt: string;
};

export type TransactionTagAssignmentRecord = {
  id: string;
  transactionId: string;
  tagId: string;
  teamId: string;
  createdAt: string;
  updatedAt: string;
  tag: {
    id: string;
    name: string;
  };
};

export type TransactionAttachmentRecord = {
  id: string;
  transactionId: string | null;
  teamId: string;
  name: string | null;
  path: string[] | null;
  type: string | null;
  size: number | null;
  createdAt: string;
};

export type CreateTransactionAttachmentInput = {
  transactionId?: string | null;
  name: string;
  path: string[];
  type: string;
  size: number;
};

export type UpsertDocumentTagEmbeddingInput = {
  slug: string;
  name: string;
  embedding: number[];
  model?: string;
};

export type TransactionCategoryEmbeddingRecord = {
  name: string;
  embedding: number[];
  model: string;
  system: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UpsertTransactionCategoryEmbeddingInput = {
  name: string;
  embedding: number[];
  system?: boolean;
  model?: string;
};

export type ExchangeRateRecord = {
  base: string;
  target: string;
  rate: number;
  updatedAt: string;
};

export type InstitutionProvider = "gocardless" | "plaid" | "teller";

export type BankConnectionProvider = InstitutionProvider;
export type BankConnectionStatus = "connected" | "disconnected" | "unknown";
export type BankAccountType =
  | "credit"
  | "depository"
  | "other_asset"
  | "loan"
  | "other_liability";

export type BankAccountRecord = {
  id: string;
  createdAt: string;
  createdBy: ConvexUserId | null;
  teamId: string;
  name: string | null;
  currency: string | null;
  bankConnectionId: string | null;
  enabled: boolean;
  accountId: string;
  balance: number | null;
  manual: boolean;
  type: BankAccountType | null;
  baseCurrency: string | null;
  baseBalance: number | null;
  errorDetails: string | null;
  errorRetries: number | null;
  accountReference: string | null;
  iban: string | null;
  subtype: string | null;
  bic: string | null;
  routingNumber: string | null;
  wireRoutingNumber: string | null;
  accountNumber: string | null;
  sortCode: string | null;
  availableBalance: number | null;
  creditLimit: number | null;
  bankConnection?: BankConnectionRecord | null;
};

export type BankConnectionRecord = {
  id: string;
  createdAt: string;
  institutionId: string;
  expiresAt: string | null;
  teamId: string;
  name: string;
  logoUrl: string | null;
  accessToken: string | null;
  enrollmentId: string | null;
  provider: BankConnectionProvider;
  lastAccessed: string | null;
  referenceId: string | null;
  status: BankConnectionStatus | null;
  errorDetails: string | null;
  errorRetries: number | null;
  bankAccounts: BankAccountRecord[];
};

export type BankConnectionLookupRecord = {
  id: string;
  createdAt: string;
  team: {
    id: string;
    plan: "trial" | "starter" | "pro";
    createdAt: string;
  };
};

export type BankAccountBalanceRecord = {
  id: string;
  currency: string;
  balance: number;
  name: string;
  logo_url: string;
};

export type BankAccountCurrencyRecord = {
  currency: string;
};

export type BankAccountDetailsRecord = {
  id: string;
  iban: string | null;
  accountNumber: string | null;
  routingNumber: string | null;
  wireRoutingNumber: string | null;
  bic: string | null;
  sortCode: string | null;
};

export type BankAccountWithPaymentInfoRecord = {
  id: string;
  name: string;
  bankName: string | null;
  currency: string | null;
  iban: string | null;
  accountNumber: string | null;
  routingNumber: string | null;
  wireRoutingNumber: string | null;
  bic: string | null;
  sortCode: string | null;
};

export type TransactionMethod =
  | "payment"
  | "card_purchase"
  | "card_atm"
  | "transfer"
  | "other"
  | "unknown"
  | "ach"
  | "interest"
  | "deposit"
  | "wire"
  | "fee";

export type TransactionStatus =
  | "posted"
  | "pending"
  | "excluded"
  | "completed"
  | "archived"
  | "exported";

export type TransactionFrequency =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "semi_monthly"
  | "annually"
  | "irregular"
  | "unknown";

export type TransactionRecord = {
  id: string;
  teamId: string;
  createdAt: string;
  updatedAt: string;
  date: string;
  name: string;
  method: TransactionMethod;
  amount: number;
  currency: string;
  assignedId: string | null;
  note: string | null;
  bankAccountId: string | null;
  internalId: string;
  status: TransactionStatus;
  balance: number | null;
  manual: boolean;
  notified: boolean;
  internal: boolean;
  description: string | null;
  categorySlug: string | null;
  baseAmount: number | null;
  counterpartyName: string | null;
  baseCurrency: string | null;
  taxAmount: number | null;
  taxRate: number | null;
  taxType: string | null;
  recurring: boolean;
  frequency: TransactionFrequency | null;
  merchantName: string | null;
  enrichmentCompleted: boolean;
};

export type TransactionMetricAggregateRowRecord = {
  scope: "base" | "native";
  date: string;
  currency: string;
  direction: "income" | "expense";
  categorySlug: string | null;
  recurring: boolean;
  totalAmount: number;
  totalNetAmount: number | null;
  transactionCount: number;
  updatedAt: string;
};

export type TransactionRecurringAggregateRowRecord = {
  scope: "base" | "native";
  direction: "income" | "expense";
  currency: string;
  date: string;
  name: string;
  frequency: TransactionFrequency | null;
  categorySlug: string | null;
  totalAmount: number;
  transactionCount: number;
  latestAmount: number;
  latestTransactionCreatedAt: string;
  updatedAt: string;
};

export type TransactionTaxAggregateRowRecord = {
  scope: "base" | "native";
  date: string;
  currency: string;
  direction: "income" | "expense";
  categorySlug: string | null;
  taxType: string | null;
  taxRate: number;
  totalTaxAmount: number;
  totalTransactionAmount: number;
  transactionCount: number;
  updatedAt: string;
};

export type UpsertTransactionInConvexInput = {
  id: string;
  createdAt: string;
  date: string;
  name: string;
  method: TransactionMethod;
  amount: number;
  currency: string;
  assignedId?: string | null;
  note?: string | null;
  bankAccountId?: string | null;
  internalId: string;
  status: TransactionStatus;
  balance?: number | null;
  manual: boolean;
  notified?: boolean | null;
  internal?: boolean | null;
  description?: string | null;
  categorySlug?: string | null;
  baseAmount?: number | null;
  counterpartyName?: string | null;
  baseCurrency?: string | null;
  taxAmount?: number | null;
  taxRate?: number | null;
  taxType?: string | null;
  recurring?: boolean | null;
  frequency?: TransactionFrequency | null;
  merchantName?: string | null;
  enrichmentCompleted?: boolean | null;
};

export type CreateBankAccountInConvexInput = {
  id?: string;
  teamId: string;
  userId: ConvexUserId;
  name: string;
  currency?: string;
  manual?: boolean;
  accountId?: string;
  type?: BankAccountType;
};

export type UpdateBankAccountInConvexInput = {
  id: string;
  teamId: string;
  name?: string;
  type?: BankAccountType;
  balance?: number;
  enabled?: boolean;
  currency?: string;
  baseBalance?: number;
  baseCurrency?: string;
  errorDetails?: string | null;
  errorRetries?: number | null;
  accountReference?: string | null;
  accountId?: string;
  iban?: string | null;
  subtype?: string | null;
  bic?: string | null;
  routingNumber?: string | null;
  wireRoutingNumber?: string | null;
  accountNumber?: string | null;
  sortCode?: string | null;
  availableBalance?: number | null;
  creditLimit?: number | null;
};

export type PatchBankAccountInConvexInput = UpdateBankAccountInConvexInput;

export type BankProviderAccountInput = {
  id?: string;
  accountId: string;
  institutionId?: string;
  logoUrl?: string | null;
  name: string;
  bankName?: string;
  currency: string;
  enabled?: boolean;
  balance?: number;
  type: BankAccountType;
  accountReference?: string | null;
  expiresAt?: string | null;
  iban?: string | null;
  subtype?: string | null;
  bic?: string | null;
  routingNumber?: string | null;
  wireRoutingNumber?: string | null;
  accountNumber?: string | null;
  sortCode?: string | null;
  availableBalance?: number | null;
  creditLimit?: number | null;
};

export type CreateBankConnectionInConvexInput = {
  id?: string;
  teamId: string;
  userId: ConvexUserId;
  provider: BankConnectionProvider;
  accounts: BankProviderAccountInput[];
  accessToken?: string | null;
  enrollmentId?: string | null;
  referenceId?: string | null;
};

export type AddProviderAccountsInConvexInput = {
  connectionId: string;
  teamId: string;
  userId: ConvexUserId;
  accounts: BankProviderAccountInput[];
};

export type PatchBankConnectionInConvexInput = {
  id: string;
  teamId?: string;
  institutionId?: string;
  expiresAt?: string | null;
  name?: string;
  logoUrl?: string | null;
  accessToken?: string | null;
  enrollmentId?: string | null;
  provider?: BankConnectionProvider;
  lastAccessed?: string | null;
  referenceId?: string | null;
  status?: BankConnectionStatus;
  errorDetails?: string | null;
  errorRetries?: number | null;
};

export type InstitutionRecord = {
  id: string;
  name: string;
  logo: string | null;
  popularity: number;
  availableHistory: number | null;
  maximumConsentValidity: number | null;
  provider: InstitutionProvider;
  type: string | null;
  countries: string[];
};

export type InvoiceProductRecord = {
  id: string;
  createdAt: string;
  updatedAt: string | null;
  teamId: string;
  createdBy: ConvexUserId | null;
  name: string;
  description: string | null;
  price: number | null;
  currency: string | null;
  unit: string | null;
  taxRate: number | null;
  isActive: boolean;
  usageCount: number;
  lastUsedAt: string | null;
};

export type InvoiceTemplateSize = "a4" | "letter";
export type InvoiceTemplateDeliveryType =
  | "create"
  | "create_and_send"
  | "scheduled";

export type InvoiceTemplateRecord = {
  id: string;
  name: string;
  isDefault: boolean;
  customerLabel?: string;
  title?: string;
  fromLabel?: string;
  invoiceNoLabel?: string;
  issueDateLabel?: string;
  dueDateLabel?: string;
  descriptionLabel?: string;
  priceLabel?: string;
  quantityLabel?: string;
  totalLabel?: string;
  totalSummaryLabel?: string;
  vatLabel?: string;
  subtotalLabel?: string;
  taxLabel?: string;
  discountLabel?: string;
  sendCopy?: boolean;
  paymentLabel?: string;
  noteLabel?: string;
  logoUrl?: string | null;
  currency?: string;
  paymentDetails?: unknown | null;
  fromDetails?: unknown | null;
  noteDetails?: unknown | null;
  dateFormat?: string;
  includeVat?: boolean;
  includeTax?: boolean;
  includeDiscount?: boolean;
  includeDecimals?: boolean;
  includeUnits?: boolean;
  includeQr?: boolean;
  includeLineItemTax?: boolean;
  lineItemTaxLabel?: string;
  taxRate?: number | null;
  vatRate?: number | null;
  size?: InvoiceTemplateSize;
  deliveryType?: InvoiceTemplateDeliveryType;
  includePdf?: boolean;
  paymentEnabled?: boolean;
  paymentTermsDays?: number;
  emailSubject?: string | null;
  emailHeading?: string | null;
  emailBody?: string | null;
  emailButtonText?: string | null;
};

export type InvoiceTemplateDeleteResult = {
  deleted: InvoiceTemplateRecord;
  newDefault: InvoiceTemplateRecord | null;
};

export type PublicInvoiceRecord = {
  id: string;
  token: string;
  status: string;
  paymentIntentId: string | null;
  viewedAt: string | null;
  invoiceNumber: string | null;
  invoiceRecurringId?: string | null;
  recurringSequence?: number | null;
  payload: unknown;
  createdAt: string;
  updatedAt: string;
};

export type InvoiceAggregateRowRecord = {
  scopeKey: string;
  customerId: string | null;
  status: string;
  currency: string | null;
  invoiceCount: number;
  totalAmount: number;
  oldestDueDate: string | null;
  latestIssueDate: string | null;
  updatedAt: string;
};

export type InvoiceAggregateDateField = "issueDate" | "paidAt";
export type InvoiceCustomerAggregateDateField = "createdAt" | "paidAt";
export type InvoiceAnalyticsAggregateDateField =
  | "createdAt"
  | "sentAt"
  | "paidAt";

export type InvoiceDateAggregateRowRecord = {
  status: string;
  dateField: InvoiceAggregateDateField;
  date: string;
  currency: string | null;
  recurring: boolean;
  invoiceCount: number;
  totalAmount: number;
  validPaymentCount: number;
  onTimeCount: number;
  totalDaysToPay: number;
  updatedAt: string;
};

export type InvoiceCustomerDateAggregateRowRecord = {
  customerId: string;
  status: string;
  dateField: InvoiceCustomerAggregateDateField;
  date: string;
  currency: string | null;
  invoiceCount: number;
  totalAmount: number;
  updatedAt: string;
};

export type InvoiceAnalyticsAggregateRowRecord = {
  dateField: InvoiceAnalyticsAggregateDateField;
  date: string;
  status: string;
  currency: string | null;
  dueDate: string | null;
  invoiceCount: number;
  totalAmount: number;
  issueToPaidValidCount: number;
  issueToPaidTotalDays: number;
  sentToPaidValidCount: number;
  sentToPaidTotalDays: number;
  updatedAt: string;
};

export type InvoiceAgingAggregateRowRecord = {
  status: string;
  currency: string | null;
  issueDate: string | null;
  dueDate: string | null;
  invoiceCount: number;
  totalAmount: number;
  updatedAt: string;
};

export type PublicInvoiceFilterDateField =
  | "createdAt"
  | "issueDate"
  | "sentAt"
  | "dueDate"
  | "paidAt";

export type InvoiceRecurringSeriesRecord = {
  id: string;
  customerId: string | null;
  customerName: string | null;
  status: string;
  nextScheduledAt: string | null;
  upcomingNotificationSentAt: string | null;
  payload: unknown;
  createdAt: string;
  updatedAt: string;
};

export type UpsertInstitutionInput = {
  id: string;
  name: string;
  logo: string | null;
  provider: InstitutionProvider;
  countries: string[];
  availableHistory: number | null;
  maximumConsentValidity: number | null;
  popularity: number;
  type: string | null;
};

export type InsightUserStatusRecord = {
  insightId: string;
  userId: ConvexUserId;
  readAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReportLinkType =
  | "profit"
  | "revenue"
  | "burn_rate"
  | "expense"
  | "monthly_revenue"
  | "revenue_forecast"
  | "runway"
  | "category_expenses";

export type ReportLinkRecord = {
  id: string;
  linkId: string;
  type: ReportLinkType;
  from: string;
  to: string;
  currency: string | null;
  teamId: string | null;
  createdAt: string;
  expireAt: string | null;
  teamName: string | null;
  teamLogoUrl: string | null;
};

export type EvidencePackRecord = {
  id: string;
  teamId: string;
  filingProfileId: string;
  vatReturnId: string;
  checksum: string;
  payload: Record<string, unknown>;
  createdBy: ConvexUserId | null;
  createdAt: string;
};

export type SubmissionEventRecord = {
  id: string;
  teamId: string;
  filingProfileId: string;
  provider: string;
  obligationType: string;
  vatReturnId: string | null;
  status: string;
  eventType: string;
  correlationId: string | null;
  requestPayload?: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
  errorMessage: string | null;
  createdAt: string;
};

export type SourceLinkType =
  | "transaction"
  | "invoice"
  | "invoice_refund"
  | "inbox"
  | "manual_adjustment"
  | "payroll_import";

export type InsightRecord = {
  id: string;
  teamId: string;
  periodType: "weekly" | "monthly" | "quarterly" | "yearly";
  periodStart: string;
  periodEnd: string;
  periodYear: number;
  periodNumber: number;
  status: "pending" | "generating" | "completed" | "failed";
  selectedMetrics: unknown;
  allMetrics: unknown;
  anomalies: unknown;
  expenseAnomalies: unknown;
  milestones: unknown;
  activity: unknown;
  currency: string;
  title: string | null;
  content: unknown;
  predictions: unknown;
  audioPath: string | null;
  generatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const apiWithSubmissionEvents = api as typeof api & {
  submissionEvents: {
    serviceCreateSubmissionEvent: any;
    serviceListSubmissionEvents: any;
  };
};

const apiWithFilingSequences = api as typeof api & {
  filingSequences: {
    serviceAllocateFilingSequence: any;
  };
};

const apiWithInsightsStore = api as typeof api & {
  insightsStore: {
    serviceCreateInsight: any;
    serviceUpdateInsight: any;
    serviceListInsights: any;
    serviceGetInsightById: any;
  };
};

export type TeamRole = "owner" | "member";

export type TeamListIdentityRecord = {
  id: string;
  convexId: ConvexTeamId;
  name: string | null;
  logoUrl: string | null;
  email: string | null;
  inboxId: string | null;
  plan: string | null;
  exportSettings?: unknown;
  stripeAccountId?: string | null;
  stripeConnectStatus?: string | null;
  createdAt: string;
  canceledAt: string | null;
  countryCode: string | null;
  baseCurrency: string | null;
  fiscalYearStartMonth: number | null;
  companyType: string | null;
  heardAbout: string | null;
  role: TeamRole;
};

export type TeamIdentityRecord = Omit<TeamListIdentityRecord, "role">;

export type InsightEligibleTeamRecord = {
  id: string;
  baseCurrency: string | null;
  ownerLocale: string;
  ownerTimezone: string;
};

export type TeamMemberIdentityRecord = {
  id: string;
  role: TeamRole;
  teamId: string;
  createdAt: string;
  user: {
    id: string;
    convexId: ConvexUserId;
    fullName: string | null;
    avatarUrl: string | null;
    email: string | null;
    timezone: string | null;
    locale: string | null;
  };
};

export type CustomerRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  teamId: string;
  name: string;
  email: string;
  billingEmail: string | null;
  country: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  note: string | null;
  website: string | null;
  phone: string | null;
  vatNumber: string | null;
  countryCode: string | null;
  token: string | null;
  contact: string | null;
  status: string | null;
  preferredCurrency: string | null;
  defaultPaymentTerms: number | null;
  isArchived: boolean;
  source: string | null;
  externalId: string | null;
  logoUrl: string | null;
  description: string | null;
  industry: string | null;
  companyType: string | null;
  employeeCount: string | null;
  foundedYear: number | null;
  estimatedRevenue: string | null;
  fundingStage: string | null;
  totalFunding: string | null;
  headquartersLocation: string | null;
  timezone: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  ceoName: string | null;
  financeContact: string | null;
  financeContactEmail: string | null;
  primaryLanguage: string | null;
  fiscalYearEnd: string | null;
  enrichmentStatus: string | null;
  enrichedAt: string | null;
  portalEnabled: boolean;
  portalId: string | null;
};

export type CustomerForEnrichmentRecord = {
  id: string;
  name: string;
  website: string | null;
  teamId: string;
  email: string | null;
  country: string | null;
  countryCode: string | null;
  city: string | null;
  state: string | null;
  addressLine1: string | null;
  phone: string | null;
  vatNumber: string | null;
  note: string | null;
  contact: string | null;
};

export type UpsertCustomerInConvexInput = {
  teamId: string;
  id?: string | null;
  createdAt?: string | null;
  name: string;
  email: string;
  billingEmail?: string | null;
  country?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  note?: string | null;
  website?: string | null;
  phone?: string | null;
  vatNumber?: string | null;
  countryCode?: string | null;
  token?: string | null;
  contact?: string | null;
  status?: string | null;
  preferredCurrency?: string | null;
  defaultPaymentTerms?: number | null;
  isArchived?: boolean | null;
  source?: string | null;
  externalId?: string | null;
  logoUrl?: string | null;
  description?: string | null;
  industry?: string | null;
  companyType?: string | null;
  employeeCount?: string | null;
  foundedYear?: number | null;
  estimatedRevenue?: string | null;
  fundingStage?: string | null;
  totalFunding?: string | null;
  headquartersLocation?: string | null;
  timezone?: string | null;
  linkedinUrl?: string | null;
  twitterUrl?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  ceoName?: string | null;
  financeContact?: string | null;
  financeContactEmail?: string | null;
  primaryLanguage?: string | null;
  fiscalYearEnd?: string | null;
  enrichmentStatus?: string | null;
  enrichedAt?: string | null;
  portalEnabled?: boolean | null;
  portalId?: string | null;
};

export type CustomerEnrichmentUpdateRecord = {
  description?: string | null;
  industry?: string | null;
  companyType?: string | null;
  employeeCount?: string | null;
  foundedYear?: number | null;
  estimatedRevenue?: string | null;
  fundingStage?: string | null;
  totalFunding?: string | null;
  headquartersLocation?: string | null;
  timezone?: string | null;
  linkedinUrl?: string | null;
  twitterUrl?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  ceoName?: string | null;
  financeContact?: string | null;
  financeContactEmail?: string | null;
  primaryLanguage?: string | null;
  fiscalYearEnd?: string | null;
  vatNumber?: string | null;
};

export type CurrentUserIdentityRecord = {
  id: string;
  convexId: ConvexUserId;
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
  locale: string;
  weekStartsOnMonday: boolean;
  timezone: string | null;
  timezoneAutoSync: boolean;
  timeFormat: number;
  dateFormat: string | null;
  teamId: string | null;
  convexTeamId: ConvexTeamId | null;
  team: TeamIdentityRecord | null;
};

export type UpdateUserInConvexIdentityInput = {
  userId?: ConvexUserId;
  currentEmail?: string | null;
  fullName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  locale?: string | null;
  weekStartsOnMonday?: boolean;
  timezone?: string | null;
  timezoneAutoSync?: boolean;
  timeFormat?: 12 | 24;
  dateFormat?: string | null;
};

export type UpdateTeamInConvexIdentityInput = {
  teamId: string;
  name?: string | null;
  logoUrl?: string | null;
  email?: string | null;
  baseCurrency?: string | null;
  countryCode?: string | null;
  fiscalYearStartMonth?: number | null;
  exportSettings?: unknown;
  subscriptionStatus?: string | null;
  stripeAccountId?: string | null;
  stripeConnectStatus?: string | null;
  companyType?: string | null;
  heardAbout?: string | null;
  canceledAt?: string | null;
  plan?: string | null;
};

export type CreateTeamForUserInConvexIdentityInput = {
  userId?: ConvexUserId;
  email?: string | null;
  teamId?: string | null;
  name: string;
  inboxId?: string | null;
  baseCurrency?: string | null;
  countryCode?: string | null;
  fiscalYearStartMonth?: number | null;
  logoUrl?: string | null;
  companyType?: string | null;
  heardAbout?: string | null;
  switchTeam?: boolean;
};

export type AccountingSyncProvider = "xero" | "quickbooks" | "fortnox";
export type AccountingSyncStatus = "synced" | "partial" | "failed" | "pending";

export type AccountingSyncRecord = {
  id: string;
  transactionId: string;
  teamId: string;
  provider: AccountingSyncProvider;
  providerTenantId: string;
  providerTransactionId: string | null;
  syncedAttachmentMapping: Record<string, string | null>;
  syncedAt: string;
  syncType: "manual" | null;
  status: AccountingSyncStatus;
  errorMessage: string | null;
  errorCode: string | null;
  providerEntityType: string | null;
  createdAt: string;
};

export type ComplianceAdjustmentLineCode =
  | "box1"
  | "box2"
  | "box3"
  | "box4"
  | "box5"
  | "box6"
  | "box7"
  | "box8"
  | "box9";

export type ComplianceAdjustmentRecord = {
  id: string;
  teamId: string;
  filingProfileId: string;
  vatReturnId: string | null;
  obligationId: string | null;
  effectiveDate: string;
  lineCode: ComplianceAdjustmentLineCode;
  amount: number;
  reason: string;
  note: string | null;
  createdBy: ConvexUserId | null;
  meta: unknown;
  createdAt: string;
};

export type FilingProfileRecord = {
  id: string;
  teamId: string;
  provider: string;
  legalEntityType: string;
  enabled: boolean;
  countryCode: string;
  companyName: string | null;
  companyNumber: string | null;
  companyAuthenticationCode: string | null;
  utr: string | null;
  vrn: string | null;
  vatScheme: string | null;
  accountingBasis: string;
  filingMode: string;
  agentReferenceNumber: string | null;
  yearEndMonth: number | null;
  yearEndDay: number | null;
  baseCurrency: string | null;
  principalActivity: string | null;
  directors: string[];
  signingDirectorName: string | null;
  approvalDate: string | null;
  averageEmployeeCount: number | null;
  ordinaryShareCount: number | null;
  ordinaryShareNominalValue: number | null;
  dormant: boolean | null;
  auditExemptionClaimed: boolean | null;
  membersDidNotRequireAudit: boolean | null;
  directorsAcknowledgeResponsibilities: boolean | null;
  accountsPreparedUnderSmallCompaniesRegime: boolean | null;
  createdAt: string;
  updatedAt: string;
};

export type ComplianceObligationRecord = {
  id: string;
  teamId: string;
  filingProfileId: string;
  provider: string;
  obligationType: string;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  status: string;
  externalId: string | null;
  raw: unknown;
  createdAt: string;
  updatedAt: string;
};

export type VatReturnLineRecord = {
  code: string;
  label: string;
  amount: number;
  meta: unknown;
};

export type VatReturnRecord = {
  id: string;
  teamId: string;
  filingProfileId: string;
  obligationId: string | null;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  status: "draft" | "ready" | "submitted" | "accepted" | "rejected";
  currency: string;
  netVatDue: number;
  submittedAt: string | null;
  externalSubmissionId: string | null;
  declarationAccepted: boolean;
  lines: VatReturnLineRecord[];
  createdAt: string;
  updatedAt: string;
};

export type ComplianceJournalSourceType =
  | "transaction"
  | "invoice"
  | "invoice_refund"
  | "manual_adjustment"
  | "payroll_import";

export type ComplianceJournalLineRecord = {
  accountCode: string;
  description?: string | null;
  debit?: number;
  credit?: number;
  taxRate?: number | null;
  taxAmount?: number | null;
  taxType?: string | null;
  vatBox?: string | null;
  meta?: Record<string, unknown> | null;
};

export type ComplianceJournalEntryRecord = {
  journalEntryId: string;
  entryDate: string;
  reference?: string | null;
  description?: string | null;
  sourceType: ComplianceJournalSourceType;
  sourceId: string;
  currency: string;
  meta?: Record<string, unknown> | null;
  lines: ComplianceJournalLineRecord[];
};

export type ExportBundleRecord = {
  id: string;
  filePath: string;
  fileName: string;
  checksum: string;
  generatedAt: string;
  manifest: Record<string, unknown>;
};

export type CorporationTaxAdjustmentRecord = {
  id: string;
  teamId: string;
  filingProfileId: string;
  periodKey: string;
  category: string;
  label: string;
  amount: number;
  note: string | null;
  createdBy: ConvexUserId | null;
  createdAt: string;
  updatedAt: string;
};

export type CloseCompanyLoansScheduleRecord = {
  id: string;
  teamId: string;
  filingProfileId: string;
  periodKey: string;
  beforeEndPeriod: boolean;
  loansMade: Array<{
    name: string;
    amountOfLoan: number;
  }>;
  taxChargeable: number | null;
  reliefEarlierThan: Array<{
    name: string;
    amountRepaid: number | null;
    amountReleasedOrWrittenOff: number | null;
    date: string;
  }>;
  reliefEarlierDue: number | null;
  loanLaterReliefNow: Array<{
    name: string;
    amountRepaid: number | null;
    amountReleasedOrWrittenOff: number | null;
    date: string;
  }>;
  reliefLaterDue: number | null;
  totalLoansOutstanding: number | null;
  createdBy: ConvexUserId | null;
  createdAt: string;
  updatedAt: string;
};

export type CorporationTaxRateScheduleRecord = {
  id: string;
  teamId: string;
  filingProfileId: string;
  periodKey: string;
  exemptDistributions: number | null;
  associatedCompaniesThisPeriod: number | null;
  associatedCompaniesFirstYear: number | null;
  associatedCompaniesSecondYear: number | null;
  createdBy: ConvexUserId | null;
  createdAt: string;
  updatedAt: string;
};

export type YearEndPackRecord = {
  id: string;
  teamId: string;
  filingProfileId: string;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  accountsDueDate: string;
  corporationTaxDueDate: string;
  status: "draft" | "ready" | "exported";
  currency: string;
  trialBalance: unknown;
  profitAndLoss: unknown;
  balanceSheet: unknown;
  retainedEarnings: unknown;
  workingPapers: unknown;
  corporationTax: unknown;
  manualJournalCount: number;
  payrollRunCount: number;
  exportBundles: ExportBundleRecord[];
  latestExportedAt: string | null;
  snapshotChecksum: string;
  createdAt: string;
  updatedAt: string;
};

export type PayrollRunRecord = {
  id: string;
  teamId: string;
  filingProfileId: string;
  periodKey: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  runDate: string;
  source: "csv" | "manual";
  status: "imported" | "exported";
  checksum: string;
  currency: string;
  journalEntryId: string;
  lineCount: number;
  liabilityTotals: {
    grossPay: number;
    employerTaxes: number;
    payeLiability: number;
  };
  exportBundles: ExportBundleRecord[];
  latestExportedAt: string | null;
  meta: Record<string, unknown> | null;
  createdBy: ConvexUserId | null;
  createdAt: string;
  updatedAt: string;
};

function getConvexUrl() {
  return (
    process.env.CONVEX_URL ||
    process.env.NEXT_PUBLIC_CONVEX_URL ||
    process.env.CONVEX_SITE_URL
  );
}

function getServiceKey() {
  const configuredKey = process.env.CONVEX_SERVICE_KEY;

  if (configuredKey) {
    return configuredKey;
  }

  const convexUrl = getConvexUrl();

  if (convexUrl?.includes("127.0.0.1") || convexUrl?.includes("localhost")) {
    return "local-dev";
  }

  throw new Error("Missing CONVEX_SERVICE_KEY");
}

function createClient() {
  const convexUrl = getConvexUrl();

  if (!convexUrl) {
    throw new Error("Missing CONVEX_URL or NEXT_PUBLIC_CONVEX_URL");
  }

  if (!sharedConvexClient || sharedConvexClientUrl !== convexUrl) {
    sharedConvexClient = new ConvexHttpClient(convexUrl, { logger: false });
    sharedConvexClientUrl = convexUrl;
  }

  return sharedConvexClient;
}

function serviceArgs<T extends Record<string, unknown>>(args: T) {
  return {
    serviceKey: getServiceKey(),
    ...args,
  };
}

const apiWithAccountingSync = api as typeof api & {
  accountingSync: {
    serviceGetAccountingSyncStatus: any;
    serviceUpsertAccountingSyncRecord: any;
    serviceDeleteAccountingSyncRecords: any;
    serviceUpdateSyncedAttachmentMapping: any;
  };
};
const apiWithTransactions = api as typeof api & {
  transactions: {
    serviceListTransactionsPage: any;
  };
};

const apiWithComplianceAdjustments = api as typeof api & {
  complianceAdjustments: {
    serviceListComplianceAdjustmentsForPeriod: any;
    serviceCountComplianceAdjustmentsByVatReturnId: any;
    serviceCreateComplianceAdjustment: any;
  };
};

const apiWithComplianceState = api as typeof api & {
  complianceState: {
    serviceGetFilingProfile: any;
    serviceUpsertFilingProfile: any;
    serviceUpsertVatObligation: any;
    serviceListVatObligations: any;
    serviceGetVatObligationById: any;
    serviceGetVatReturnById: any;
    serviceGetVatReturnByObligationId: any;
    serviceGetLatestVatReturn: any;
    serviceUpsertVatReturn: any;
    serviceMarkVatReturnAccepted: any;
    serviceListVatSubmissions: any;
  };
};

const apiWithComplianceLedger = api as typeof api & {
  complianceLedger: {
    serviceListComplianceJournalEntries: any;
    serviceUpsertComplianceJournalEntry: any;
    serviceDeleteComplianceJournalEntryBySource: any;
    serviceRebuildDerivedComplianceJournalEntries: any;
  };
};

const apiWithYearEndPacks = api as typeof api & {
  yearEndPacks: {
    serviceUpsertYearEndPack: any;
    serviceGetYearEndPackByPeriod: any;
  };
};

const apiWithCorporationTaxAdjustments = api as typeof api & {
  corporationTaxAdjustments: {
    serviceListCorporationTaxAdjustmentsForPeriod: any;
    serviceUpsertCorporationTaxAdjustment: any;
    serviceDeleteCorporationTaxAdjustment: any;
  };
};

const apiWithCloseCompanyLoansSchedules = api as typeof api & {
  closeCompanyLoansSchedules: {
    serviceGetCloseCompanyLoansScheduleByPeriod: any;
    serviceUpsertCloseCompanyLoansSchedule: any;
    serviceDeleteCloseCompanyLoansSchedule: any;
  };
};

const apiWithCorporationTaxRateSchedules = api as typeof api & {
  corporationTaxRateSchedules: {
    serviceGetCorporationTaxRateScheduleByPeriod: any;
    serviceUpsertCorporationTaxRateSchedule: any;
    serviceDeleteCorporationTaxRateSchedule: any;
  };
};

const apiWithPayrollRuns = api as typeof api & {
  payrollRuns: {
    serviceListPayrollRuns: any;
    serviceGetPayrollRunByPeriod: any;
    serviceUpsertPayrollRun: any;
  };
};

const apiWithTransactionAttachments = api as typeof api & {
  transactionAttachments: {
    serviceCreateTransactionAttachments: any;
    serviceGetTransactionAttachment: any;
    serviceGetTransactionAttachmentsByIds: any;
    serviceGetTransactionAttachmentsForTransactionIds: any;
    serviceGetTransactionAttachmentsByPathKeys: any;
    serviceGetTransactionIdsWithAttachments: any;
    serviceDeleteTransactionAttachment: any;
    serviceDeleteTransactionAttachmentsByIds: any;
    serviceDeleteTransactionAttachmentsByPathKeys: any;
  };
};

export async function getNotificationSettingsFromConvex(args: {
  userId: ConvexUserId;
  teamId: string;
  notificationType?: string;
  channel?: NotificationChannel;
}) {
  return createClient().query(
    api.foundation.serviceGetNotificationSettings,
    serviceArgs({
      userId: args.userId,
      publicTeamId: args.teamId,
      notificationType: args.notificationType,
      channel: args.channel,
    }),
  ) as Promise<NotificationSetting[]>;
}

export async function getAccountingSyncStatusFromConvex(args: {
  teamId: string;
  transactionIds?: string[];
  provider?: AccountingSyncProvider;
}) {
  return createClient().query(
    apiWithAccountingSync.accountingSync.serviceGetAccountingSyncStatus,
    serviceArgs({
      publicTeamId: args.teamId,
      transactionIds: args.transactionIds,
      provider: args.provider,
    }),
  ) as Promise<AccountingSyncRecord[]>;
}

export async function upsertAccountingSyncRecordInConvex(args: {
  id?: string;
  transactionId: string;
  teamId: string;
  provider: AccountingSyncProvider;
  providerTenantId: string;
  providerTransactionId?: string;
  syncedAttachmentMapping?: Record<string, string | null>;
  syncType?: "manual";
  status?: AccountingSyncStatus;
  errorMessage?: string;
  errorCode?: string;
  providerEntityType?: string;
  createdAt?: string;
  syncedAt?: string;
}) {
  return createClient().mutation(
    apiWithAccountingSync.accountingSync.serviceUpsertAccountingSyncRecord,
    serviceArgs({
      publicSyncRecordId: args.id,
      publicTeamId: args.teamId,
      transactionId: args.transactionId,
      provider: args.provider,
      providerTenantId: args.providerTenantId,
      providerTransactionId: args.providerTransactionId,
      syncedAttachmentMapping: args.syncedAttachmentMapping,
      syncType: args.syncType,
      status: args.status,
      errorMessage: args.errorMessage,
      errorCode: args.errorCode,
      providerEntityType: args.providerEntityType,
      createdAt: args.createdAt,
      syncedAt: args.syncedAt,
    }),
  ) as Promise<AccountingSyncRecord>;
}

export async function deleteAccountingSyncRecordsInConvex(args: {
  teamId: string;
  transactionIds: string[];
  provider?: AccountingSyncProvider;
}) {
  return createClient().mutation(
    apiWithAccountingSync.accountingSync.serviceDeleteAccountingSyncRecords,
    serviceArgs({
      publicTeamId: args.teamId,
      transactionIds: args.transactionIds,
      provider: args.provider,
    }),
  ) as Promise<{ count: number }>;
}

export async function updateSyncedAttachmentMappingInConvex(args: {
  syncRecordId: string;
  syncedAttachmentMapping: Record<string, string | null>;
  status?: Exclude<AccountingSyncStatus, "pending">;
  errorMessage?: string | null;
  errorCode?: string | null;
}) {
  return createClient().mutation(
    apiWithAccountingSync.accountingSync.serviceUpdateSyncedAttachmentMapping,
    serviceArgs({
      syncRecordId: args.syncRecordId,
      syncedAttachmentMapping: args.syncedAttachmentMapping,
      status: args.status,
      errorMessage: args.errorMessage,
      errorCode: args.errorCode,
    }),
  ) as Promise<AccountingSyncRecord | null>;
}

export async function listTeamsForUserFromConvexIdentity(args: {
  userId?: ConvexUserId;
  email?: string | null;
}) {
  return createClient().query(
    api.identity.serviceListTeamsByUserId,
    serviceArgs({
      userId: args.userId,
      email: args.email ?? undefined,
    }),
  ) as Promise<TeamListIdentityRecord[]>;
}

export async function listAllTeamsFromConvexIdentity() {
  return createClient().query(
    api.identity.serviceListAllTeams,
    serviceArgs({}),
  ) as Promise<TeamIdentityRecord[]>;
}

export async function getUserByIdFromConvexIdentity(args: {
  userId: ConvexUserId;
}) {
  return createClient().query(
    api.identity.serviceGetUserById,
    serviceArgs({
      userId: args.userId,
    }),
  ) as Promise<CurrentUserIdentityRecord | null>;
}

export async function getUserByEmailFromConvexIdentity(args: {
  email: string;
}) {
  return createClient().query(
    api.identity.serviceGetUserById,
    serviceArgs({
      email: args.email,
    }),
  ) as Promise<CurrentUserIdentityRecord | null>;
}

export async function updateUserInConvexIdentity(
  args: UpdateUserInConvexIdentityInput,
) {
  return createClient().mutation(
    api.identity.serviceUpdateUserById,
    serviceArgs({
      userId: args.userId,
      currentEmail: args.currentEmail ?? undefined,
      fullName: args.fullName,
      email: args.email,
      avatarUrl: args.avatarUrl,
      locale: args.locale,
      weekStartsOnMonday: args.weekStartsOnMonday,
      timezone: args.timezone,
      timezoneAutoSync: args.timezoneAutoSync,
      timeFormat: args.timeFormat,
      dateFormat: args.dateFormat,
    }),
  ) as Promise<CurrentUserIdentityRecord | null>;
}

export async function getTeamByIdFromConvexIdentity(args: { teamId: string }) {
  return createClient().query(
    api.identity.serviceGetTeamByPublicTeamId,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<TeamIdentityRecord | null>;
}

export async function updateTeamByIdInConvexIdentity(
  args: UpdateTeamInConvexIdentityInput,
) {
  return createClient().mutation(
    api.identity.serviceUpdateTeamByPublicTeamId,
    serviceArgs({
      publicTeamId: args.teamId,
      name: args.name,
      logoUrl: args.logoUrl,
      email: args.email,
      baseCurrency: args.baseCurrency,
      countryCode: args.countryCode,
      fiscalYearStartMonth: args.fiscalYearStartMonth,
      exportSettings: args.exportSettings,
      subscriptionStatus: args.subscriptionStatus,
      stripeAccountId: args.stripeAccountId,
      stripeConnectStatus: args.stripeConnectStatus,
      companyType: args.companyType,
      heardAbout: args.heardAbout,
      canceledAt: args.canceledAt,
      plan: args.plan,
    }),
  ) as Promise<TeamIdentityRecord | null>;
}

export async function getTeamByInboxIdFromConvexIdentity(args: {
  inboxId: string;
}) {
  return createClient().query(
    api.identity.serviceGetTeamByInboxId,
    serviceArgs({
      inboxId: args.inboxId,
    }),
  ) as Promise<TeamIdentityRecord | null>;
}

export async function getTeamByStripeAccountIdFromConvexIdentity(args: {
  stripeAccountId: string;
}) {
  return createClient().query(
    api.identity.serviceGetTeamByStripeAccountId,
    serviceArgs({
      stripeAccountId: args.stripeAccountId,
    }),
  ) as Promise<TeamIdentityRecord | null>;
}

export async function listInsightEligibleTeamsFromConvexIdentity(args?: {
  enabledTeamIds?: string[];
  cursor?: string | null;
  limit?: number;
  trialEligibilityDays?: number;
}) {
  return createClient().query(
    api.identity.serviceListInsightEligibleTeams,
    serviceArgs({
      enabledTeamIds: args?.enabledTeamIds,
      cursor: args?.cursor,
      limit: args?.limit,
      trialEligibilityDays: args?.trialEligibilityDays,
    }),
  ) as Promise<InsightEligibleTeamRecord[]>;
}

export async function getTeamMembersFromConvexIdentity(args: {
  teamId: string;
}) {
  return createClient().query(
    api.identity.serviceGetTeamMembersByPublicTeamId,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<TeamMemberIdentityRecord[]>;
}

export async function createTeamForUserInConvexIdentity(
  args: CreateTeamForUserInConvexIdentityInput,
) {
  const teamId = (await createClient().mutation(
    api.identity.serviceCreateTeamForUserId,
    serviceArgs({
      userId: args.userId,
      email: args.email ?? undefined,
      publicTeamId: args.teamId ?? undefined,
      name: args.name,
      inboxId: args.inboxId ?? undefined,
      baseCurrency: args.baseCurrency,
      countryCode: args.countryCode,
      fiscalYearStartMonth: args.fiscalYearStartMonth,
      logoUrl: args.logoUrl,
      companyType: args.companyType,
      heardAbout: args.heardAbout,
      switchTeam: args.switchTeam,
    }),
  )) as string | null;

  if (!teamId) {
    return null;
  }

  return getTeamByIdFromConvexIdentity({ teamId });
}

export async function deleteTeamByIdInConvexIdentity(args: { teamId: string }) {
  return createClient().mutation(
    api.identity.serviceDeleteTeamByPublicTeamId,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<{ id: string } | null>;
}

export async function deleteUserInConvexIdentity(args: {
  userId?: ConvexUserId;
  email?: string | null;
}) {
  return createClient().mutation(
    api.identity.serviceDeleteUserById,
    serviceArgs({
      userId: args.userId,
      email: args.email ?? undefined,
    }),
  ) as Promise<{ id: string } | null>;
}

export async function getCustomerByIdFromConvex(args: {
  teamId: string;
  customerId: string;
}) {
  return createClient().query(
    api.customers.serviceGetCustomerById,
    serviceArgs({
      teamId: args.teamId,
      customerId: args.customerId,
    }),
  ) as Promise<CustomerRecord | null>;
}

export async function getCustomersByIdsFromConvex(args: {
  teamId: string;
  customerIds: string[];
}) {
  return createClient().query(
    api.customers.serviceGetCustomersByIds,
    serviceArgs({
      teamId: args.teamId,
      customerIds: args.customerIds,
    }),
  ) as Promise<CustomerRecord[]>;
}

export async function getCustomersFromConvex(args: { teamId: string }) {
  return createClient().query(
    api.customers.serviceListCustomers,
    serviceArgs({
      teamId: args.teamId,
    }),
  ) as Promise<CustomerRecord[]>;
}

export async function getCustomersPageFromConvex(args: {
  teamId: string;
  cursor?: string | null;
  pageSize: number;
  order?: "asc" | "desc";
}) {
  return createClient().query(
    convexApi["customers"].serviceListCustomersPage,
    serviceArgs({
      teamId: args.teamId,
      order: args.order,
      paginationOpts: {
        numItems: args.pageSize,
        cursor: args.cursor ?? null,
      },
    }),
  ) as Promise<{
    page: CustomerRecord[];
    isDone: boolean;
    continueCursor: string;
  }>;
}

export async function upsertCustomerInConvex(
  args: UpsertCustomerInConvexInput,
) {
  return createClient().mutation(
    api.customers.serviceUpsertCustomer,
    serviceArgs({
      teamId: args.teamId,
      id: args.id ?? undefined,
      createdAt: args.createdAt ?? undefined,
      name: args.name,
      email: args.email,
      billingEmail: args.billingEmail,
      country: args.country,
      addressLine1: args.addressLine1,
      addressLine2: args.addressLine2,
      city: args.city,
      state: args.state,
      zip: args.zip,
      note: args.note,
      website: args.website,
      phone: args.phone,
      vatNumber: args.vatNumber,
      countryCode: args.countryCode,
      token: args.token,
      contact: args.contact,
      status: args.status,
      preferredCurrency: args.preferredCurrency,
      defaultPaymentTerms: args.defaultPaymentTerms,
      isArchived: args.isArchived,
      source: args.source,
      externalId: args.externalId,
      logoUrl: args.logoUrl,
      description: args.description,
      industry: args.industry,
      companyType: args.companyType,
      employeeCount: args.employeeCount,
      foundedYear: args.foundedYear,
      estimatedRevenue: args.estimatedRevenue,
      fundingStage: args.fundingStage,
      totalFunding: args.totalFunding,
      headquartersLocation: args.headquartersLocation,
      timezone: args.timezone,
      linkedinUrl: args.linkedinUrl,
      twitterUrl: args.twitterUrl,
      instagramUrl: args.instagramUrl,
      facebookUrl: args.facebookUrl,
      ceoName: args.ceoName,
      financeContact: args.financeContact,
      financeContactEmail: args.financeContactEmail,
      primaryLanguage: args.primaryLanguage,
      fiscalYearEnd: args.fiscalYearEnd,
      enrichmentStatus: args.enrichmentStatus,
      enrichedAt: args.enrichedAt,
      portalEnabled: args.portalEnabled,
      portalId: args.portalId,
    }),
  ) as Promise<CustomerRecord>;
}

export async function deleteCustomerInConvex(args: {
  teamId: string;
  customerId: string;
}) {
  return createClient().mutation(
    api.customers.serviceDeleteCustomer,
    serviceArgs({
      teamId: args.teamId,
      customerId: args.customerId,
    }),
  ) as Promise<{ id: string } | null>;
}

export async function toggleCustomerPortalInConvex(args: {
  teamId: string;
  customerId: string;
  enabled: boolean;
}) {
  return createClient().mutation(
    api.customers.serviceToggleCustomerPortal,
    serviceArgs({
      teamId: args.teamId,
      customerId: args.customerId,
      enabled: args.enabled,
    }),
  ) as Promise<{
    id: string;
    portalEnabled: boolean;
    portalId: string | null;
  }>;
}

export async function getCustomerByPortalIdFromConvex(args: {
  portalId: string;
}) {
  return createClient().query(
    api.customers.serviceGetCustomerByPortalId,
    serviceArgs({
      portalId: args.portalId,
    }),
  ) as Promise<CustomerRecord | null>;
}

export async function getCustomerForEnrichmentFromConvex(args: {
  teamId: string;
  customerId: string;
}) {
  return createClient().query(
    api.customers.serviceGetCustomerForEnrichment,
    serviceArgs({
      teamId: args.teamId,
      customerId: args.customerId,
    }),
  ) as Promise<CustomerForEnrichmentRecord | null>;
}

export async function updateCustomerEnrichmentStatusInConvex(args: {
  customerId: string;
  status: "pending" | "processing" | "completed" | "failed" | null;
}) {
  return createClient().mutation(
    api.customers.serviceUpdateCustomerEnrichmentStatus,
    serviceArgs({
      customerId: args.customerId,
      status: args.status,
    }),
  ) as Promise<{ id: string } | null>;
}

export async function updateCustomerEnrichmentInConvex(args: {
  teamId: string;
  customerId: string;
  data: CustomerEnrichmentUpdateRecord;
}) {
  return createClient().mutation(
    api.customers.serviceUpdateCustomerEnrichment,
    serviceArgs({
      teamId: args.teamId,
      customerId: args.customerId,
      description: args.data.description,
      industry: args.data.industry,
      companyType: args.data.companyType,
      employeeCount: args.data.employeeCount,
      foundedYear: args.data.foundedYear,
      estimatedRevenue: args.data.estimatedRevenue,
      fundingStage: args.data.fundingStage,
      totalFunding: args.data.totalFunding,
      headquartersLocation: args.data.headquartersLocation,
      timezone: args.data.timezone,
      linkedinUrl: args.data.linkedinUrl,
      twitterUrl: args.data.twitterUrl,
      instagramUrl: args.data.instagramUrl,
      facebookUrl: args.data.facebookUrl,
      ceoName: args.data.ceoName,
      financeContact: args.data.financeContact,
      financeContactEmail: args.data.financeContactEmail,
      primaryLanguage: args.data.primaryLanguage,
      fiscalYearEnd: args.data.fiscalYearEnd,
      vatNumber: args.data.vatNumber,
    }),
  ) as Promise<{ id: string } | null>;
}

export async function markCustomerEnrichmentFailedInConvex(args: {
  customerId: string;
}) {
  return createClient().mutation(
    api.customers.serviceMarkCustomerEnrichmentFailed,
    serviceArgs({
      customerId: args.customerId,
    }),
  ) as Promise<{ id: string } | null>;
}

export async function getCustomersNeedingEnrichmentFromConvex(args: {
  teamId: string;
  limit?: number;
}) {
  return createClient().query(
    api.customers.serviceGetCustomersNeedingEnrichment,
    serviceArgs({
      teamId: args.teamId,
      limit: args.limit,
    }),
  ) as Promise<CustomerForEnrichmentRecord[]>;
}

export async function clearCustomerEnrichmentInConvex(args: {
  teamId: string;
  customerId: string;
}) {
  return createClient().mutation(
    api.customers.serviceClearCustomerEnrichment,
    serviceArgs({
      teamId: args.teamId,
      customerId: args.customerId,
    }),
  ) as Promise<{ id: string } | null>;
}

export async function getInboxBlocklistFromConvex(args: { teamId: string }) {
  return createClient().query(
    api.inboxBlocklist.serviceGetInboxBlocklist,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<InboxBlocklistRecord[]>;
}

export async function createInboxBlocklistInConvex(args: {
  teamId: string;
  type: InboxBlocklistType;
  value: string;
}) {
  return createClient().mutation(
    api.inboxBlocklist.serviceCreateInboxBlocklist,
    serviceArgs({
      publicTeamId: args.teamId,
      type: args.type,
      value: args.value,
    }),
  ) as Promise<InboxBlocklistRecord>;
}

export async function deleteInboxBlocklistInConvex(args: {
  teamId: string;
  id: string;
}) {
  return createClient().mutation(
    api.inboxBlocklist.serviceDeleteInboxBlocklist,
    serviceArgs({
      publicTeamId: args.teamId,
      inboxBlocklistId: args.id,
    }),
  ) as Promise<InboxBlocklistRecord | null>;
}

export async function getInboxAccountsFromConvex(args: { teamId: string }) {
  return createClient().query(
    api.inboxAccounts.serviceGetInboxAccounts,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<InboxAccountListRecord[]>;
}

export async function getInboxAccountsByIdsFromConvex(args: { ids: string[] }) {
  return createClient().query(
    api.inboxAccounts.serviceGetInboxAccountsByIds,
    serviceArgs({
      ids: args.ids,
    }),
  ) as Promise<InboxAccountListRecord[]>;
}

export async function getInboxAccountByIdFromConvex(args: {
  id: string;
  teamId: string;
}) {
  return createClient().query(
    api.inboxAccounts.serviceGetInboxAccountById,
    serviceArgs({
      inboxAccountId: args.id,
      publicTeamId: args.teamId,
    }),
  ) as Promise<InboxAccountRecord | null>;
}

export async function deleteInboxAccountInConvex(args: {
  id: string;
  teamId: string;
}) {
  return createClient().mutation(
    api.inboxAccounts.serviceDeleteInboxAccount,
    serviceArgs({
      inboxAccountId: args.id,
      publicTeamId: args.teamId,
    }),
  ) as Promise<{ id: string; scheduleId: string | null } | null>;
}

export async function updateInboxAccountInConvex(
  args: UpdateInboxAccountInput,
) {
  return createClient().mutation(
    api.inboxAccounts.serviceUpdateInboxAccount,
    serviceArgs(args),
  ) as Promise<{ id: string } | null>;
}

export async function upsertInboxAccountInConvex(
  args: UpsertInboxAccountInput,
) {
  return createClient().mutation(
    api.inboxAccounts.serviceUpsertInboxAccount,
    serviceArgs({
      publicTeamId: args.teamId,
      provider: args.provider,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      email: args.email,
      lastAccessed: args.lastAccessed,
      externalId: args.externalId,
      expiryDate: args.expiryDate,
    }),
  ) as Promise<{
    id: string;
    provider: InboxAccountProvider;
    external_id: string;
  }>;
}

export async function getInboxAccountInfoFromConvex(args: { id: string }) {
  return createClient().query(
    api.inboxAccounts.serviceGetInboxAccountInfo,
    serviceArgs({
      id: args.id,
    }),
  ) as Promise<InboxAccountInfoRecord | null>;
}

export async function getInboxItemsFromConvex(args: {
  teamId: string;
  ids?: string[];
  referenceIds?: string[];
  groupedInboxIds?: string[];
  transactionIds?: string[];
  invoiceNumber?: string | null;
  date?: string | null;
  filePath?: string[];
  statuses?: InboxItemStatus[];
}) {
  return createClient().query(
    api.inbox.serviceGetInboxItems,
    serviceArgs({
      publicTeamId: args.teamId,
      ids: args.ids,
      referenceIds: args.referenceIds,
      groupedInboxIds: args.groupedInboxIds,
      transactionIds: args.transactionIds,
      invoiceNumber: args.invoiceNumber,
      date: args.date,
      filePath: args.filePath,
      statuses: args.statuses,
    }),
  ) as Promise<InboxItemRecord[]>;
}

export async function searchInboxItemsFromConvex(args: {
  teamId: string;
  query: string;
  limit?: number;
}) {
  return createClient().query(
    convexApi["inbox"].serviceSearchInboxItems,
    serviceArgs({
      publicTeamId: args.teamId,
      query: args.query,
      limit: args.limit,
    }),
  ) as Promise<InboxItemRecord[]>;
}

export async function getInboxItemsByAmountRangeFromConvex(args: {
  teamId: string;
  minAmount: number;
  maxAmount: number;
  limit?: number;
}) {
  return createClient().query(
    convexApi["inbox"].serviceGetInboxItemsByAmountRange,
    serviceArgs({
      publicTeamId: args.teamId,
      minAmount: args.minAmount,
      maxAmount: args.maxAmount,
      limit: args.limit,
    }),
  ) as Promise<InboxItemRecord[]>;
}

export async function getInboxItemsByDatePageFromConvex(args: {
  teamId: string;
  cursor?: string | null;
  pageSize: number;
  order?: "asc" | "desc";
  dateGte?: string | null;
  dateLte?: string | null;
}) {
  return createClient().query(
    convexApi["inbox"].serviceListInboxItemsByDatePage,
    serviceArgs({
      publicTeamId: args.teamId,
      order: args.order,
      dateGte: args.dateGte,
      dateLte: args.dateLte,
      paginationOpts: {
        numItems: args.pageSize,
        cursor: args.cursor ?? null,
      },
    }),
  ) as Promise<{
    page: InboxItemRecord[];
    isDone: boolean;
    continueCursor: string;
  }>;
}

export async function getInboxItemsPageFromConvex(args: {
  teamId: string;
  cursor?: string | null;
  pageSize: number;
  status?: InboxItemStatus;
  order?: "asc" | "desc";
  createdAtFrom?: string;
  createdAtTo?: string;
}) {
  return createClient().query(
    convexApi["inbox"].serviceListInboxItemsPage,
    serviceArgs({
      publicTeamId: args.teamId,
      status: args.status,
      order: args.order,
      createdAtFrom: args.createdAtFrom,
      createdAtTo: args.createdAtTo,
      paginationOpts: {
        numItems: args.pageSize,
        cursor: args.cursor ?? null,
      },
    }),
  ) as Promise<{
    page: InboxItemRecord[];
    isDone: boolean;
    continueCursor: string;
  }>;
}

export async function getInboxItemByIdFromConvex(args: {
  teamId: string;
  inboxId: string;
}) {
  return createClient().query(
    api.inbox.serviceGetInboxItemById,
    serviceArgs({
      publicTeamId: args.teamId,
      inboxId: args.inboxId,
    }),
  ) as Promise<InboxItemRecord | null>;
}

export async function getInboxItemInfoFromConvex(args: { inboxId: string }) {
  return createClient().query(
    api.inbox.serviceGetInboxItemInfo,
    serviceArgs({
      inboxId: args.inboxId,
    }),
  ) as Promise<InboxItemRecord | null>;
}

export async function getInboxLiabilityAggregateRowsFromConvex(args: {
  teamId: string;
  dateFrom?: string | null;
  dateTo?: string | null;
}) {
  return createClient().query(
    convexApi["inbox"].serviceGetInboxLiabilityAggregateRows,
    serviceArgs({
      publicTeamId: args.teamId,
      dateFrom: args.dateFrom,
      dateTo: args.dateTo,
    }),
  ) as Promise<InboxLiabilityAggregateRowRecord[]>;
}

export async function getAllInboxItemsFromConvex() {
  return createClient().query(
    api.inbox.serviceGetAllInboxItems,
    serviceArgs({}),
  ) as Promise<InboxItemRecord[]>;
}

export async function upsertInboxItemsInConvex(args: {
  items: UpsertInboxItemInConvexInput[];
}) {
  return createClient().mutation(
    api.inbox.serviceUpsertInboxItems,
    serviceArgs({
      items: args.items.map((item) => ({
        publicTeamId: item.teamId,
        id: item.id,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        filePath: item.filePath,
        fileName: item.fileName,
        transactionId: item.transactionId,
        amount: item.amount,
        currency: item.currency,
        contentType: item.contentType,
        size: item.size,
        attachmentId: item.attachmentId,
        date: item.date,
        forwardedTo: item.forwardedTo,
        referenceId: item.referenceId,
        meta: item.meta,
        status: item.status,
        website: item.website,
        senderEmail: item.senderEmail,
        displayName: item.displayName,
        type: item.type,
        description: item.description,
        baseAmount: item.baseAmount,
        baseCurrency: item.baseCurrency,
        taxAmount: item.taxAmount,
        taxRate: item.taxRate,
        taxType: item.taxType,
        inboxAccountId: item.inboxAccountId,
        invoiceNumber: item.invoiceNumber,
        groupedInboxId: item.groupedInboxId,
      })),
    }),
  ) as Promise<InboxItemRecord[]>;
}

export async function getTransactionMatchSuggestionsFromConvex(args: {
  teamId: string;
  inboxId?: string;
  transactionId?: string;
  transactionIds?: string[];
  statuses?: MatchSuggestionStatus[];
}) {
  return createClient().query(
    api.inbox.serviceGetTransactionMatchSuggestions,
    serviceArgs({
      publicTeamId: args.teamId,
      inboxId: args.inboxId,
      transactionId: args.transactionId,
      transactionIds: args.transactionIds,
      statuses: args.statuses,
    }),
  ) as Promise<TransactionMatchSuggestionRecord[]>;
}

export async function getTransactionMatchSuggestionsPageFromConvex(args: {
  teamId: string;
  status: MatchSuggestionStatus;
  cursor?: string | null;
  pageSize: number;
  order?: "asc" | "desc";
  createdAtFrom?: string;
  createdAtTo?: string;
}) {
  return createClient().query(
    convexApi["inbox"].serviceListTransactionMatchSuggestionsPage,
    serviceArgs({
      publicTeamId: args.teamId,
      status: args.status,
      order: args.order,
      createdAtFrom: args.createdAtFrom,
      createdAtTo: args.createdAtTo,
      paginationOpts: {
        numItems: args.pageSize,
        cursor: args.cursor ?? null,
      },
    }),
  ) as Promise<{
    page: TransactionMatchSuggestionRecord[];
    isDone: boolean;
    continueCursor: string;
  }>;
}

export async function upsertTransactionMatchSuggestionsInConvex(args: {
  suggestions: UpsertTransactionMatchSuggestionInConvexInput[];
}) {
  return createClient().mutation(
    api.inbox.serviceUpsertTransactionMatchSuggestions,
    serviceArgs({
      suggestions: args.suggestions.map((suggestion) => ({
        publicTeamId: suggestion.teamId,
        id: suggestion.id,
        inboxId: suggestion.inboxId,
        transactionId: suggestion.transactionId,
        confidenceScore: suggestion.confidenceScore,
        amountScore: suggestion.amountScore,
        currencyScore: suggestion.currencyScore,
        dateScore: suggestion.dateScore,
        nameScore: suggestion.nameScore,
        matchType: suggestion.matchType,
        matchDetails: suggestion.matchDetails,
        status: suggestion.status,
        userActionAt: suggestion.userActionAt,
        userId: suggestion.userId,
        createdAt: suggestion.createdAt,
        updatedAt: suggestion.updatedAt,
      })),
    }),
  ) as Promise<TransactionMatchSuggestionRecord[]>;
}

export async function deleteTransactionMatchSuggestionsInConvex(args: {
  teamId: string;
  suggestionIds?: string[];
  inboxIds?: string[];
}) {
  return createClient().mutation(
    api.inbox.serviceDeleteTransactionMatchSuggestions,
    serviceArgs({
      publicTeamId: args.teamId,
      suggestionIds: args.suggestionIds,
      inboxIds: args.inboxIds,
    }),
  ) as Promise<string[]>;
}

export async function getShortLinkByShortIdFromConvex(args: {
  shortId: string;
}) {
  return createClient().query(
    api.shortLinks.serviceGetShortLinkByShortId,
    serviceArgs({
      shortId: args.shortId,
    }),
  ) as Promise<ShortLinkRecord | null>;
}

export async function createShortLinkInConvex(args: {
  teamId: string;
  userId: ConvexUserId;
  url: string;
  type: "redirect" | "download";
  fileName?: string;
  mimeType?: string;
  size?: number;
  expiresAt?: string;
}) {
  return createClient().mutation(
    api.shortLinks.serviceCreateShortLink,
    serviceArgs({
      publicTeamId: args.teamId,
      userId: args.userId,
      url: args.url,
      type: args.type,
      fileName: args.fileName,
      mimeType: args.mimeType,
      size: args.size,
      expiresAt: args.expiresAt,
    }),
  ) as Promise<CreatedShortLinkRecord>;
}

export async function getExchangeRatesForTargetFromConvex(args: {
  target: string;
}) {
  return createClient().query(
    api.exchangeRates.serviceGetExchangeRatesForTarget,
    serviceArgs({
      target: args.target,
    }),
  ) as Promise<ExchangeRateRecord[]>;
}

export async function upsertExchangeRatesInConvex(args: {
  rates: ExchangeRateRecord[];
}) {
  return createClient().mutation(
    api.exchangeRates.serviceUpsertExchangeRates,
    serviceArgs({
      rates: args.rates,
    }),
  ) as Promise<{ processed: number }>;
}

export async function getInstitutionsFromConvex(args: {
  countryCode: string;
  q?: string;
  limit?: number;
  excludeProviders?: InstitutionProvider[];
}) {
  return createClient().query(
    api.institutions.serviceGetInstitutions,
    serviceArgs({
      countryCode: args.countryCode,
      q: args.q,
      limit: args.limit,
      excludeProviders: args.excludeProviders,
    }),
  ) as Promise<InstitutionRecord[]>;
}

export async function getInstitutionByIdFromConvex(args: { id: string }) {
  return createClient().query(
    api.institutions.serviceGetInstitutionById,
    serviceArgs({
      id: args.id,
    }),
  ) as Promise<InstitutionRecord | null>;
}

export async function updateInstitutionUsageInConvex(args: { id: string }) {
  return createClient().mutation(
    api.institutions.serviceUpdateInstitutionUsage,
    serviceArgs({
      id: args.id,
    }),
  ) as Promise<InstitutionRecord | null>;
}

export async function upsertInstitutionsInConvex(args: {
  institutions: UpsertInstitutionInput[];
}) {
  return createClient().mutation(
    api.institutions.serviceUpsertInstitutions,
    serviceArgs({
      institutions: args.institutions,
    }),
  ) as Promise<number>;
}

export async function getActiveInstitutionIdsFromConvex(args?: {
  providers?: InstitutionProvider[];
}) {
  return createClient().query(
    api.institutions.serviceGetActiveInstitutionIds,
    serviceArgs({
      providers: args?.providers,
    }),
  ) as Promise<string[]>;
}

export async function markInstitutionsRemovedInConvex(args: { ids: string[] }) {
  return createClient().mutation(
    api.institutions.serviceMarkInstitutionsRemoved,
    serviceArgs({
      ids: args.ids,
    }),
  ) as Promise<number>;
}

export async function getBankAccountsFromConvex(args: {
  teamId: string;
  enabled?: boolean;
  manual?: boolean;
}) {
  return createClient().query(
    api.bankAccounts.serviceGetBankAccounts,
    serviceArgs({
      publicTeamId: args.teamId,
      enabled: args.enabled,
      manual: args.manual,
    }),
  ) as Promise<BankAccountRecord[]>;
}

export async function getBankAccountByIdFromConvex(args: {
  id: string;
  teamId: string;
}) {
  return createClient().query(
    api.bankAccounts.serviceGetBankAccountById,
    serviceArgs({
      id: args.id,
      publicTeamId: args.teamId,
    }),
  ) as Promise<BankAccountRecord | null>;
}

export async function getBankAccountTeamIdFromConvex(args: { id: string }) {
  return createClient().query(
    api.bankAccounts.serviceGetBankAccountTeamId,
    serviceArgs({
      id: args.id,
    }),
  ) as Promise<string | null>;
}

export async function getBankAccountsCurrenciesFromConvex(args: {
  teamId: string;
}) {
  return createClient().query(
    api.bankAccounts.serviceGetBankAccountsCurrencies,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<BankAccountCurrencyRecord[]>;
}

export async function getBankAccountsBalancesFromConvex(args: {
  teamId: string;
}) {
  return createClient().query(
    api.bankAccounts.serviceGetBankAccountsBalances,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<BankAccountBalanceRecord[]>;
}

export async function createBankAccountInConvex(
  args: CreateBankAccountInConvexInput,
) {
  return createClient().mutation(
    api.bankAccounts.serviceCreateBankAccount,
    serviceArgs({
      id: args.id,
      publicTeamId: args.teamId,
      userId: args.userId,
      name: args.name,
      currency: args.currency,
      manual: args.manual,
      accountId: args.accountId,
      type: args.type,
    }),
  ) as Promise<BankAccountRecord>;
}

export async function updateBankAccountInConvex(
  args: UpdateBankAccountInConvexInput,
) {
  return createClient().mutation(
    api.bankAccounts.servicePatchBankAccountByLegacyId,
    serviceArgs({
      bankAccountId: args.id,
      publicTeamId: args.teamId,
      ...args,
      id: undefined,
      teamId: undefined,
    }),
  ) as Promise<BankAccountRecord | null>;
}

export async function patchBankAccountInConvex(
  args: PatchBankAccountInConvexInput,
) {
  return updateBankAccountInConvex(args);
}

export async function deleteBankAccountInConvex(args: {
  id: string;
  teamId: string;
}) {
  return createClient().mutation(
    api.bankAccounts.serviceDeleteBankAccount,
    serviceArgs({
      bankAccountId: args.id,
      publicTeamId: args.teamId,
    }),
  ) as Promise<BankAccountRecord | null>;
}

export async function getBankConnectionsFromConvex(args: {
  teamId: string;
  enabled?: boolean;
}) {
  return createClient().query(
    api.bankConnections.serviceGetBankConnections,
    serviceArgs({
      publicTeamId: args.teamId,
      enabled: args.enabled,
    }),
  ) as Promise<BankConnectionRecord[]>;
}

export async function getBankConnectionByIdFromConvex(args: { id: string }) {
  return createClient().query(
    api.bankConnections.serviceGetBankConnectionById,
    serviceArgs({
      id: args.id,
    }),
  ) as Promise<BankConnectionRecord | null>;
}

export async function createBankConnectionInConvex(
  args: CreateBankConnectionInConvexInput,
) {
  return createClient().mutation(
    api.bankConnections.serviceCreateBankConnection,
    serviceArgs({
      id: args.id,
      publicTeamId: args.teamId,
      userId: args.userId,
      provider: args.provider,
      accounts: args.accounts,
      accessToken: args.accessToken,
      enrollmentId: args.enrollmentId,
      referenceId: args.referenceId,
    }),
  ) as Promise<BankConnectionRecord | null>;
}

export async function addProviderAccountsInConvex(
  args: AddProviderAccountsInConvexInput,
) {
  return createClient().mutation(
    api.bankConnections.serviceAddProviderAccounts,
    serviceArgs({
      bankConnectionId: args.connectionId,
      publicTeamId: args.teamId,
      userId: args.userId,
      accounts: args.accounts,
    }),
  ) as Promise<BankAccountRecord[]>;
}

export async function deleteBankConnectionInConvex(args: {
  id: string;
  teamId: string;
}) {
  return createClient().mutation(
    api.bankConnections.serviceDeleteBankConnection,
    serviceArgs({
      bankConnectionId: args.id,
      publicTeamId: args.teamId,
    }),
  ) as Promise<{
    referenceId: string | null;
    provider: BankConnectionProvider | null;
    accessToken: string | null;
  } | null>;
}

export async function reconnectBankConnectionInConvex(args: {
  teamId: string;
  referenceId: string;
  newReferenceId: string;
  expiresAt: string;
}) {
  return createClient().mutation(
    api.bankConnections.serviceReconnectBankConnection,
    serviceArgs({
      publicTeamId: args.teamId,
      referenceId: args.referenceId,
      newReferenceId: args.newReferenceId,
      expiresAt: args.expiresAt,
    }),
  ) as Promise<{ id: string } | null>;
}

export async function getBankAccountDetailsFromConvex(args: {
  accountId: string;
  teamId: string;
}) {
  return createClient().query(
    api.bankAccounts.serviceGetBankAccountDetails,
    serviceArgs({
      accountId: args.accountId,
      publicTeamId: args.teamId,
    }),
  ) as Promise<BankAccountDetailsRecord | null>;
}

export async function getBankConnectionByEnrollmentIdFromConvex(args: {
  enrollmentId: string;
}) {
  return createClient().query(
    api.bankConnections.serviceGetBankConnectionByEnrollmentId,
    serviceArgs({
      enrollmentId: args.enrollmentId,
    }),
  ) as Promise<BankConnectionLookupRecord | null>;
}

export async function getBankConnectionByReferenceIdFromConvex(args: {
  referenceId: string;
}) {
  return createClient().query(
    api.bankConnections.serviceGetBankConnectionByReferenceId,
    serviceArgs({
      referenceId: args.referenceId,
    }),
  ) as Promise<BankConnectionLookupRecord | null>;
}

export async function updateBankConnectionStatusInConvex(args: {
  id: string;
  status: BankConnectionStatus;
}) {
  return createClient().mutation(
    api.bankConnections.serviceUpdateBankConnectionStatus,
    serviceArgs({
      bankConnectionId: args.id,
      status: args.status,
    }),
  ) as Promise<{ id: string } | null>;
}

export async function updateBankConnectionReconnectByIdInConvex(args: {
  id: string;
  teamId: string;
  referenceId?: string;
  accessValidForDays: number;
}) {
  return createClient().mutation(
    api.bankConnections.serviceUpdateBankConnectionReconnectById,
    serviceArgs({
      bankConnectionId: args.id,
      publicTeamId: args.teamId,
      referenceId: args.referenceId,
      accessValidForDays: args.accessValidForDays,
    }),
  ) as Promise<{ id: string } | null>;
}

export async function patchBankConnectionInConvex(
  args: PatchBankConnectionInConvexInput,
) {
  return createClient().mutation(
    api.bankConnections.servicePatchBankConnection,
    serviceArgs({
      bankConnectionId: args.id,
      publicTeamId: args.teamId,
      ...args,
      id: undefined,
      teamId: undefined,
    }),
  ) as Promise<BankConnectionRecord | null>;
}

export async function getBankAccountsWithPaymentInfoFromConvex(args: {
  teamId: string;
}) {
  return createClient().query(
    api.bankAccounts.serviceGetBankAccountsWithPaymentInfo,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<BankAccountWithPaymentInfoRecord[]>;
}

export async function getInvoiceProductsFromConvex(args: {
  teamId: string;
  sortBy?: "popular" | "recent";
  limit?: number;
  includeInactive?: boolean;
  currency?: string | null;
}) {
  return createClient().query(
    api.invoiceProducts.serviceGetInvoiceProducts,
    serviceArgs({
      publicTeamId: args.teamId,
      sortBy: args.sortBy,
      limit: args.limit,
      includeInactive: args.includeInactive,
      currency: args.currency,
    }),
  ) as Promise<InvoiceProductRecord[]>;
}

export async function getInvoiceProductByIdFromConvex(args: {
  teamId: string;
  id: string;
}) {
  return createClient().query(
    api.invoiceProducts.serviceGetInvoiceProductById,
    serviceArgs({
      publicTeamId: args.teamId,
      invoiceProductId: args.id,
    }),
  ) as Promise<InvoiceProductRecord | null>;
}

export async function createInvoiceProductInConvex(args: {
  teamId: string;
  userId: ConvexUserId;
  name: string;
  description?: string | null;
  price?: number | null;
  currency?: string | null;
  unit?: string | null;
  taxRate?: number | null;
  isActive?: boolean;
}) {
  return createClient().mutation(
    api.invoiceProducts.serviceCreateInvoiceProduct,
    serviceArgs({
      publicTeamId: args.teamId,
      userId: args.userId,
      name: args.name,
      description: args.description,
      price: args.price,
      currency: args.currency,
      unit: args.unit,
      taxRate: args.taxRate,
      isActive: args.isActive,
    }),
  ) as Promise<InvoiceProductRecord>;
}

export async function upsertInvoiceProductInConvex(args: {
  teamId: string;
  userId: ConvexUserId;
  name: string;
  description?: string | null;
  price?: number | null;
  currency?: string | null;
  unit?: string | null;
  taxRate?: number | null;
}) {
  return createClient().mutation(
    api.invoiceProducts.serviceUpsertInvoiceProduct,
    serviceArgs({
      publicTeamId: args.teamId,
      userId: args.userId,
      name: args.name,
      description: args.description,
      price: args.price,
      currency: args.currency,
      unit: args.unit,
      taxRate: args.taxRate,
    }),
  ) as Promise<InvoiceProductRecord>;
}

export async function updateInvoiceProductInConvex(args: {
  teamId: string;
  id: string;
  name?: string;
  description?: string | null;
  price?: number | null;
  currency?: string | null;
  unit?: string | null;
  taxRate?: number | null;
  isActive?: boolean;
  usageCount?: number;
  lastUsedAt?: string | null;
}) {
  return createClient().mutation(
    api.invoiceProducts.serviceUpdateInvoiceProduct,
    serviceArgs({
      publicTeamId: args.teamId,
      invoiceProductId: args.id,
      name: args.name,
      description: args.description,
      price: args.price,
      currency: args.currency,
      unit: args.unit,
      taxRate: args.taxRate,
      isActive: args.isActive,
      usageCount: args.usageCount,
      lastUsedAt: args.lastUsedAt,
    }),
  ) as Promise<InvoiceProductRecord | null>;
}

export async function deleteInvoiceProductInConvex(args: {
  teamId: string;
  id: string;
}) {
  return createClient().mutation(
    api.invoiceProducts.serviceDeleteInvoiceProduct,
    serviceArgs({
      publicTeamId: args.teamId,
      invoiceProductId: args.id,
    }),
  ) as Promise<boolean>;
}

export async function incrementInvoiceProductUsageInConvex(args: {
  teamId: string;
  id: string;
}) {
  return createClient().mutation(
    api.invoiceProducts.serviceIncrementInvoiceProductUsage,
    serviceArgs({
      publicTeamId: args.teamId,
      invoiceProductId: args.id,
    }),
  ) as Promise<{ success: boolean }>;
}

export async function getInvoiceTemplatesFromConvex(args: { teamId: string }) {
  return createClient().query(
    api.invoiceTemplates.serviceGetInvoiceTemplates,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<InvoiceTemplateRecord[]>;
}

export async function getInvoiceTemplateByIdFromConvex(args: {
  teamId: string;
  id: string;
}) {
  return createClient().query(
    api.invoiceTemplates.serviceGetInvoiceTemplateById,
    serviceArgs({
      publicTeamId: args.teamId,
      invoiceTemplateId: args.id,
    }),
  ) as Promise<InvoiceTemplateRecord | null>;
}

export async function getDefaultInvoiceTemplateFromConvex(args: {
  teamId: string;
}) {
  return createClient().query(
    api.invoiceTemplates.serviceGetInvoiceTemplate,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<InvoiceTemplateRecord | null>;
}

export async function createInvoiceTemplateInConvex(args: {
  teamId: string;
  name: string;
  isDefault?: boolean;
  templateData?: Omit<InvoiceTemplateRecord, "id" | "name" | "isDefault">;
}) {
  return createClient().mutation(
    api.invoiceTemplates.serviceCreateInvoiceTemplate,
    serviceArgs({
      publicTeamId: args.teamId,
      name: args.name,
      isDefault: args.isDefault,
      templateData: args.templateData,
    }),
  ) as Promise<InvoiceTemplateRecord>;
}

export async function upsertInvoiceTemplateInConvex(args: {
  teamId: string;
  id?: string;
  name?: string;
  templateData?: Omit<InvoiceTemplateRecord, "id" | "name" | "isDefault">;
}) {
  return createClient().mutation(
    api.invoiceTemplates.serviceUpsertInvoiceTemplate,
    serviceArgs({
      publicTeamId: args.teamId,
      invoiceTemplateId: args.id,
      name: args.name,
      templateData: args.templateData,
    }),
  ) as Promise<InvoiceTemplateRecord>;
}

export async function setDefaultInvoiceTemplateInConvex(args: {
  teamId: string;
  id: string;
}) {
  return createClient().mutation(
    api.invoiceTemplates.serviceSetDefaultInvoiceTemplate,
    serviceArgs({
      publicTeamId: args.teamId,
      invoiceTemplateId: args.id,
    }),
  ) as Promise<InvoiceTemplateRecord>;
}

export async function deleteInvoiceTemplateInConvex(args: {
  teamId: string;
  id: string;
}) {
  return createClient().mutation(
    api.invoiceTemplates.serviceDeleteInvoiceTemplate,
    serviceArgs({
      publicTeamId: args.teamId,
      invoiceTemplateId: args.id,
    }),
  ) as Promise<InvoiceTemplateDeleteResult>;
}

export async function getInvoiceTemplateCountFromConvex(args: {
  teamId: string;
}) {
  return createClient().query(
    api.invoiceTemplates.serviceGetInvoiceTemplateCount,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<number>;
}

export async function upsertPublicInvoiceInConvex(args: {
  teamId: string;
  id: string;
  token: string;
  status: string;
  paymentIntentId?: string | null;
  viewedAt?: string | null;
  invoiceNumber?: string | null;
  payload: Record<string, unknown>;
}) {
  return createClient().mutation(
    convexApi["publicInvoices"].serviceUpsertPublicInvoice,
    serviceArgs({
      publicTeamId: args.teamId,
      invoiceId: args.id,
      token: args.token,
      status: args.status,
      paymentIntentId: args.paymentIntentId,
      viewedAt: args.viewedAt,
      invoiceNumber: args.invoiceNumber,
      payload: args.payload,
    }),
  ) as Promise<PublicInvoiceRecord>;
}

export async function getPublicInvoiceByPublicInvoiceIdFromConvex(args: {
  invoiceId: string;
}) {
  return createClient().query(
    convexApi["publicInvoices"].serviceGetPublicInvoiceByPublicInvoiceId,
    serviceArgs({
      publicInvoiceId: args.invoiceId,
    }),
  ) as Promise<PublicInvoiceRecord | null>;
}

export async function getPublicInvoiceByTokenFromConvex(args: {
  token: string;
}) {
  return createClient().query(
    convexApi["publicInvoices"].serviceGetPublicInvoiceByToken,
    serviceArgs({
      token: args.token,
    }),
  ) as Promise<PublicInvoiceRecord | null>;
}

export async function getPublicInvoicesByTeamFromConvex(args: {
  teamId: string;
}) {
  return createClient().query(
    convexApi["publicInvoices"].serviceGetPublicInvoicesByTeam,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<PublicInvoiceRecord[]>;
}

export async function getPublicInvoicesByIdsFromConvex(args: {
  teamId: string;
  invoiceIds: string[];
}) {
  return createClient().query(
    convexApi["publicInvoices"].serviceGetPublicInvoicesByIds,
    serviceArgs({
      publicTeamId: args.teamId,
      invoiceIds: args.invoiceIds,
    }),
  ) as Promise<PublicInvoiceRecord[]>;
}

export async function getPublicInvoicesByCustomerIdsFromConvex(args: {
  teamId: string;
  customerIds: string[];
}) {
  return createClient().query(
    convexApi["publicInvoices"].serviceGetPublicInvoicesByCustomerIds,
    serviceArgs({
      publicTeamId: args.teamId,
      customerIds: args.customerIds,
    }),
  ) as Promise<PublicInvoiceRecord[]>;
}

export async function getInvoiceAggregateRowsFromConvex(args: {
  teamId: string;
  customerId?: string;
  statuses?: string[];
}) {
  return createClient().query(
    convexApi["publicInvoices"].serviceGetInvoiceAggregateRows,
    serviceArgs({
      publicTeamId: args.teamId,
      customerId: args.customerId,
      statuses: args.statuses,
    }),
  ) as Promise<InvoiceAggregateRowRecord[]>;
}

export async function getInvoiceDateAggregateRowsFromConvex(args: {
  teamId: string;
  statuses: string[];
  dateField: InvoiceAggregateDateField;
  dateFrom?: string | null;
  dateTo?: string | null;
  currency?: string | null;
  recurring?: boolean;
}) {
  return createClient().query(
    convexApi["publicInvoices"].serviceGetInvoiceDateAggregateRows,
    serviceArgs({
      publicTeamId: args.teamId,
      statuses: args.statuses,
      dateField: args.dateField,
      dateFrom: args.dateFrom,
      dateTo: args.dateTo,
      currency: args.currency,
      recurring: args.recurring,
    }),
  ) as Promise<InvoiceDateAggregateRowRecord[]>;
}

export async function getInvoiceCustomerDateAggregateRowsFromConvex(args: {
  teamId: string;
  statuses: string[];
  dateField: InvoiceCustomerAggregateDateField;
  dateFrom?: string | null;
  dateTo?: string | null;
  currency?: string | null;
}) {
  return createClient().query(
    convexApi["publicInvoices"].serviceGetInvoiceCustomerDateAggregateRows,
    serviceArgs({
      publicTeamId: args.teamId,
      statuses: args.statuses,
      dateField: args.dateField,
      dateFrom: args.dateFrom,
      dateTo: args.dateTo,
      currency: args.currency,
    }),
  ) as Promise<InvoiceCustomerDateAggregateRowRecord[]>;
}

export async function getInvoiceAnalyticsAggregateRowsFromConvex(args: {
  teamId: string;
  dateField: InvoiceAnalyticsAggregateDateField;
  statuses?: string[];
  dateFrom?: string | null;
  dateTo?: string | null;
  currency?: string | null;
}) {
  return createClient().query(
    convexApi["publicInvoices"].serviceGetInvoiceAnalyticsAggregateRows,
    serviceArgs({
      publicTeamId: args.teamId,
      dateField: args.dateField,
      statuses: args.statuses,
      dateFrom: args.dateFrom,
      dateTo: args.dateTo,
      currency: args.currency,
    }),
  ) as Promise<InvoiceAnalyticsAggregateRowRecord[]>;
}

export async function getInvoiceAgingAggregateRowsFromConvex(args: {
  teamId: string;
  statuses: string[];
  currency?: string | null;
}) {
  return createClient().query(
    convexApi["publicInvoices"].serviceGetInvoiceAgingAggregateRows,
    serviceArgs({
      publicTeamId: args.teamId,
      statuses: args.statuses,
      currency: args.currency,
    }),
  ) as Promise<InvoiceAgingAggregateRowRecord[]>;
}

export async function rebuildInvoiceReportAggregatesInConvex(args: {
  teamId?: string | null;
}) {
  return createClient().mutation(
    convexApi["publicInvoices"].serviceRebuildInvoiceReportAggregates,
    serviceArgs({
      publicTeamId: args.teamId ?? null,
    }),
  ) as Promise<
    Array<{
      teamId: string;
      invoiceCount: number;
      invoiceAggregateRows: number;
      invoiceDateAggregateRows: number;
      invoiceCustomerDateAggregateRows: number;
      invoiceAnalyticsAggregateRows: number;
      invoiceAgingAggregateRows: number;
    }>
  >;
}

export async function getPublicInvoicesPageFromConvex(args: {
  teamId: string;
  cursor?: string | null;
  pageSize: number;
  status?: string;
  order?: "asc" | "desc";
  createdAtFrom?: string;
  createdAtTo?: string;
}) {
  return createClient().query(
    convexApi["publicInvoices"].serviceListPublicInvoicesPage,
    serviceArgs({
      publicTeamId: args.teamId,
      status: args.status,
      order: args.order,
      createdAtFrom: args.createdAtFrom,
      createdAtTo: args.createdAtTo,
      paginationOpts: {
        numItems: args.pageSize,
        cursor: args.cursor ?? null,
      },
    }),
  ) as Promise<{
    page: PublicInvoiceRecord[];
    isDone: boolean;
    continueCursor: string;
  }>;
}

export async function getPublicInvoicesByFiltersFromConvex(args: {
  teamId: string;
  statuses?: string[];
  currency?: string;
  dateField?: PublicInvoiceFilterDateField;
  from?: string;
  to?: string;
}) {
  return createClient().query(
    convexApi["publicInvoices"].serviceGetPublicInvoicesByFilters,
    serviceArgs({
      publicTeamId: args.teamId,
      statuses: args.statuses,
      currency: args.currency,
      dateField: args.dateField,
      from: args.from,
      to: args.to,
    }),
  ) as Promise<PublicInvoiceRecord[]>;
}

export async function getPublicInvoiceByTeamAndInvoiceNumberFromConvex(args: {
  teamId: string;
  invoiceNumber: string;
}) {
  return createClient().query(
    convexApi["publicInvoices"].serviceGetPublicInvoiceByTeamAndInvoiceNumber,
    serviceArgs({
      publicTeamId: args.teamId,
      invoiceNumber: args.invoiceNumber,
    }),
  ) as Promise<PublicInvoiceRecord | null>;
}

export async function getPublicInvoiceByRecurringSequenceFromConvex(args: {
  teamId: string;
  invoiceRecurringId: string;
  recurringSequence: number;
}) {
  return createClient().query(
    convexApi["publicInvoices"].serviceGetPublicInvoiceByRecurringSequence,
    serviceArgs({
      publicTeamId: args.teamId,
      invoiceRecurringId: args.invoiceRecurringId,
      recurringSequence: args.recurringSequence,
    }),
  ) as Promise<PublicInvoiceRecord | null>;
}

export async function getPublicInvoicesByRecurringIdFromConvex(args: {
  teamId: string;
  invoiceRecurringId: string;
  statuses?: string[];
}) {
  return createClient().query(
    convexApi["publicInvoices"].serviceGetPublicInvoicesByRecurringId,
    serviceArgs({
      publicTeamId: args.teamId,
      invoiceRecurringId: args.invoiceRecurringId,
      statuses: args.statuses,
    }),
  ) as Promise<PublicInvoiceRecord[]>;
}

export async function getNextInvoiceNumberPreviewFromConvex(args: {
  teamId: string;
}) {
  return createClient().query(
    convexApi["publicInvoices"].serviceGetNextInvoiceNumberPreview,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<string>;
}

export async function allocateNextInvoiceNumberInConvex(args: {
  teamId: string;
}) {
  return createClient().mutation(
    convexApi["publicInvoices"].serviceAllocateNextInvoiceNumber,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<string>;
}

export async function getPublicInvoicesByStatusesFromConvex(args: {
  statuses: string[];
}) {
  return createClient().query(
    convexApi["publicInvoices"].serviceGetPublicInvoicesByStatuses,
    serviceArgs({
      statuses: args.statuses,
    }),
  ) as Promise<PublicInvoiceRecord[]>;
}

export async function getPublicInvoiceByPaymentIntentIdFromConvex(args: {
  paymentIntentId: string;
}) {
  return createClient().query(
    convexApi["publicInvoices"].serviceGetPublicInvoiceByPaymentIntentId,
    serviceArgs({
      paymentIntentId: args.paymentIntentId,
    }),
  ) as Promise<PublicInvoiceRecord | null>;
}

export async function deletePublicInvoiceInConvex(args: {
  teamId: string;
  id: string;
}) {
  return createClient().mutation(
    convexApi["publicInvoices"].serviceDeletePublicInvoice,
    serviceArgs({
      publicTeamId: args.teamId,
      invoiceId: args.id,
    }),
  ) as Promise<PublicInvoiceRecord | null>;
}

export async function upsertInvoiceRecurringSeriesInConvex(args: {
  teamId: string;
  id: string;
  customerId?: string | null;
  customerName?: string | null;
  status: string;
  nextScheduledAt?: string | null;
  upcomingNotificationSentAt?: string | null;
  payload: Record<string, unknown>;
}) {
  return createClient().mutation(
    convexApi["invoiceRecurringSeries"].serviceUpsertInvoiceRecurringSeries,
    serviceArgs({
      publicTeamId: args.teamId,
      invoiceRecurringId: args.id,
      customerId: args.customerId,
      customerName: args.customerName,
      status: args.status,
      nextScheduledAt: args.nextScheduledAt,
      upcomingNotificationSentAt: args.upcomingNotificationSentAt,
      payload: args.payload,
    }),
  ) as Promise<InvoiceRecurringSeriesRecord>;
}

export async function getInvoiceRecurringSeriesByLegacyIdFromConvex(args: {
  id: string;
}) {
  return createClient().query(
    convexApi["invoiceRecurringSeries"]
      .serviceGetInvoiceRecurringSeriesByLegacyId,
    serviceArgs({
      invoiceRecurringId: args.id,
    }),
  ) as Promise<InvoiceRecurringSeriesRecord | null>;
}

export async function getInvoiceRecurringSeriesByTeamFromConvex(args: {
  teamId: string;
}) {
  return createClient().query(
    convexApi["invoiceRecurringSeries"].serviceGetInvoiceRecurringSeriesByTeam,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<InvoiceRecurringSeriesRecord[]>;
}

export async function getDueInvoiceRecurringSeriesFromConvex(args: {
  before: string;
  limit?: number;
}) {
  return createClient().query(
    convexApi["invoiceRecurringSeries"].serviceGetDueInvoiceRecurringSeries,
    serviceArgs({
      before: args.before,
      limit: args.limit,
    }),
  ) as Promise<InvoiceRecurringSeriesRecord[]>;
}

export async function getUpcomingInvoiceRecurringSeriesFromConvex(args: {
  after: string;
  before: string;
  limit?: number;
}) {
  return createClient().query(
    convexApi["invoiceRecurringSeries"]
      .serviceGetUpcomingInvoiceRecurringSeries,
    serviceArgs({
      after: args.after,
      before: args.before,
      limit: args.limit,
    }),
  ) as Promise<InvoiceRecurringSeriesRecord[]>;
}

export async function upsertTransactionsInConvex(args: {
  teamId: string;
  transactions: UpsertTransactionInConvexInput[];
}) {
  return createClient().mutation(
    convexApi["transactions"].serviceUpsertTransactions,
    serviceArgs({
      publicTeamId: args.teamId,
      transactions: args.transactions,
    }),
  ) as Promise<TransactionRecord[]>;
}

export async function deleteTransactionsInConvex(args: {
  teamId: string;
  transactionIds: string[];
}) {
  return createClient().mutation(
    convexApi["transactions"].serviceDeleteTransactions,
    serviceArgs({
      publicTeamId: args.teamId,
      transactionIds: args.transactionIds,
    }),
  ) as Promise<string[]>;
}

export async function getTransactionByIdFromConvex(args: {
  teamId: string;
  transactionId: string;
}) {
  return createClient().query(
    convexApi["transactions"].serviceGetTransactionById,
    serviceArgs({
      publicTeamId: args.teamId,
      transactionId: args.transactionId,
    }),
  ) as Promise<TransactionRecord | null>;
}

export async function getTransactionInfoFromConvex(args: {
  transactionId: string;
}) {
  return createClient().query(
    convexApi["transactions"].serviceGetTransactionInfo,
    serviceArgs({
      transactionId: args.transactionId,
    }),
  ) as Promise<TransactionRecord | null>;
}

export async function getTransactionsByIdsFromConvex(args: {
  teamId: string;
  transactionIds: string[];
}) {
  return createClient().query(
    convexApi["transactions"].serviceGetTransactionsByIds,
    serviceArgs({
      publicTeamId: args.teamId,
      transactionIds: args.transactionIds,
    }),
  ) as Promise<TransactionRecord[]>;
}

export async function searchTransactionsFromConvex(args: {
  teamId: string;
  query: string;
  dateGte?: string | null;
  dateLte?: string | null;
  statusesNotIn?: TransactionStatus[];
  limit?: number;
}) {
  return createClient().query(
    convexApi["transactions"].serviceSearchTransactions,
    serviceArgs({
      publicTeamId: args.teamId,
      query: args.query,
      dateGte: args.dateGte,
      dateLte: args.dateLte,
      statusesNotIn: args.statusesNotIn,
      limit: args.limit,
    }),
  ) as Promise<TransactionRecord[]>;
}

export async function getTransactionsByAmountRangeFromConvex(args: {
  teamId: string;
  minAmount: number;
  maxAmount: number;
  dateGte?: string | null;
  dateLte?: string | null;
  statusesNotIn?: TransactionStatus[];
  limit?: number;
}) {
  return createClient().query(
    convexApi["transactions"].serviceGetTransactionsByAmountRange,
    serviceArgs({
      publicTeamId: args.teamId,
      minAmount: args.minAmount,
      maxAmount: args.maxAmount,
      dateGte: args.dateGte,
      dateLte: args.dateLte,
      statusesNotIn: args.statusesNotIn,
      limit: args.limit,
    }),
  ) as Promise<TransactionRecord[]>;
}

export async function getAllTransactionsFromConvex() {
  return createClient().query(
    convexApi["transactions"].serviceGetAllTransactions,
    serviceArgs({}),
  ) as Promise<TransactionRecord[]>;
}

export async function getTransactionsFromConvex(args: {
  teamId: string;
  transactionIds?: string[];
  bankAccountId?: string | null;
  enrichmentCompleted?: boolean;
  dateGte?: string | null;
  statusesNotIn?: TransactionStatus[];
  limit?: number;
}) {
  return createClient().query(
    convexApi["transactions"].serviceListTransactions,
    serviceArgs({
      publicTeamId: args.teamId,
      transactionIds: args.transactionIds,
      bankAccountId: args.bankAccountId,
      enrichmentCompleted: args.enrichmentCompleted,
      dateGte: args.dateGte,
      statusesNotIn: args.statusesNotIn,
      limit: args.limit,
    }),
  ) as Promise<TransactionRecord[]>;
}

export async function getTransactionsPageFromConvex(args: {
  teamId: string;
  cursor?: string | null;
  pageSize: number;
  order?: "asc" | "desc";
  dateGte?: string | null;
  dateLte?: string | null;
  statusesNotIn?: TransactionStatus[];
}) {
  return createClient().query(
    apiWithTransactions.transactions.serviceListTransactionsPage,
    serviceArgs({
      publicTeamId: args.teamId,
      dateGte: args.dateGte,
      dateLte: args.dateLte,
      statusesNotIn: args.statusesNotIn,
      order: args.order,
      paginationOpts: {
        numItems: args.pageSize,
        cursor: args.cursor ?? null,
      },
    }),
  ) as Promise<{
    page: TransactionRecord[];
    isDone: boolean;
    continueCursor: string;
  }>;
}

export async function getTransactionMetricAggregateRowsFromConvex(args: {
  teamId: string;
  scope: "base" | "native";
  currency: string;
  dateFrom?: string | null;
  dateTo?: string | null;
}) {
  return createClient().query(
    convexApi["transactions"].serviceGetTransactionMetricAggregateRows,
    serviceArgs({
      publicTeamId: args.teamId,
      scope: args.scope,
      currency: args.currency,
      dateFrom: args.dateFrom,
      dateTo: args.dateTo,
    }),
  ) as Promise<TransactionMetricAggregateRowRecord[]>;
}

export async function getTransactionRecurringAggregateRowsFromConvex(args: {
  teamId: string;
  scope: "base" | "native";
  direction: "income" | "expense";
  currency: string;
  dateFrom?: string | null;
  dateTo?: string | null;
}) {
  return createClient().query(
    convexApi["transactions"].serviceGetTransactionRecurringAggregateRows,
    serviceArgs({
      publicTeamId: args.teamId,
      scope: args.scope,
      direction: args.direction,
      currency: args.currency,
      dateFrom: args.dateFrom,
      dateTo: args.dateTo,
    }),
  ) as Promise<TransactionRecurringAggregateRowRecord[]>;
}

export async function getTransactionTaxAggregateRowsFromConvex(args: {
  teamId: string;
  scope: "base" | "native";
  direction: "income" | "expense";
  currency: string;
  dateFrom?: string | null;
  dateTo?: string | null;
}) {
  return createClient().query(
    convexApi["transactions"].serviceGetTransactionTaxAggregateRows,
    serviceArgs({
      publicTeamId: args.teamId,
      scope: args.scope,
      direction: args.direction,
      currency: args.currency,
      dateFrom: args.dateFrom,
      dateTo: args.dateTo,
    }),
  ) as Promise<TransactionTaxAggregateRowRecord[]>;
}

export async function rebuildTransactionReportAggregatesInConvex(args: {
  teamId?: string | null;
}) {
  return createClient().mutation(
    convexApi["transactions"].serviceRebuildTransactionReportAggregates,
    serviceArgs({
      publicTeamId: args.teamId ?? null,
    }),
  ) as Promise<
    Array<{
      teamId: string;
      transactionCount: number;
      transactionMetricAggregateRows: number;
      transactionRecurringAggregateRows: number;
      transactionTaxAggregateRows: number;
    }>
  >;
}

export async function countTransactionsFromConvex(args: {
  teamId: string;
  bankAccountId?: string | null;
  dateGte?: string | null;
  statusesNotIn?: TransactionStatus[];
}) {
  return createClient().query(
    convexApi["transactions"].serviceCountTransactions,
    serviceArgs({
      publicTeamId: args.teamId,
      bankAccountId: args.bankAccountId,
      dateGte: args.dateGte,
      statusesNotIn: args.statusesNotIn,
    }),
  ) as Promise<number>;
}

export async function getDocumentsFromConvex(args: { teamId: string }) {
  return createClient().query(
    convexApi["documents"].serviceGetDocuments,
    serviceArgs({
      teamId: args.teamId,
    }),
  ) as Promise<DocumentRecord[]>;
}

export async function getDocumentsPageFromConvex(args: {
  teamId: string;
  cursor?: string | null;
  pageSize: number;
  order?: "asc" | "desc";
}) {
  return createClient().query(
    convexApi["documents"].serviceListDocumentsPage,
    serviceArgs({
      teamId: args.teamId,
      order: args.order,
      paginationOpts: {
        numItems: args.pageSize,
        cursor: args.cursor ?? null,
      },
    }),
  ) as Promise<{
    page: DocumentRecord[];
    isDone: boolean;
    continueCursor: string;
  }>;
}

export async function getDocumentsByIdsFromConvex(args: {
  teamId: string;
  documentIds: string[];
}) {
  return createClient().query(
    convexApi["documents"].serviceGetDocumentsByIds,
    serviceArgs({
      teamId: args.teamId,
      documentIds: args.documentIds,
    }),
  ) as Promise<DocumentRecord[]>;
}

export async function getDocumentByIdFromConvex(args: {
  teamId: string;
  documentId: string;
}) {
  return createClient().query(
    convexApi["documents"].serviceGetDocumentById,
    serviceArgs({
      teamId: args.teamId,
      documentId: args.documentId,
    }),
  ) as Promise<DocumentRecord | null>;
}

export async function getDocumentByNameFromConvex(args: {
  teamId: string;
  name: string;
}) {
  return createClient().query(
    convexApi["documents"].serviceGetDocumentByName,
    serviceArgs({
      teamId: args.teamId,
      name: args.name,
    }),
  ) as Promise<DocumentRecord | null>;
}

export async function upsertDocumentsInConvex(args: {
  documents: UpsertDocumentInConvexInput[];
}) {
  return createClient().mutation(
    convexApi["documents"].serviceUpsertDocuments,
    serviceArgs({
      documents: args.documents.map((document) => ({
        teamId: document.teamId,
        id: document.id,
        name: document.name,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
        metadata: document.metadata,
        pathTokens: document.pathTokens,
        parentId: document.parentId,
        objectId: document.objectId,
        ownerId: document.ownerId,
        tag: document.tag,
        title: document.title,
        body: document.body,
        summary: document.summary,
        content: document.content,
        date: document.date,
        language: document.language,
        processingStatus: document.processingStatus,
      })),
    }),
  ) as Promise<DocumentRecord[]>;
}

export async function deleteDocumentInConvex(args: {
  teamId: string;
  id: string;
}) {
  return createClient().mutation(
    convexApi["documents"].serviceDeleteDocument,
    serviceArgs({
      teamId: args.teamId,
      documentId: args.id,
    }),
  ) as Promise<DocumentRecord | null>;
}

export async function updateDocumentsStatusByNamesInConvex(args: {
  teamId: string;
  names: string[];
  processingStatus: DocumentProcessingStatus;
}) {
  return createClient().mutation(
    convexApi["documents"].serviceUpdateDocumentsStatusByNames,
    serviceArgs({
      teamId: args.teamId,
      names: args.names,
      processingStatus: args.processingStatus,
    }),
  ) as Promise<DocumentRecord[]>;
}

export async function updateDocumentByNameInConvex(
  args: UpdateDocumentByNameInConvexInput,
) {
  return createClient().mutation(
    convexApi["documents"].serviceUpdateDocumentByName,
    serviceArgs({
      teamId: args.teamId,
      name: args.name,
      title: args.title,
      summary: args.summary,
      content: args.content,
      body: args.body,
      tag: args.tag,
      date: args.date,
      language: args.language,
      processingStatus: args.processingStatus,
      metadata: args.metadata,
    }),
  ) as Promise<DocumentRecord[]>;
}

export async function updateDocumentProcessingStatusInConvex(args: {
  id: string;
  processingStatus: DocumentProcessingStatus;
}) {
  return createClient().mutation(
    convexApi["documents"].serviceUpdateDocumentProcessingStatus,
    serviceArgs({
      documentId: args.id,
      processingStatus: args.processingStatus,
    }),
  ) as Promise<Array<{ id: string }>>;
}

export async function getDocumentTagEmbeddingsFromConvex(args: {
  slugs: string[];
}) {
  return createClient().query(
    api.documentTagEmbeddings.serviceGetDocumentTagEmbeddings,
    serviceArgs({
      slugs: args.slugs,
    }),
  ) as Promise<DocumentTagEmbeddingRecord[]>;
}

export async function getDocumentTagsFromConvex(args: { teamId: string }) {
  return createClient().query(
    api.documentTags.serviceGetDocumentTags,
    serviceArgs({
      teamId: args.teamId,
    }),
  ) as Promise<DocumentTagRecord[]>;
}

export async function createDocumentTagInConvex(args: {
  teamId: string;
  name: string;
  slug: string;
}) {
  return createClient().mutation(
    api.documentTags.serviceCreateDocumentTag,
    serviceArgs({
      teamId: args.teamId,
      name: args.name,
      slug: args.slug,
    }),
  ) as Promise<DocumentTagRecord>;
}

export async function deleteDocumentTagInConvex(args: {
  teamId: string;
  id: string;
}) {
  return createClient().mutation(
    api.documentTags.serviceDeleteDocumentTag,
    serviceArgs({
      teamId: args.teamId,
      documentTagId: args.id,
    }),
  ) as Promise<{ id: string } | null>;
}

export async function upsertDocumentTagsInConvex(args: {
  tags: UpsertDocumentTagInput[];
}) {
  return createClient().mutation(
    api.documentTags.serviceUpsertDocumentTags,
    serviceArgs({
      tags: args.tags.map((tag) => ({
        teamId: tag.teamId,
        name: tag.name,
        slug: tag.slug,
      })),
    }),
  ) as Promise<Array<{ id: string; slug: string }>>;
}

export async function createDocumentTagAssignmentInConvex(args: {
  teamId: string;
  documentId: string;
  tagId: string;
}) {
  return createClient().mutation(
    api.documentTags.serviceCreateDocumentTagAssignment,
    serviceArgs({
      teamId: args.teamId,
      documentId: args.documentId,
      tagId: args.tagId,
    }),
  ) as Promise<DocumentTagAssignmentRecord>;
}

export async function deleteDocumentTagAssignmentInConvex(args: {
  teamId: string;
  documentId: string;
  tagId: string;
}) {
  return createClient().mutation(
    api.documentTags.serviceDeleteDocumentTagAssignment,
    serviceArgs({
      teamId: args.teamId,
      documentId: args.documentId,
      tagId: args.tagId,
    }),
  ) as Promise<DocumentTagAssignmentRecord | null>;
}

export async function upsertDocumentTagAssignmentsInConvex(args: {
  assignments: UpsertDocumentTagAssignmentInput[];
}) {
  return createClient().mutation(
    api.documentTags.serviceUpsertDocumentTagAssignments,
    serviceArgs({
      assignments: args.assignments.map((assignment) => ({
        teamId: assignment.teamId,
        documentId: assignment.documentId,
        tagId: assignment.tagId,
      })),
    }),
  ) as Promise<DocumentTagAssignmentRecord[]>;
}

export async function getDocumentTagAssignmentsForDocumentIdsFromConvex(args: {
  teamId: string;
  documentIds: string[];
}) {
  return createClient().query(
    api.documentTags.serviceGetDocumentTagAssignmentsForDocumentIds,
    serviceArgs({
      teamId: args.teamId,
      documentIds: args.documentIds,
    }),
  ) as Promise<DocumentTagAssignmentRecord[]>;
}

export async function getDocumentIdsForTagIdsFromConvex(args: {
  teamId: string;
  tagIds: string[];
}) {
  return createClient().query(
    api.documentTags.serviceGetDocumentIdsForTagIds,
    serviceArgs({
      teamId: args.teamId,
      tagIds: args.tagIds,
    }),
  ) as Promise<string[]>;
}

export async function getTagsFromConvex(args: { teamId: string }) {
  return createClient().query(
    api.tags.serviceGetTags,
    serviceArgs({
      teamId: args.teamId,
    }),
  ) as Promise<TagRecord[]>;
}

export async function getTagsByIdsFromConvex(args: {
  teamId: string;
  tagIds: string[];
}) {
  return createClient().query(
    api.tags.serviceGetTagsByIds,
    serviceArgs({
      teamId: args.teamId,
      tagIds: args.tagIds,
    }),
  ) as Promise<TagRecord[]>;
}

export async function getTagByIdFromConvex(args: {
  teamId: string;
  tagId: string;
}) {
  return createClient().query(
    api.tags.serviceGetTagById,
    serviceArgs({
      teamId: args.teamId,
      tagId: args.tagId,
    }),
  ) as Promise<TagRecord | null>;
}

export async function createTagInConvex(args: {
  teamId: string;
  name: string;
}) {
  return createClient().mutation(
    api.tags.serviceCreateTag,
    serviceArgs({
      teamId: args.teamId,
      name: args.name,
    }),
  ) as Promise<TagRecord>;
}

export async function updateTagInConvex(args: {
  teamId: string;
  tagId: string;
  name: string;
}) {
  return createClient().mutation(
    api.tags.serviceUpdateTag,
    serviceArgs({
      teamId: args.teamId,
      tagId: args.tagId,
      name: args.name,
    }),
  ) as Promise<TagRecord>;
}

export async function deleteTagInConvex(args: {
  teamId: string;
  tagId: string;
}) {
  return createClient().mutation(
    api.tags.serviceDeleteTag,
    serviceArgs({
      teamId: args.teamId,
      tagId: args.tagId,
    }),
  ) as Promise<{ id: string; name: string } | null>;
}

export async function getTransactionTagAssignmentsForTransactionIdsFromConvex(args: {
  teamId: string;
  transactionIds: string[];
}) {
  return createClient().query(
    api.transactionTags.serviceGetTransactionTagAssignmentsForTransactionIds,
    serviceArgs({
      teamId: args.teamId,
      transactionIds: args.transactionIds,
    }),
  ) as Promise<TransactionTagAssignmentRecord[]>;
}

export async function getTransactionIdsForTagIdsFromConvex(args: {
  teamId: string;
  tagIds: string[];
}) {
  return createClient().query(
    api.transactionTags.serviceGetTransactionIdsForTagIds,
    serviceArgs({
      teamId: args.teamId,
      tagIds: args.tagIds,
    }),
  ) as Promise<string[]>;
}

export async function getTaggedTransactionIdsFromConvex(args: {
  teamId: string;
}) {
  return createClient().query(
    api.transactionTags.serviceGetTaggedTransactionIds,
    serviceArgs({
      teamId: args.teamId,
    }),
  ) as Promise<string[]>;
}

export async function createTransactionTagInConvex(args: {
  teamId: string;
  transactionId: string;
  tagId: string;
}) {
  return createClient().mutation(
    api.transactionTags.serviceCreateTransactionTag,
    serviceArgs({
      teamId: args.teamId,
      transactionId: args.transactionId,
      tagId: args.tagId,
    }),
  ) as Promise<TransactionTagAssignmentRecord>;
}

export async function deleteTransactionTagInConvex(args: {
  teamId: string;
  transactionId: string;
  tagId: string;
}) {
  return createClient().mutation(
    api.transactionTags.serviceDeleteTransactionTag,
    serviceArgs({
      teamId: args.teamId,
      transactionId: args.transactionId,
      tagId: args.tagId,
    }),
  ) as Promise<{ id: string } | null>;
}

export async function addTransactionTagToTransactionsInConvex(args: {
  teamId: string;
  transactionIds: string[];
  tagId: string;
}) {
  return createClient().mutation(
    api.transactionTags.serviceAddTransactionTagToTransactions,
    serviceArgs({
      teamId: args.teamId,
      transactionIds: args.transactionIds,
      tagId: args.tagId,
    }),
  ) as Promise<TransactionTagAssignmentRecord[]>;
}

export async function deleteTransactionTagsForTagInConvex(args: {
  teamId: string;
  tagId: string;
}) {
  return createClient().mutation(
    api.transactionTags.serviceDeleteTransactionTagsForTag,
    serviceArgs({
      teamId: args.teamId,
      tagId: args.tagId,
    }),
  ) as Promise<{ tagId: string }>;
}

export async function deleteTransactionTagsForTransactionsInConvex(args: {
  teamId: string;
  transactionIds: string[];
}) {
  return createClient().mutation(
    api.transactionTags.serviceDeleteTransactionTagsForTransactionIds,
    serviceArgs({
      teamId: args.teamId,
      transactionIds: args.transactionIds,
    }),
  ) as Promise<{ transactionIds: string[] }>;
}

export async function getTrackerProjectAssignmentsForProjectIdsFromConvex(args: {
  teamId: string;
  trackerProjectIds: string[];
}) {
  return createClient().query(
    api.trackerProjectTags.serviceGetTrackerProjectTagAssignmentsForProjectIds,
    serviceArgs({
      teamId: args.teamId,
      trackerProjectIds: args.trackerProjectIds,
    }),
  ) as Promise<TrackerProjectTagAssignmentRecord[]>;
}

export async function getTrackerProjectsFromConvex(args: { teamId: string }) {
  return createClient().query(
    convexApi["trackerProjects"].serviceGetTrackerProjects,
    serviceArgs({
      teamId: args.teamId,
    }),
  ) as Promise<TrackerProjectRecord[]>;
}

export async function getTrackerProjectsPageFromConvex(args: {
  teamId: string;
  cursor?: string | null;
  pageSize: number;
  status?: "in_progress" | "completed";
  order?: "asc" | "desc";
}) {
  return createClient().query(
    convexApi["trackerProjects"].serviceListTrackerProjectsPage,
    serviceArgs({
      teamId: args.teamId,
      status: args.status,
      order: args.order,
      paginationOpts: {
        numItems: args.pageSize,
        cursor: args.cursor ?? null,
      },
    }),
  ) as Promise<{
    page: TrackerProjectRecord[];
    isDone: boolean;
    continueCursor: string;
  }>;
}

export async function getTrackerProjectsByIdsFromConvex(args: {
  teamId: string;
  projectIds: string[];
}) {
  return createClient().query(
    convexApi["trackerProjects"].serviceGetTrackerProjectsByIds,
    serviceArgs({
      teamId: args.teamId,
      projectIds: args.projectIds,
    }),
  ) as Promise<TrackerProjectRecord[]>;
}

export async function getTrackerProjectsByCustomerIdsFromConvex(args: {
  teamId: string;
  customerIds: string[];
}) {
  return createClient().query(
    convexApi["trackerProjects"].serviceGetTrackerProjectsByCustomerIds,
    serviceArgs({
      teamId: args.teamId,
      customerIds: args.customerIds,
    }),
  ) as Promise<TrackerProjectRecord[]>;
}

export async function getTrackerProjectByIdFromConvex(args: {
  teamId: string;
  id: string;
}) {
  return createClient().query(
    convexApi["trackerProjects"].serviceGetTrackerProjectById,
    serviceArgs({
      teamId: args.teamId,
      id: args.id,
    }),
  ) as Promise<TrackerProjectRecord | null>;
}

export async function upsertTrackerProjectInConvex(
  args: UpsertTrackerProjectInput,
) {
  return createClient().mutation(
    convexApi["trackerProjects"].serviceUpsertTrackerProject,
    serviceArgs({
      teamId: args.teamId,
      id: args.id,
      name: args.name,
      description: args.description,
      status: args.status,
      customerId: args.customerId,
      estimate: args.estimate,
      currency: args.currency,
      billable: args.billable,
      rate: args.rate,
    }),
  ) as Promise<TrackerProjectRecord>;
}

export async function deleteTrackerProjectInConvex(args: {
  teamId: string;
  id: string;
}) {
  return createClient().mutation(
    convexApi["trackerProjects"].serviceDeleteTrackerProject,
    serviceArgs({
      teamId: args.teamId,
      id: args.id,
    }),
  ) as Promise<{ id: string } | null>;
}

export async function getTrackerEntriesByDateFromConvex(args: {
  teamId: string;
  date: string;
  projectId?: string | null;
  assignedId?: ConvexUserId | null;
}) {
  return createClient().query(
    convexApi["trackerEntries"].serviceGetTrackerEntriesByDate,
    serviceArgs({
      teamId: args.teamId,
      date: args.date,
      projectId: args.projectId,
      assignedId: args.assignedId,
    }),
  ) as Promise<TrackerEntryRecord[]>;
}

export async function getTrackerEntriesByRangeFromConvex(args: {
  teamId: string;
  from: string;
  to: string;
  projectId?: string | null;
  assignedId?: ConvexUserId | null;
}) {
  return createClient().query(
    convexApi["trackerEntries"].serviceGetTrackerEntriesByRange,
    serviceArgs({
      teamId: args.teamId,
      from: args.from,
      to: args.to,
      projectId: args.projectId,
      assignedId: args.assignedId,
    }),
  ) as Promise<TrackerEntryRecord[]>;
}

export async function getTrackerEntriesByProjectIdsFromConvex(args: {
  teamId: string;
  projectIds: string[];
}) {
  return createClient().query(
    convexApi["trackerEntries"].serviceGetTrackerEntriesByProjectIds,
    serviceArgs({
      teamId: args.teamId,
      projectIds: args.projectIds,
    }),
  ) as Promise<TrackerEntryRecord[]>;
}

export async function getTrackerEntryByIdFromConvex(args: {
  teamId: string;
  id: string;
}) {
  return createClient().query(
    convexApi["trackerEntries"].serviceGetTrackerEntryById,
    serviceArgs({
      teamId: args.teamId,
      id: args.id,
    }),
  ) as Promise<TrackerEntryRecord | null>;
}

export async function upsertTrackerEntriesInConvex(args: {
  teamId: string;
  entries: UpsertTrackerEntryInput[];
}) {
  return createClient().mutation(
    convexApi["trackerEntries"].serviceUpsertTrackerEntries,
    serviceArgs({
      teamId: args.teamId,
      entries: args.entries.map((entry) => ({
        id: entry.id,
        date: entry.date,
        projectId: entry.projectId,
        assignedId: entry.assignedId,
        description: entry.description,
        start: entry.start,
        stop: entry.stop,
        duration: entry.duration,
        rate: entry.rate,
        currency: entry.currency,
        billed: entry.billed,
      })),
    }),
  ) as Promise<TrackerEntryRecord[]>;
}

export async function deleteTrackerEntryInConvex(args: {
  teamId: string;
  id: string;
}) {
  return createClient().mutation(
    convexApi["trackerEntries"].serviceDeleteTrackerEntry,
    serviceArgs({
      teamId: args.teamId,
      id: args.id,
    }),
  ) as Promise<{ id: string } | null>;
}

export async function getCurrentTrackerTimerFromConvex(args: {
  teamId: string;
  assignedId?: ConvexUserId | null;
}) {
  return createClient().query(
    convexApi["trackerEntries"].serviceGetCurrentTrackerTimer,
    serviceArgs({
      teamId: args.teamId,
      assignedId: args.assignedId,
    }),
  ) as Promise<TrackerEntryRecord | null>;
}

export async function startTrackerTimerInConvex(args: {
  teamId: string;
  id: string;
  projectId: string;
  assignedId?: ConvexUserId | null;
  description?: string | null;
  start?: string;
}) {
  return createClient().mutation(
    convexApi["trackerEntries"].serviceStartTrackerTimer,
    serviceArgs({
      teamId: args.teamId,
      id: args.id,
      projectId: args.projectId,
      assignedId: args.assignedId,
      description: args.description,
      start: args.start,
    }),
  ) as Promise<TrackerEntryRecord>;
}

export async function stopTrackerTimerInConvex(args: {
  teamId: string;
  id?: string;
  assignedId?: ConvexUserId | null;
  stop?: string;
}) {
  return createClient().mutation(
    convexApi["trackerEntries"].serviceStopTrackerTimer,
    serviceArgs({
      teamId: args.teamId,
      id: args.id,
      assignedId: args.assignedId,
      stop: args.stop,
    }),
  ) as Promise<
    | (TrackerEntryRecord & {
        discarded?: false;
      })
    | {
        id: string;
        discarded: true;
        duration: number;
        projectId: string | null;
        description: string | null;
        start: string | null;
        stop: string | null;
      }
  >;
}

export async function getCustomerTagAssignmentsForCustomerIdsFromConvex(args: {
  teamId: string;
  customerIds: string[];
}) {
  return createClient().query(
    api.customerTags.serviceGetCustomerTagAssignmentsForCustomerIds,
    serviceArgs({
      teamId: args.teamId,
      customerIds: args.customerIds,
    }),
  ) as Promise<CustomerTagAssignmentRecord[]>;
}

export async function replaceCustomerTagsInConvex(args: {
  teamId: string;
  customerId: string;
  tagIds: string[];
}) {
  return createClient().mutation(
    api.customerTags.serviceReplaceCustomerTags,
    serviceArgs({
      teamId: args.teamId,
      customerId: args.customerId,
      tagIds: args.tagIds,
    }),
  ) as Promise<CustomerTagAssignmentRecord[]>;
}

export async function deleteCustomerTagsForCustomerInConvex(args: {
  teamId: string;
  customerId: string;
}) {
  return createClient().mutation(
    api.customerTags.serviceDeleteCustomerTagsForCustomer,
    serviceArgs({
      teamId: args.teamId,
      customerId: args.customerId,
    }),
  ) as Promise<{ customerId: string }>;
}

export async function deleteCustomerTagsForTagInConvex(args: {
  teamId: string;
  tagId: string;
}) {
  return createClient().mutation(
    api.customerTags.serviceDeleteCustomerTagsForTag,
    serviceArgs({
      teamId: args.teamId,
      tagId: args.tagId,
    }),
  ) as Promise<{ tagId: string }>;
}

export async function getTrackerProjectIdsForTagIdsFromConvex(args: {
  teamId: string;
  tagIds: string[];
}) {
  return createClient().query(
    api.trackerProjectTags.serviceGetTrackerProjectIdsForTagIds,
    serviceArgs({
      teamId: args.teamId,
      tagIds: args.tagIds,
    }),
  ) as Promise<string[]>;
}

export async function replaceTrackerProjectTagsInConvex(args: {
  teamId: string;
  trackerProjectId: string;
  tagIds: string[];
}) {
  return createClient().mutation(
    api.trackerProjectTags.serviceReplaceTrackerProjectTags,
    serviceArgs({
      teamId: args.teamId,
      trackerProjectId: args.trackerProjectId,
      tagIds: args.tagIds,
    }),
  ) as Promise<TrackerProjectTagAssignmentRecord[]>;
}

export async function deleteTrackerProjectTagsForProjectInConvex(args: {
  teamId: string;
  trackerProjectId: string;
}) {
  return createClient().mutation(
    api.trackerProjectTags.serviceDeleteTrackerProjectTagsForProject,
    serviceArgs({
      teamId: args.teamId,
      trackerProjectId: args.trackerProjectId,
    }),
  ) as Promise<{ trackerProjectId: string }>;
}

export async function deleteTrackerProjectTagsForTagInConvex(args: {
  teamId: string;
  tagId: string;
}) {
  return createClient().mutation(
    api.trackerProjectTags.serviceDeleteTrackerProjectTagsForTag,
    serviceArgs({
      teamId: args.teamId,
      tagId: args.tagId,
    }),
  ) as Promise<{ tagId: string }>;
}

export async function upsertDocumentTagEmbeddingsInConvex(args: {
  embeddings: UpsertDocumentTagEmbeddingInput[];
}) {
  return createClient().mutation(
    api.documentTagEmbeddings.serviceUpsertDocumentTagEmbeddings,
    serviceArgs({
      embeddings: args.embeddings,
    }),
  ) as Promise<DocumentTagEmbeddingRecord[]>;
}

export async function getTransactionCategoryEmbeddingsByNamesFromConvex(args: {
  names: string[];
}) {
  return createClient().query(
    api.transactionCategoryEmbeddings
      .serviceGetTransactionCategoryEmbeddingsByNames,
    serviceArgs({
      names: args.names,
    }),
  ) as Promise<TransactionCategoryEmbeddingRecord[]>;
}

export async function upsertTransactionCategoryEmbeddingsInConvex(args: {
  embeddings: UpsertTransactionCategoryEmbeddingInput[];
}) {
  return createClient().mutation(
    api.transactionCategoryEmbeddings
      .serviceUpsertTransactionCategoryEmbeddings,
    serviceArgs({
      embeddings: args.embeddings,
    }),
  ) as Promise<TransactionCategoryEmbeddingRecord[]>;
}

export async function getTransactionCategoriesFromConvex(args: {
  teamId: string;
}) {
  return createClient().query(
    convexApi["transactionCategories"].serviceListTransactionCategories,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<TransactionCategoryRecord[]>;
}

export async function getTransactionCategoryByIdFromConvex(args: {
  teamId: string;
  id: string;
}) {
  return createClient().query(
    convexApi["transactionCategories"].serviceGetTransactionCategoryById,
    serviceArgs({
      publicTeamId: args.teamId,
      categoryId: args.id,
    }),
  ) as Promise<TransactionCategoryRecord | null>;
}

export async function createTransactionCategoryInConvex(
  args: UpsertTransactionCategoryInput,
) {
  return createClient().mutation(
    convexApi["transactionCategories"].serviceCreateTransactionCategory,
    serviceArgs({
      publicTeamId: args.teamId,
      id: args.id,
      name: args.name,
      color: args.color,
      description: args.description,
      system: args.system,
      taxRate: args.taxRate,
      taxType: args.taxType,
      taxReportingCode: args.taxReportingCode,
      excluded: args.excluded,
      parentId: args.parentId,
    }),
  ) as Promise<TransactionCategoryRecord>;
}

export async function updateTransactionCategoryInConvex(
  args: UpsertTransactionCategoryInput & { id: string },
) {
  return createClient().mutation(
    convexApi["transactionCategories"].serviceUpdateTransactionCategory,
    serviceArgs({
      publicTeamId: args.teamId,
      id: args.id,
      name: args.name,
      color: args.color,
      description: args.description,
      taxRate: args.taxRate,
      taxType: args.taxType,
      taxReportingCode: args.taxReportingCode,
      excluded: args.excluded,
      parentId: args.parentId,
    }),
  ) as Promise<TransactionCategoryRecord>;
}

export async function deleteTransactionCategoryInConvex(args: {
  teamId: string;
  id: string;
}) {
  return createClient().mutation(
    convexApi["transactionCategories"].serviceDeleteTransactionCategory,
    serviceArgs({
      publicTeamId: args.teamId,
      id: args.id,
    }),
  ) as Promise<{ id: string } | null>;
}

export async function upsertTransactionCategoriesInConvex(args: {
  teamId: string;
  categories: UpsertTransactionCategoryInput[];
}) {
  return createClient().mutation(
    convexApi["transactionCategories"].serviceUpsertTransactionCategories,
    serviceArgs({
      publicTeamId: args.teamId,
      categories: args.categories.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        color: category.color,
        description: category.description,
        system: category.system,
        taxRate: category.taxRate,
        taxType: category.taxType,
        taxReportingCode: category.taxReportingCode,
        excluded: category.excluded,
        parentId: category.parentId,
      })),
    }),
  ) as Promise<TransactionCategoryRecord[]>;
}

export async function getInsightUserStatusesFromConvex(args: {
  userId: ConvexUserId;
}) {
  return createClient().query(
    api.insights.serviceGetInsightUserStatuses,
    serviceArgs({
      userId: args.userId,
    }),
  ) as Promise<InsightUserStatusRecord[]>;
}

export async function markInsightAsReadInConvex(args: {
  userId: ConvexUserId;
  insightId: string;
}) {
  return createClient().mutation(
    api.insights.serviceMarkInsightAsRead,
    serviceArgs({
      userId: args.userId,
      insightId: args.insightId,
    }),
  ) as Promise<InsightUserStatusRecord>;
}

export async function dismissInsightInConvex(args: {
  userId: ConvexUserId;
  insightId: string;
}) {
  return createClient().mutation(
    api.insights.serviceDismissInsight,
    serviceArgs({
      userId: args.userId,
      insightId: args.insightId,
    }),
  ) as Promise<InsightUserStatusRecord>;
}

export async function undoDismissInsightInConvex(args: {
  userId: ConvexUserId;
  insightId: string;
}) {
  return createClient().mutation(
    api.insights.serviceUndoDismissInsight,
    serviceArgs({
      userId: args.userId,
      insightId: args.insightId,
    }),
  ) as Promise<InsightUserStatusRecord | null>;
}

export async function createReportLinkInConvex(args: {
  teamId: string;
  userId: ConvexUserId;
  type: ReportLinkType;
  from: string;
  to: string;
  currency?: string;
  expireAt?: string;
}) {
  return createClient().mutation(
    api.reportLinks.serviceCreateReportLink,
    serviceArgs({
      publicTeamId: args.teamId,
      userId: args.userId,
      type: args.type,
      from: args.from,
      to: args.to,
      currency: args.currency,
      expireAt: args.expireAt,
    }),
  ) as Promise<ReportLinkRecord>;
}

export async function getReportLinkByLinkIdFromConvex(args: {
  linkId: string;
}) {
  return createClient().query(
    api.reportLinks.serviceGetReportLinkByLinkId,
    serviceArgs({
      linkId: args.linkId,
    }),
  ) as Promise<ReportLinkRecord | null>;
}

export async function upsertEvidencePackInConvex(args: {
  teamId: string;
  id?: string;
  filingProfileId: string;
  vatReturnId: string;
  checksum: string;
  payload: Record<string, unknown>;
  createdBy?: ConvexUserId | null;
}) {
  return createClient().mutation(
    api.evidencePacks.serviceUpsertEvidencePack,
    serviceArgs({
      publicTeamId: args.teamId,
      evidencePackId: args.id,
      filingProfileId: args.filingProfileId,
      vatReturnId: args.vatReturnId,
      checksum: args.checksum,
      payload: args.payload,
      createdBy: args.createdBy,
    }),
  ) as Promise<EvidencePackRecord>;
}

export async function getEvidencePackByIdFromConvex(args: {
  teamId: string;
  id: string;
}) {
  return createClient().query(
    api.evidencePacks.serviceGetEvidencePackById,
    serviceArgs({
      publicTeamId: args.teamId,
      evidencePackId: args.id,
    }),
  ) as Promise<EvidencePackRecord | null>;
}

export async function getYearEndPackByPeriodFromConvex(args: {
  teamId: string;
  filingProfileId: string;
  periodKey: string;
}) {
  return createClient().query(
    apiWithYearEndPacks.yearEndPacks.serviceGetYearEndPackByPeriod,
    serviceArgs({
      publicTeamId: args.teamId,
      filingProfileId: args.filingProfileId,
      periodKey: args.periodKey,
    }),
  ) as Promise<YearEndPackRecord | null>;
}

export async function upsertYearEndPackInConvex(args: {
  id?: string;
  teamId: string;
  filingProfileId: string;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  accountsDueDate: string;
  corporationTaxDueDate: string;
  status: "draft" | "ready" | "exported";
  currency: string;
  trialBalance: unknown;
  profitAndLoss: unknown;
  balanceSheet: unknown;
  retainedEarnings: unknown;
  workingPapers: unknown;
  corporationTax: unknown;
  manualJournalCount: number;
  payrollRunCount: number;
  exportBundles: ExportBundleRecord[];
  latestExportedAt?: string | null;
  snapshotChecksum: string;
}) {
  return createClient().mutation(
    apiWithYearEndPacks.yearEndPacks.serviceUpsertYearEndPack,
    serviceArgs({
      publicTeamId: args.teamId,
      yearEndPackId: args.id,
      filingProfileId: args.filingProfileId,
      periodKey: args.periodKey,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      accountsDueDate: args.accountsDueDate,
      corporationTaxDueDate: args.corporationTaxDueDate,
      status: args.status,
      currency: args.currency,
      trialBalance: args.trialBalance,
      profitAndLoss: args.profitAndLoss,
      balanceSheet: args.balanceSheet,
      retainedEarnings: args.retainedEarnings,
      workingPapers: args.workingPapers,
      corporationTax: args.corporationTax,
      manualJournalCount: args.manualJournalCount,
      payrollRunCount: args.payrollRunCount,
      exportBundles: args.exportBundles,
      latestExportedAt: args.latestExportedAt,
      snapshotChecksum: args.snapshotChecksum,
    }),
  ) as Promise<YearEndPackRecord>;
}

export async function listCorporationTaxAdjustmentsForPeriodFromConvex(args: {
  teamId: string;
  filingProfileId: string;
  periodKey: string;
}) {
  return createClient().query(
    apiWithCorporationTaxAdjustments.corporationTaxAdjustments
      .serviceListCorporationTaxAdjustmentsForPeriod,
    serviceArgs({
      publicTeamId: args.teamId,
      filingProfileId: args.filingProfileId,
      periodKey: args.periodKey,
    }),
  ) as Promise<CorporationTaxAdjustmentRecord[]>;
}

export async function upsertCorporationTaxAdjustmentInConvex(args: {
  id?: string;
  teamId: string;
  filingProfileId: string;
  periodKey: string;
  category?: string;
  label: string;
  amount: number;
  note?: string | null;
  createdBy?: ConvexUserId | null;
}) {
  return createClient().mutation(
    apiWithCorporationTaxAdjustments.corporationTaxAdjustments
      .serviceUpsertCorporationTaxAdjustment,
    serviceArgs({
      publicTeamId: args.teamId,
      corporationTaxAdjustmentId: args.id,
      filingProfileId: args.filingProfileId,
      periodKey: args.periodKey,
      category: args.category,
      label: args.label,
      amount: args.amount,
      note: args.note,
      createdBy: args.createdBy,
    }),
  ) as Promise<CorporationTaxAdjustmentRecord>;
}

export async function deleteCorporationTaxAdjustmentInConvex(args: {
  teamId: string;
  id: string;
}) {
  return createClient().mutation(
    apiWithCorporationTaxAdjustments.corporationTaxAdjustments
      .serviceDeleteCorporationTaxAdjustment,
    serviceArgs({
      publicTeamId: args.teamId,
      corporationTaxAdjustmentId: args.id,
    }),
  ) as Promise<{ deleted: boolean }>;
}

export async function getCloseCompanyLoansScheduleByPeriodFromConvex(args: {
  teamId: string;
  filingProfileId: string;
  periodKey: string;
}) {
  return createClient().query(
    apiWithCloseCompanyLoansSchedules.closeCompanyLoansSchedules
      .serviceGetCloseCompanyLoansScheduleByPeriod,
    serviceArgs({
      publicTeamId: args.teamId,
      filingProfileId: args.filingProfileId,
      periodKey: args.periodKey,
    }),
  ) as Promise<CloseCompanyLoansScheduleRecord | null>;
}

export async function upsertCloseCompanyLoansScheduleInConvex(args: {
  teamId: string;
  filingProfileId: string;
  periodKey: string;
  beforeEndPeriod: boolean;
  loansMade: Array<{
    name: string;
    amountOfLoan: number;
  }>;
  taxChargeable: number | null;
  reliefEarlierThan: Array<{
    name: string;
    amountRepaid: number | null;
    amountReleasedOrWrittenOff: number | null;
    date: string;
  }>;
  reliefEarlierDue: number | null;
  loanLaterReliefNow: Array<{
    name: string;
    amountRepaid: number | null;
    amountReleasedOrWrittenOff: number | null;
    date: string;
  }>;
  reliefLaterDue: number | null;
  totalLoansOutstanding: number | null;
  createdBy?: ConvexUserId | null;
}) {
  return createClient().mutation(
    apiWithCloseCompanyLoansSchedules.closeCompanyLoansSchedules
      .serviceUpsertCloseCompanyLoansSchedule,
    serviceArgs({
      publicTeamId: args.teamId,
      filingProfileId: args.filingProfileId,
      periodKey: args.periodKey,
      beforeEndPeriod: args.beforeEndPeriod,
      loansMade: args.loansMade,
      taxChargeable: args.taxChargeable,
      reliefEarlierThan: args.reliefEarlierThan,
      reliefEarlierDue: args.reliefEarlierDue,
      loanLaterReliefNow: args.loanLaterReliefNow,
      reliefLaterDue: args.reliefLaterDue,
      totalLoansOutstanding: args.totalLoansOutstanding,
      createdBy: args.createdBy,
    }),
  ) as Promise<CloseCompanyLoansScheduleRecord>;
}

export async function deleteCloseCompanyLoansScheduleInConvex(args: {
  teamId: string;
  filingProfileId: string;
  periodKey: string;
}) {
  return createClient().mutation(
    apiWithCloseCompanyLoansSchedules.closeCompanyLoansSchedules
      .serviceDeleteCloseCompanyLoansSchedule,
    serviceArgs({
      publicTeamId: args.teamId,
      filingProfileId: args.filingProfileId,
      periodKey: args.periodKey,
    }),
  ) as Promise<{ deleted: boolean }>;
}

export async function getCorporationTaxRateScheduleByPeriodFromConvex(args: {
  teamId: string;
  filingProfileId: string;
  periodKey: string;
}) {
  return createClient().query(
    apiWithCorporationTaxRateSchedules.corporationTaxRateSchedules
      .serviceGetCorporationTaxRateScheduleByPeriod,
    serviceArgs({
      publicTeamId: args.teamId,
      filingProfileId: args.filingProfileId,
      periodKey: args.periodKey,
    }),
  ) as Promise<CorporationTaxRateScheduleRecord | null>;
}

export async function upsertCorporationTaxRateScheduleInConvex(args: {
  teamId: string;
  filingProfileId: string;
  periodKey: string;
  exemptDistributions: number | null;
  associatedCompaniesThisPeriod: number | null;
  associatedCompaniesFirstYear: number | null;
  associatedCompaniesSecondYear: number | null;
  createdBy?: ConvexUserId | null;
}) {
  return createClient().mutation(
    apiWithCorporationTaxRateSchedules.corporationTaxRateSchedules
      .serviceUpsertCorporationTaxRateSchedule,
    serviceArgs({
      publicTeamId: args.teamId,
      filingProfileId: args.filingProfileId,
      periodKey: args.periodKey,
      exemptDistributions: args.exemptDistributions,
      associatedCompaniesThisPeriod: args.associatedCompaniesThisPeriod,
      associatedCompaniesFirstYear: args.associatedCompaniesFirstYear,
      associatedCompaniesSecondYear: args.associatedCompaniesSecondYear,
      createdBy: args.createdBy,
    }),
  ) as Promise<CorporationTaxRateScheduleRecord>;
}

export async function deleteCorporationTaxRateScheduleInConvex(args: {
  teamId: string;
  filingProfileId: string;
  periodKey: string;
}) {
  return createClient().mutation(
    apiWithCorporationTaxRateSchedules.corporationTaxRateSchedules
      .serviceDeleteCorporationTaxRateSchedule,
    serviceArgs({
      publicTeamId: args.teamId,
      filingProfileId: args.filingProfileId,
      periodKey: args.periodKey,
    }),
  ) as Promise<{ deleted: boolean }>;
}

export async function listPayrollRunsFromConvex(args: { teamId: string }) {
  return createClient().query(
    apiWithPayrollRuns.payrollRuns.serviceListPayrollRuns,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<PayrollRunRecord[]>;
}

export async function getPayrollRunByPeriodFromConvex(args: {
  teamId: string;
  periodKey: string;
}) {
  return createClient().query(
    apiWithPayrollRuns.payrollRuns.serviceGetPayrollRunByPeriod,
    serviceArgs({
      publicTeamId: args.teamId,
      periodKey: args.periodKey,
    }),
  ) as Promise<PayrollRunRecord | null>;
}

export async function upsertPayrollRunInConvex(args: {
  id?: string;
  teamId: string;
  filingProfileId: string;
  periodKey: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  runDate: string;
  source: "csv" | "manual";
  status: "imported" | "exported";
  checksum: string;
  currency: string;
  journalEntryId: string;
  lineCount: number;
  liabilityTotals: {
    grossPay: number;
    employerTaxes: number;
    payeLiability: number;
  };
  exportBundles: ExportBundleRecord[];
  latestExportedAt?: string | null;
  meta?: Record<string, unknown> | null;
  createdBy?: ConvexUserId | null;
}) {
  return createClient().mutation(
    apiWithPayrollRuns.payrollRuns.serviceUpsertPayrollRun,
    serviceArgs({
      publicTeamId: args.teamId,
      payrollRunId: args.id,
      filingProfileId: args.filingProfileId,
      periodKey: args.periodKey,
      payPeriodStart: args.payPeriodStart,
      payPeriodEnd: args.payPeriodEnd,
      runDate: args.runDate,
      source: args.source,
      status: args.status,
      importChecksum: args.checksum,
      currency: args.currency,
      journalEntryId: args.journalEntryId,
      lineCount: args.lineCount,
      liabilityTotals: args.liabilityTotals,
      exportBundles: args.exportBundles,
      latestExportedAt: args.latestExportedAt,
      meta: args.meta,
      createdBy: args.createdBy,
    }),
  ) as Promise<PayrollRunRecord>;
}

export async function getFilingProfileFromConvex(args: {
  teamId: string;
  provider?: string;
}) {
  return createClient().query(
    apiWithComplianceState.complianceState.serviceGetFilingProfile,
    serviceArgs({
      publicTeamId: args.teamId,
      provider: args.provider,
    }),
  ) as Promise<FilingProfileRecord | null>;
}

export async function upsertFilingProfileInConvex(args: {
  id?: string;
  teamId: string;
  provider: string;
  legalEntityType: string;
  enabled: boolean;
  countryCode: string;
  companyName?: string | null;
  companyNumber?: string | null;
  companyAuthenticationCode?: string | null;
  utr?: string | null;
  vrn?: string | null;
  vatScheme?: string | null;
  accountingBasis: string;
  filingMode: string;
  agentReferenceNumber?: string | null;
  yearEndMonth?: number | null;
  yearEndDay?: number | null;
  baseCurrency?: string | null;
  principalActivity?: string | null;
  directors?: string[];
  signingDirectorName?: string | null;
  approvalDate?: string | null;
  averageEmployeeCount?: number | null;
  ordinaryShareCount?: number | null;
  ordinaryShareNominalValue?: number | null;
  dormant?: boolean | null;
  auditExemptionClaimed?: boolean | null;
  membersDidNotRequireAudit?: boolean | null;
  directorsAcknowledgeResponsibilities?: boolean | null;
  accountsPreparedUnderSmallCompaniesRegime?: boolean | null;
}) {
  return createClient().mutation(
    apiWithComplianceState.complianceState.serviceUpsertFilingProfile,
    serviceArgs({
      publicTeamId: args.teamId,
      filingProfileId: args.id,
      provider: args.provider,
      legalEntityType: args.legalEntityType,
      enabled: args.enabled,
      countryCode: args.countryCode,
      companyName: args.companyName,
      companyNumber: args.companyNumber,
      companyAuthenticationCode: args.companyAuthenticationCode,
      utr: args.utr,
      vrn: args.vrn,
      vatScheme: args.vatScheme,
      accountingBasis: args.accountingBasis,
      filingMode: args.filingMode,
      agentReferenceNumber: args.agentReferenceNumber,
      yearEndMonth: args.yearEndMonth,
      yearEndDay: args.yearEndDay,
      baseCurrency: args.baseCurrency,
      principalActivity: args.principalActivity,
      directors: args.directors,
      signingDirectorName: args.signingDirectorName,
      approvalDate: args.approvalDate,
      averageEmployeeCount: args.averageEmployeeCount,
      ordinaryShareCount: args.ordinaryShareCount,
      ordinaryShareNominalValue: args.ordinaryShareNominalValue,
      dormant: args.dormant,
      auditExemptionClaimed: args.auditExemptionClaimed,
      membersDidNotRequireAudit: args.membersDidNotRequireAudit,
      directorsAcknowledgeResponsibilities:
        args.directorsAcknowledgeResponsibilities,
      accountsPreparedUnderSmallCompaniesRegime:
        args.accountsPreparedUnderSmallCompaniesRegime,
    }),
  ) as Promise<FilingProfileRecord>;
}

export async function upsertVatObligationInConvex(args: {
  id?: string;
  teamId: string;
  filingProfileId: string;
  provider: string;
  obligationType: string;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  status: string;
  externalId?: string | null;
  raw?: unknown;
}) {
  return createClient().mutation(
    apiWithComplianceState.complianceState.serviceUpsertVatObligation,
    serviceArgs({
      publicTeamId: args.teamId,
      obligationId: args.id,
      filingProfileId: args.filingProfileId,
      provider: args.provider,
      obligationType: args.obligationType,
      periodKey: args.periodKey,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      dueDate: args.dueDate,
      status: args.status,
      externalId: args.externalId,
      raw: args.raw,
    }),
  ) as Promise<ComplianceObligationRecord>;
}

export async function upsertComplianceObligationInConvex(args: {
  id?: string;
  teamId: string;
  filingProfileId: string;
  provider: string;
  obligationType: string;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  status: string;
  externalId?: string | null;
  raw?: unknown;
}) {
  return upsertVatObligationInConvex(args);
}

export async function listVatObligationsFromConvex(args: { teamId: string }) {
  return createClient().query(
    apiWithComplianceState.complianceState.serviceListVatObligations,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<ComplianceObligationRecord[]>;
}

export async function listComplianceObligationsFromConvex(args: {
  teamId: string;
  provider?: string;
  obligationType?: string;
}) {
  const obligations = await listVatObligationsFromConvex({
    teamId: args.teamId,
  });

  return obligations.filter((obligation) => {
    if (args.provider && obligation.provider !== args.provider) {
      return false;
    }

    if (
      args.obligationType &&
      obligation.obligationType !== args.obligationType
    ) {
      return false;
    }

    return true;
  });
}

export async function getVatObligationByIdFromConvex(args: { id: string }) {
  return createClient().query(
    apiWithComplianceState.complianceState.serviceGetVatObligationById,
    serviceArgs({
      obligationId: args.id,
    }),
  ) as Promise<ComplianceObligationRecord | null>;
}

export async function getComplianceObligationByIdFromConvex(args: {
  id: string;
}) {
  return getVatObligationByIdFromConvex(args);
}

export async function getVatReturnByIdFromConvex(args: { id: string }) {
  return createClient().query(
    apiWithComplianceState.complianceState.serviceGetVatReturnById,
    serviceArgs({
      vatReturnId: args.id,
    }),
  ) as Promise<VatReturnRecord | null>;
}

export async function getVatReturnByObligationIdFromConvex(args: {
  teamId: string;
  obligationId: string;
}) {
  return createClient().query(
    apiWithComplianceState.complianceState.serviceGetVatReturnByObligationId,
    serviceArgs({
      publicTeamId: args.teamId,
      obligationId: args.obligationId,
    }),
  ) as Promise<VatReturnRecord | null>;
}

export async function getLatestVatReturnFromConvex(args: { teamId: string }) {
  return createClient().query(
    apiWithComplianceState.complianceState.serviceGetLatestVatReturn,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<VatReturnRecord | null>;
}

export async function upsertVatReturnInConvex(args: {
  id?: string;
  teamId: string;
  filingProfileId: string;
  obligationId?: string | null;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  currency: string;
  netVatDue: number;
  submittedAt?: string | null;
  externalSubmissionId?: string | null;
  declarationAccepted?: boolean | null;
  lines: Array<{
    code: string;
    label: string;
    amount: number;
    meta?: unknown;
  }>;
}) {
  return createClient().mutation(
    apiWithComplianceState.complianceState.serviceUpsertVatReturn,
    serviceArgs({
      publicTeamId: args.teamId,
      vatReturnId: args.id,
      filingProfileId: args.filingProfileId,
      obligationId: args.obligationId,
      periodKey: args.periodKey,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      status: args.status,
      currency: args.currency,
      netVatDue: args.netVatDue,
      submittedAt: args.submittedAt,
      externalSubmissionId: args.externalSubmissionId,
      declarationAccepted: args.declarationAccepted,
      lines: args.lines,
    }),
  ) as Promise<VatReturnRecord>;
}

export async function markVatReturnAcceptedInConvex(args: {
  vatReturnId: string;
  submittedAt: string;
  externalSubmissionId?: string | null;
}) {
  return createClient().mutation(
    apiWithComplianceState.complianceState.serviceMarkVatReturnAccepted,
    serviceArgs({
      vatReturnId: args.vatReturnId,
      submittedAt: args.submittedAt,
      externalSubmissionId: args.externalSubmissionId,
    }),
  ) as Promise<VatReturnRecord>;
}

export async function listVatSubmissionsFromConvex(args: { teamId: string }) {
  return createClient().query(
    apiWithComplianceState.complianceState.serviceListVatSubmissions,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<VatReturnRecord[]>;
}

export async function rebuildDerivedComplianceJournalEntriesInConvex(args: {
  teamId?: string | null;
}) {
  return createClient().mutation(
    apiWithComplianceLedger.complianceLedger
      .serviceRebuildDerivedComplianceJournalEntries,
    serviceArgs({
      publicTeamId: args.teamId ?? null,
    }),
  ) as Promise<
    Array<{
      teamId: string;
      transactionCount: number;
      invoiceCount: number;
      journalEntryCount: number;
    }>
  >;
}

export async function rebuildInboxLiabilityAggregatesInConvex(args: {
  teamId?: string | null;
}) {
  return createClient().mutation(
    convexApi["inbox"].serviceRebuildInboxLiabilityAggregates,
    serviceArgs({
      publicTeamId: args.teamId ?? null,
    }),
  ) as Promise<
    Array<{
      teamId: string;
      inboxItemCount: number;
      inboxLiabilityAggregateRows: number;
    }>
  >;
}

export async function listComplianceJournalEntriesFromConvex(args: {
  teamId: string;
  sourceTypes?: ComplianceJournalSourceType[];
}) {
  return createClient().query(
    apiWithComplianceLedger.complianceLedger
      .serviceListComplianceJournalEntries,
    serviceArgs({
      publicTeamId: args.teamId,
      sourceTypes: args.sourceTypes,
    }),
  ) as Promise<ComplianceJournalEntryRecord[]>;
}

export async function upsertComplianceJournalEntryInConvex(args: {
  teamId: string;
  entry: ComplianceJournalEntryRecord;
}) {
  return createClient().mutation(
    apiWithComplianceLedger.complianceLedger
      .serviceUpsertComplianceJournalEntry,
    serviceArgs({
      publicTeamId: args.teamId,
      entry: {
        journalEntryId: args.entry.journalEntryId,
        entryDate: args.entry.entryDate,
        reference: args.entry.reference ?? undefined,
        description: args.entry.description ?? undefined,
        sourceType: args.entry.sourceType,
        sourceId: args.entry.sourceId,
        currency: args.entry.currency,
        meta: args.entry.meta ?? undefined,
        lines: args.entry.lines.map((line) => ({
          accountCode: line.accountCode,
          description: line.description ?? undefined,
          debit: line.debit ?? 0,
          credit: line.credit ?? 0,
          taxRate: line.taxRate ?? undefined,
          taxAmount: line.taxAmount ?? undefined,
          taxType: line.taxType ?? undefined,
          vatBox: line.vatBox ?? undefined,
          meta: line.meta ?? undefined,
        })),
      },
    }),
  ) as Promise<{ journalEntryId: string; updated: boolean }>;
}

export async function deleteComplianceJournalEntryBySourceInConvex(args: {
  teamId: string;
  sourceType: ComplianceJournalSourceType;
  sourceId: string;
}) {
  return createClient().mutation(
    apiWithComplianceLedger.complianceLedger
      .serviceDeleteComplianceJournalEntryBySource,
    serviceArgs({
      publicTeamId: args.teamId,
      sourceType: args.sourceType,
      sourceId: args.sourceId,
    }),
  ) as Promise<{ deleted: boolean; journalEntryId?: string }>;
}

export async function createTransactionAttachmentsInConvex(args: {
  teamId: string;
  userId?: string;
  attachments: CreateTransactionAttachmentInput[];
}) {
  return createClient().mutation(
    apiWithTransactionAttachments.transactionAttachments
      .serviceCreateTransactionAttachments,
    serviceArgs({
      publicTeamId: args.teamId,
      attachments: args.attachments,
    }),
  ) as Promise<TransactionAttachmentRecord[]>;
}

export async function getTransactionAttachmentFromConvex(args: {
  teamId: string;
  transactionId: string;
  attachmentId: string;
}) {
  return createClient().query(
    apiWithTransactionAttachments.transactionAttachments
      .serviceGetTransactionAttachment,
    serviceArgs({
      publicTeamId: args.teamId,
      transactionId: args.transactionId,
      attachmentId: args.attachmentId,
    }),
  ) as Promise<TransactionAttachmentRecord | null>;
}

export async function getTransactionAttachmentsByIdsFromConvex(args: {
  teamId: string;
  attachmentIds: string[];
}) {
  return createClient().query(
    apiWithTransactionAttachments.transactionAttachments
      .serviceGetTransactionAttachmentsByIds,
    serviceArgs({
      publicTeamId: args.teamId,
      ids: args.attachmentIds,
    }),
  ) as Promise<TransactionAttachmentRecord[]>;
}

export async function getTransactionAttachmentsForTransactionIdsFromConvex(args: {
  teamId: string;
  transactionIds: string[];
}) {
  return createClient().query(
    apiWithTransactionAttachments.transactionAttachments
      .serviceGetTransactionAttachmentsForTransactionIds,
    serviceArgs({
      publicTeamId: args.teamId,
      transactionIds: args.transactionIds,
    }),
  ) as Promise<TransactionAttachmentRecord[]>;
}

export async function getTransactionAttachmentsByPathKeysFromConvex(args: {
  teamId: string;
  pathKeys: string[][];
}) {
  return createClient().query(
    apiWithTransactionAttachments.transactionAttachments
      .serviceGetTransactionAttachmentsByPathKeys,
    serviceArgs({
      publicTeamId: args.teamId,
      pathKeys: args.pathKeys,
    }),
  ) as Promise<TransactionAttachmentRecord[]>;
}

export async function getTransactionIdsWithAttachmentsFromConvex(args: {
  teamId: string;
  transactionIds?: string[];
}) {
  return createClient().query(
    apiWithTransactionAttachments.transactionAttachments
      .serviceGetTransactionIdsWithAttachments,
    serviceArgs({
      publicTeamId: args.teamId,
      transactionIds: args.transactionIds,
    }),
  ) as Promise<string[]>;
}

export async function deleteTransactionAttachmentInConvex(args: {
  teamId: string;
  attachmentId: string;
}) {
  return createClient().mutation(
    apiWithTransactionAttachments.transactionAttachments
      .serviceDeleteTransactionAttachment,
    serviceArgs({
      publicTeamId: args.teamId,
      id: args.attachmentId,
    }),
  ) as Promise<TransactionAttachmentRecord | null>;
}

export async function deleteTransactionAttachmentsByIdsInConvex(args: {
  teamId: string;
  attachmentIds: string[];
}) {
  return createClient().mutation(
    apiWithTransactionAttachments.transactionAttachments
      .serviceDeleteTransactionAttachmentsByIds,
    serviceArgs({
      publicTeamId: args.teamId,
      ids: args.attachmentIds,
    }),
  ) as Promise<{ deletedIds: string[]; count: number }>;
}

export async function deleteTransactionAttachmentsByPathKeysInConvex(args: {
  teamId: string;
  pathKeys: string[][];
}) {
  return createClient().mutation(
    apiWithTransactionAttachments.transactionAttachments
      .serviceDeleteTransactionAttachmentsByPathKeys,
    serviceArgs({
      publicTeamId: args.teamId,
      pathKeys: args.pathKeys,
    }),
  ) as Promise<{ deletedIds: string[]; count: number }>;
}

export async function getComplianceAdjustmentsForPeriodFromConvex(args: {
  teamId: string;
  filingProfileId: string;
  periodStart: string;
  periodEnd: string;
}) {
  return createClient().query(
    apiWithComplianceAdjustments.complianceAdjustments
      .serviceListComplianceAdjustmentsForPeriod,
    serviceArgs({
      publicTeamId: args.teamId,
      filingProfileId: args.filingProfileId,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
    }),
  ) as Promise<ComplianceAdjustmentRecord[]>;
}

export async function countComplianceAdjustmentsByVatReturnIdFromConvex(args: {
  teamId: string;
  vatReturnId: string;
}) {
  return createClient().query(
    apiWithComplianceAdjustments.complianceAdjustments
      .serviceCountComplianceAdjustmentsByVatReturnId,
    serviceArgs({
      publicTeamId: args.teamId,
      vatReturnId: args.vatReturnId,
    }),
  ) as Promise<number>;
}

export async function createComplianceAdjustmentInConvex(args: {
  id?: string;
  teamId: string;
  filingProfileId: string;
  vatReturnId?: string | null;
  obligationId?: string | null;
  effectiveDate: string;
  lineCode: ComplianceAdjustmentLineCode;
  amount: number;
  reason: string;
  note?: string | null;
  createdBy?: ConvexUserId | null;
  meta?: Record<string, unknown> | null;
}) {
  return createClient().mutation(
    apiWithComplianceAdjustments.complianceAdjustments
      .serviceCreateComplianceAdjustment,
    serviceArgs({
      publicTeamId: args.teamId,
      complianceAdjustmentId: args.id,
      filingProfileId: args.filingProfileId,
      vatReturnId: args.vatReturnId,
      obligationId: args.obligationId,
      effectiveDate: args.effectiveDate,
      lineCode: args.lineCode,
      amount: args.amount,
      reason: args.reason,
      note: args.note,
      createdBy: args.createdBy,
      meta: args.meta,
    }),
  ) as Promise<ComplianceAdjustmentRecord>;
}

export async function createSubmissionEventInConvex(args: {
  teamId: string;
  filingProfileId: string;
  provider: string;
  obligationType: string;
  vatReturnId?: string | null;
  status: string;
  eventType: string;
  correlationId?: string | null;
  requestPayload?: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
  errorMessage?: string | null;
}) {
  return createClient().mutation(
    apiWithSubmissionEvents.submissionEvents.serviceCreateSubmissionEvent,
    serviceArgs({
      publicTeamId: args.teamId,
      filingProfileId: args.filingProfileId,
      provider: args.provider,
      obligationType: args.obligationType,
      vatReturnId: args.vatReturnId,
      status: args.status,
      eventType: args.eventType,
      correlationId: args.correlationId,
      requestPayload: args.requestPayload,
      responsePayload: args.responsePayload,
      errorMessage: args.errorMessage,
    }),
  ) as Promise<SubmissionEventRecord | null>;
}

export async function listSubmissionEventsFromConvex(args: {
  teamId: string;
  provider?: string;
  obligationType?: string;
}) {
  return createClient().query(
    apiWithSubmissionEvents.submissionEvents.serviceListSubmissionEvents,
    serviceArgs({
      publicTeamId: args.teamId,
      provider: args.provider,
      obligationType: args.obligationType,
    }),
  ) as Promise<SubmissionEventRecord[]>;
}

export async function allocateFilingSequenceInConvex(args: { scope: string }) {
  return createClient().mutation(
    apiWithFilingSequences.filingSequences.serviceAllocateFilingSequence,
    serviceArgs({
      scope: args.scope,
    }),
  ) as Promise<number>;
}

export async function countSourceLinksBySourceTypesFromConvex(args: {
  teamId: string;
  sourceTypes: SourceLinkType[];
}) {
  return createClient().query(
    api.sourceLinks.serviceCountSourceLinksBySourceTypes,
    serviceArgs({
      publicTeamId: args.teamId,
      sourceTypes: args.sourceTypes,
    }),
  ) as Promise<number>;
}

export async function createInsightInConvex(args: {
  teamId: string;
  periodType: "weekly" | "monthly" | "quarterly" | "yearly";
  periodStart: string;
  periodEnd: string;
  periodYear: number;
  periodNumber: number;
  currency: string;
}) {
  return createClient().mutation(
    apiWithInsightsStore.insightsStore.serviceCreateInsight,
    serviceArgs({
      publicTeamId: args.teamId,
      periodType: args.periodType,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      periodYear: args.periodYear,
      periodNumber: args.periodNumber,
      currency: args.currency,
    }),
  ) as Promise<InsightRecord | null>;
}

export async function updateInsightInConvex(args: {
  teamId: string;
  id: string;
  status?: "pending" | "generating" | "completed" | "failed";
  title?: string | null;
  selectedMetrics?: unknown;
  allMetrics?: unknown;
  anomalies?: unknown;
  expenseAnomalies?: unknown;
  milestones?: unknown;
  activity?: unknown;
  content?: unknown;
  predictions?: unknown;
  audioPath?: string | null;
  generatedAt?: string | null;
}) {
  return createClient().mutation(
    apiWithInsightsStore.insightsStore.serviceUpdateInsight,
    serviceArgs({
      publicTeamId: args.teamId,
      insightId: args.id,
      status: args.status,
      title: args.title,
      selectedMetrics: args.selectedMetrics,
      allMetrics: args.allMetrics,
      anomalies: args.anomalies,
      expenseAnomalies: args.expenseAnomalies,
      milestones: args.milestones,
      activity: args.activity,
      content: args.content,
      predictions: args.predictions,
      audioPath: args.audioPath,
      generatedAt: args.generatedAt,
    }),
  ) as Promise<InsightRecord | null>;
}

export async function listInsightsFromConvex(args: { teamId: string }) {
  return createClient().query(
    apiWithInsightsStore.insightsStore.serviceListInsights,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<InsightRecord[]>;
}

export async function getInsightByIdFromConvex(args: {
  teamId: string;
  id: string;
}) {
  return createClient().query(
    apiWithInsightsStore.insightsStore.serviceGetInsightById,
    serviceArgs({
      publicTeamId: args.teamId,
      insightId: args.id,
    }),
  ) as Promise<InsightRecord | null>;
}

export async function listInstalledAppsFromConvex(args: { teamId: string }) {
  return createClient().query(
    api.foundation.serviceListInstalledAppsByTeam,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<InstalledAppRecord[]>;
}

export async function getInstalledAppFromConvex(args: {
  teamId: string;
  appId: string;
}) {
  return createClient().query(
    api.foundation.serviceGetInstalledAppByTeamAndAppId,
    serviceArgs({
      publicTeamId: args.teamId,
      appId: args.appId,
    }),
  ) as Promise<InstalledAppRecord | null>;
}

export async function getInstalledAppBySlackTeamIdFromConvex(args: {
  slackTeamId: string;
  channelId?: string;
}) {
  return createClient().query(
    api.foundation.serviceGetInstalledAppBySlackTeamId,
    serviceArgs({
      slackTeamId: args.slackTeamId,
      channelId: args.channelId,
    }),
  ) as Promise<InstalledAppRecord | null>;
}

export async function getInstalledAppByWhatsAppNumberFromConvex(args: {
  phoneNumber: string;
}) {
  return createClient().query(
    api.foundation.serviceGetInstalledAppByWhatsAppNumber,
    serviceArgs({
      phoneNumber: args.phoneNumber,
    }),
  ) as Promise<InstalledAppRecord | null>;
}

export async function upsertInstalledAppInConvex(args: {
  publicAppRecordId?: string;
  teamId: string;
  createdByUserId?: ConvexUserId;
  appId: string;
  config?: unknown;
  settings?: unknown;
  createdAt?: string;
}) {
  return createClient().mutation(
    api.foundation.serviceUpsertInstalledApp,
    serviceArgs({
      publicAppRecordId: args.publicAppRecordId,
      publicTeamId: args.teamId,
      createdByUserId: args.createdByUserId,
      appId: args.appId,
      config: args.config,
      settings: args.settings,
      createdAt: args.createdAt,
    }),
  ) as Promise<InstalledAppRecord>;
}

export async function deleteInstalledAppInConvex(args: {
  teamId: string;
  appId: string;
}) {
  return createClient().mutation(
    api.foundation.serviceDeleteInstalledApp,
    serviceArgs({
      publicTeamId: args.teamId,
      appId: args.appId,
    }),
  ) as Promise<InstalledAppRecord | null>;
}

export async function setInstalledAppSettingsInConvex(args: {
  teamId: string;
  appId: string;
  settings: unknown;
}) {
  return createClient().mutation(
    api.foundation.serviceSetInstalledAppSettings,
    serviceArgs({
      publicTeamId: args.teamId,
      appId: args.appId,
      settings: args.settings,
    }),
  ) as Promise<InstalledAppRecord>;
}

export async function setInstalledAppConfigInConvex(args: {
  teamId: string;
  appId: string;
  config: unknown;
}) {
  return createClient().mutation(
    api.foundation.serviceSetInstalledAppConfig,
    serviceArgs({
      publicTeamId: args.teamId,
      appId: args.appId,
      config: args.config,
    }),
  ) as Promise<InstalledAppRecord>;
}

export async function mergeInstalledAppConfigInConvex(args: {
  teamId: string;
  appId: string;
  configPatch: Record<string, unknown>;
}) {
  return createClient().mutation(
    api.foundation.serviceMergeInstalledAppConfig,
    serviceArgs({
      publicTeamId: args.teamId,
      appId: args.appId,
      configPatch: args.configPatch,
    }),
  ) as Promise<InstalledAppRecord>;
}

export async function addWhatsAppConnectionInConvex(args: {
  teamId: string;
  phoneNumber: string;
  displayName?: string;
}) {
  return createClient().mutation(
    api.foundation.serviceAddWhatsAppConnection,
    serviceArgs({
      publicTeamId: args.teamId,
      phoneNumber: args.phoneNumber,
      displayName: args.displayName,
    }),
  ) as Promise<InstalledAppRecord>;
}

export async function removeWhatsAppConnectionInConvex(args: {
  teamId: string;
  phoneNumber: string;
}) {
  return createClient().mutation(
    api.foundation.serviceRemoveWhatsAppConnection,
    serviceArgs({
      publicTeamId: args.teamId,
      phoneNumber: args.phoneNumber,
    }),
  ) as Promise<InstalledAppRecord | null>;
}

export async function upsertNotificationSettingInConvex(args: {
  userId: ConvexUserId;
  teamId: string;
  notificationType: string;
  channel: NotificationChannel;
  enabled: boolean;
}) {
  return createClient().mutation(
    api.foundation.serviceUpsertNotificationSetting,
    serviceArgs({
      userId: args.userId,
      publicTeamId: args.teamId,
      notificationType: args.notificationType,
      channel: args.channel,
      enabled: args.enabled,
    }),
  ) as Promise<NotificationSetting>;
}

export async function bulkUpsertNotificationSettingsInConvex(args: {
  userId: ConvexUserId;
  teamId: string;
  updates: {
    notificationType: string;
    channel: NotificationChannel;
    enabled: boolean;
  }[];
}) {
  return createClient().mutation(
    api.foundation.serviceBulkUpsertNotificationSettings,
    serviceArgs({
      userId: args.userId,
      publicTeamId: args.teamId,
      updates: args.updates,
    }),
  ) as Promise<NotificationSetting[]>;
}

export async function createActivityInConvex(args: {
  teamId: string;
  userId?: ConvexUserId;
  type: string;
  source: "system" | "user";
  status?: NotificationStatus;
  priority?: number;
  groupId?: string;
  metadata: Record<string, unknown>;
}) {
  return createClient().mutation(
    api.foundation.serviceCreateActivity,
    serviceArgs({
      publicActivityId: crypto.randomUUID(),
      publicTeamId: args.teamId,
      userId: args.userId,
      type: args.type,
      source: args.source,
      status: args.status,
      priority: args.priority,
      groupId: args.groupId,
      metadata: args.metadata,
    }),
  ) as Promise<ActivityRecord>;
}

export async function updateActivityStatusInConvex(args: {
  activityId: string;
  teamId: string;
  status: NotificationStatus;
}) {
  return createClient().mutation(
    api.foundation.serviceUpdateActivityStatus,
    serviceArgs({
      publicActivityId: args.activityId,
      publicTeamId: args.teamId,
      status: args.status,
    }),
  ) as Promise<ActivityRecord | null>;
}

export async function updateAllActivitiesStatusInConvex(args: {
  teamId: string;
  userId: ConvexUserId;
  status: NotificationStatus;
}) {
  return createClient().mutation(
    api.foundation.serviceUpdateAllActivitiesStatus,
    serviceArgs({
      publicTeamId: args.teamId,
      userId: args.userId,
      status: args.status,
    }),
  ) as Promise<ActivityRecord[]>;
}

export async function getActivitiesFromConvex(args: {
  teamId: string;
  cursor?: string | null;
  pageSize?: number;
  statuses?: NotificationStatus[] | null;
  userId?: ConvexUserId | null;
  priority?: number | null;
  maxPriority?: number | null;
  createdAfter?: string | null;
}) {
  return createClient().query(
    api.foundation.serviceGetActivities,
    serviceArgs({
      publicTeamId: args.teamId,
      cursor: args.cursor ?? undefined,
      pageSize: args.pageSize,
      statuses: args.statuses ?? undefined,
      userId: args.userId ?? undefined,
      priority: args.priority ?? undefined,
      maxPriority: args.maxPriority ?? undefined,
      createdAfter: args.createdAfter ?? undefined,
    }),
  ) as Promise<ActivitiesResult>;
}

export async function findRecentActivityInConvex(args: {
  teamId: string;
  userId?: ConvexUserId;
  type: string;
  timeWindowMinutes?: number;
}) {
  return createClient().query(
    api.foundation.serviceFindRecentActivity,
    serviceArgs({
      publicTeamId: args.teamId,
      userId: args.userId,
      type: args.type,
      timeWindowMinutes: args.timeWindowMinutes,
    }),
  ) as Promise<ActivityRecord | null>;
}

export async function updateActivityMetadataInConvex(args: {
  activityId: string;
  teamId: string;
  metadata: Record<string, unknown>;
}) {
  return createClient().mutation(
    api.foundation.serviceUpdateActivityMetadata,
    serviceArgs({
      publicActivityId: args.activityId,
      publicTeamId: args.teamId,
      metadata: args.metadata,
    }),
  ) as Promise<ActivityRecord | null>;
}
