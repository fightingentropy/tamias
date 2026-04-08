/**
 * Static type declarations for the full AppRouter.
 *
 * This file is ONLY imported via `import type` — it is completely erased
 * at compile time and never evaluated at runtime. The value imports below
 * exist solely for TypeScript to infer the complete procedure map.
 *
 * DO NOT import this file with a value import.
 */
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { createTRPCRouter } from "../init";
// core
import { billingRouter } from "./billing";
import { notificationSettingsRouter } from "./notification-settings";
import { notificationsRouter } from "./notifications";
import { searchRouter } from "./search";
import { suggestedActionsRouter } from "./suggested-actions";
import { supportRouter } from "./support";
import { tagsRouter } from "./tags";
import { teamRouter } from "./team";
import { userRouter } from "./user";
import { widgetsRouter } from "./widgets";
// finance
import { accountingRouter } from "./accounting";
import { bankAccountsRouter } from "./bank-accounts";
import { bankConnectionsRouter } from "./bank-connections";
import { bankingRouter } from "./banking";
import { payrollRouter } from "./payroll";
import { reportsRouter } from "./reports";
import { transactionAttachmentsRouter } from "./transaction-attachments";
import { transactionCategoriesRouter } from "./transaction-categories";
import { transactionTagsRouter } from "./transaction-tags";
import { transactionsRouter } from "./transactions";
import { vatRouter } from "./vat";
import { yearEndRouter } from "./year-end";
// invoice
import { invoiceRouter } from "./invoice";
import { invoicePaymentsRouter } from "./invoice-payments";
import { invoiceProductsRouter } from "./invoice-products";
import { invoiceRecurringRouter } from "./invoice-recurring";
import { invoiceTemplateRouter } from "./invoice-template";
// content
import { complianceRouter } from "./compliance";
import { companiesHouseRouter } from "./companies-house";
import { customersRouter } from "./customers";
import { documentTagAssignmentsRouter } from "./document-tag-assignments";
import { documentTagsRouter } from "./document-tags";
import { documentsRouter } from "./documents";
import { inboxRouter } from "./inbox";
import { inboxAccountsRouter } from "./inbox-accounts";
import { uploadsRouter } from "./uploads";
// ai
import { chatsRouter } from "./chats";
import { chatFeedbackRouter } from "./feedback";
import { insightsRouter } from "./insights";
// misc
import { apiKeysRouter } from "./api-keys";
import { appsRouter } from "./apps";
import { asyncRunsRouter } from "./async-runs";
import { institutionsRouter } from "./institutions";
import { oauthApplicationsRouter } from "./oauth-applications";
import { shortLinksRouter } from "./short-links";
import { trackerEntriesRouter } from "./tracker-entries";
import { trackerProjectsRouter } from "./tracker-projects";

// Phantom function — never called, exists only for type inference.
function _fullRouter() {
  return createTRPCRouter({
    // core
    billing: billingRouter,
    notifications: notificationsRouter,
    notificationSettings: notificationSettingsRouter,
    search: searchRouter,
    suggestedActions: suggestedActionsRouter,
    support: supportRouter,
    tags: tagsRouter,
    team: teamRouter,
    user: userRouter,
    widgets: widgetsRouter,
    // finance
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
    // invoice
    invoice: invoiceRouter,
    invoicePayments: invoicePaymentsRouter,
    invoiceProducts: invoiceProductsRouter,
    invoiceRecurring: invoiceRecurringRouter,
    invoiceTemplate: invoiceTemplateRouter,
    // content
    compliance: complianceRouter,
    companiesHouse: companiesHouseRouter,
    customers: customersRouter,
    documentTagAssignments: documentTagAssignmentsRouter,
    documentTags: documentTagsRouter,
    documents: documentsRouter,
    inbox: inboxRouter,
    inboxAccounts: inboxAccountsRouter,
    uploads: uploadsRouter,
    // ai
    chats: chatsRouter,
    chatFeedback: chatFeedbackRouter,
    insights: insightsRouter,
    // misc
    apiKeys: apiKeysRouter,
    apps: appsRouter,
    asyncRuns: asyncRunsRouter,
    institutions: institutionsRouter,
    oauthApplications: oauthApplicationsRouter,
    shortLinks: shortLinksRouter,
    trackerEntries: trackerEntriesRouter,
    trackerProjects: trackerProjectsRouter,
  });
}

export type AppRouter = ReturnType<typeof _fullRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type RouterInputs = inferRouterInputs<AppRouter>;
