import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { createTRPCRouter } from "../init";
import { accountingRouter } from "./accounting";
import { asyncRunsRouter } from "./async-runs";
import { apiKeysRouter } from "./api-keys";
import { appsRouter } from "./apps";
import { bankAccountsRouter } from "./bank-accounts";
import { bankConnectionsRouter } from "./bank-connections";
import { bankingRouter } from "./banking";
import { billingRouter } from "./billing";
import { chatsRouter } from "./chats";
import { complianceRouter } from "./compliance";
import { companiesHouseRouter } from "./companies-house";
import { customersRouter } from "./customers";
import { documentTagAssignmentsRouter } from "./document-tag-assignments";
import { documentTagsRouter } from "./document-tags";
import { documentsRouter } from "./documents";
import { chatFeedbackRouter } from "./feedback";
import { inboxRouter } from "./inbox";
import { inboxAccountsRouter } from "./inbox-accounts";
import { insightsRouter } from "./insights";
import { institutionsRouter } from "./institutions";
import { invoiceRouter } from "./invoice";
import { invoicePaymentsRouter } from "./invoice-payments";
import { invoiceProductsRouter } from "./invoice-products";
import { invoiceRecurringRouter } from "./invoice-recurring";
import { invoiceTemplateRouter } from "./invoice-template";
import { notificationSettingsRouter } from "./notification-settings";
import { notificationsRouter } from "./notifications";
import { oauthApplicationsRouter } from "./oauth-applications";
import { payrollRouter } from "./payroll";
import { reportsRouter } from "./reports";
import { searchRouter } from "./search";
import { shortLinksRouter } from "./short-links";
import { suggestedActionsRouter } from "./suggested-actions";
import { supportRouter } from "./support";
import { tagsRouter } from "./tags";
import { teamRouter } from "./team";
import { trackerEntriesRouter } from "./tracker-entries";
import { trackerProjectsRouter } from "./tracker-projects";
import { transactionAttachmentsRouter } from "./transaction-attachments";
import { transactionCategoriesRouter } from "./transaction-categories";
import { transactionTagsRouter } from "./transaction-tags";
import { transactionsRouter } from "./transactions";
import { uploadsRouter } from "./uploads";
import { userRouter } from "./user";
import { vatRouter } from "./vat";
import { widgetsRouter } from "./widgets";
import { yearEndRouter } from "./year-end";

export const appRouter = createTRPCRouter({
  accounting: accountingRouter,
  asyncRuns: asyncRunsRouter,
  banking: bankingRouter,
  notifications: notificationsRouter,
  notificationSettings: notificationSettingsRouter,
  apps: appsRouter,
  bankAccounts: bankAccountsRouter,
  bankConnections: bankConnectionsRouter,
  chats: chatsRouter,
  compliance: complianceRouter,
  companiesHouse: companiesHouseRouter,
  customers: customersRouter,
  documents: documentsRouter,
  documentTagAssignments: documentTagAssignmentsRouter,
  documentTags: documentTagsRouter,
  chatFeedback: chatFeedbackRouter,
  inbox: inboxRouter,
  inboxAccounts: inboxAccountsRouter,
  insights: insightsRouter,
  institutions: institutionsRouter,
  invoice: invoiceRouter,
  invoicePayments: invoicePaymentsRouter,
  invoiceProducts: invoiceProductsRouter,
  invoiceRecurring: invoiceRecurringRouter,
  invoiceTemplate: invoiceTemplateRouter,
  reports: reportsRouter,
  oauthApplications: oauthApplicationsRouter,
  payroll: payrollRouter,
  billing: billingRouter,
  suggestedActions: suggestedActionsRouter,
  support: supportRouter,
  tags: tagsRouter,
  team: teamRouter,
  trackerEntries: trackerEntriesRouter,
  trackerProjects: trackerProjectsRouter,
  transactionAttachments: transactionAttachmentsRouter,
  transactionCategories: transactionCategoriesRouter,
  transactions: transactionsRouter,
  transactionTags: transactionTagsRouter,
  uploads: uploadsRouter,
  user: userRouter,
  vat: vatRouter,
  search: searchRouter,
  shortLinks: shortLinksRouter,
  apiKeys: apiKeysRouter,
  widgets: widgetsRouter,
  yearEnd: yearEndRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;
