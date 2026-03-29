/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accountingSync from "../accountingSync.js";
import type * as asyncRuns from "../asyncRuns.js";
import type * as auth from "../auth.js";
import type * as bankAccounts from "../bankAccounts.js";
import type * as bankConnections from "../bankConnections.js";
import type * as chatFeedback from "../chatFeedback.js";
import type * as chatMemory from "../chatMemory.js";
import type * as closeCompanyLoansSchedules from "../closeCompanyLoansSchedules.js";
import type * as complianceAdjustments from "../complianceAdjustments.js";
import type * as complianceLedger from "../complianceLedger.js";
import type * as complianceState from "../complianceState.js";
import type * as corporationTaxAdjustments from "../corporationTaxAdjustments.js";
import type * as corporationTaxRateSchedules from "../corporationTaxRateSchedules.js";
import type * as customerTags from "../customerTags.js";
import type * as customers from "../customers.js";
import type * as documentTagEmbeddings from "../documentTagEmbeddings.js";
import type * as documentTags from "../documentTags.js";
import type * as documents from "../documents.js";
import type * as evidencePacks from "../evidencePacks.js";
import type * as exchangeRates from "../exchangeRates.js";
import type * as files from "../files.js";
import type * as foundation from "../foundation.js";
import type * as foundationActions from "../foundationActions.js";
import type * as health from "../health.js";
import type * as http from "../http.js";
import type * as identity from "../identity.js";
import type * as inbox from "../inbox.js";
import type * as inboxAccounts from "../inboxAccounts.js";
import type * as inboxBlocklist from "../inboxBlocklist.js";
import type * as insights from "../insights.js";
import type * as insightsStore from "../insightsStore.js";
import type * as institutions from "../institutions.js";
import type * as invoiceProducts from "../invoiceProducts.js";
import type * as invoiceRecurringSeries from "../invoiceRecurringSeries.js";
import type * as invoiceTemplates from "../invoiceTemplates.js";
import type * as lib_identity from "../lib/identity.js";
import type * as lib_service from "../lib/service.js";
import type * as payrollRuns from "../payrollRuns.js";
import type * as publicInvoices from "../publicInvoices.js";
import type * as reportLinks from "../reportLinks.js";
import type * as shortLinks from "../shortLinks.js";
import type * as sourceLinks from "../sourceLinks.js";
import type * as submissionEvents from "../submissionEvents.js";
import type * as suggestedActions from "../suggestedActions.js";
import type * as tags from "../tags.js";
import type * as trackerEntries from "../trackerEntries.js";
import type * as trackerProjectTags from "../trackerProjectTags.js";
import type * as trackerProjects from "../trackerProjects.js";
import type * as transactionAttachments from "../transactionAttachments.js";
import type * as transactionCategories from "../transactionCategories.js";
import type * as transactionCategoryEmbeddings from "../transactionCategoryEmbeddings.js";
import type * as transactionTags from "../transactionTags.js";
import type * as transactions from "../transactions.js";
import type * as users from "../users.js";
import type * as widgets from "../widgets.js";
import type * as yearEndPacks from "../yearEndPacks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accountingSync: typeof accountingSync;
  asyncRuns: typeof asyncRuns;
  auth: typeof auth;
  bankAccounts: typeof bankAccounts;
  bankConnections: typeof bankConnections;
  chatFeedback: typeof chatFeedback;
  chatMemory: typeof chatMemory;
  closeCompanyLoansSchedules: typeof closeCompanyLoansSchedules;
  complianceAdjustments: typeof complianceAdjustments;
  complianceLedger: typeof complianceLedger;
  complianceState: typeof complianceState;
  corporationTaxAdjustments: typeof corporationTaxAdjustments;
  corporationTaxRateSchedules: typeof corporationTaxRateSchedules;
  customerTags: typeof customerTags;
  customers: typeof customers;
  documentTagEmbeddings: typeof documentTagEmbeddings;
  documentTags: typeof documentTags;
  documents: typeof documents;
  evidencePacks: typeof evidencePacks;
  exchangeRates: typeof exchangeRates;
  files: typeof files;
  foundation: typeof foundation;
  foundationActions: typeof foundationActions;
  health: typeof health;
  http: typeof http;
  identity: typeof identity;
  inbox: typeof inbox;
  inboxAccounts: typeof inboxAccounts;
  inboxBlocklist: typeof inboxBlocklist;
  insights: typeof insights;
  insightsStore: typeof insightsStore;
  institutions: typeof institutions;
  invoiceProducts: typeof invoiceProducts;
  invoiceRecurringSeries: typeof invoiceRecurringSeries;
  invoiceTemplates: typeof invoiceTemplates;
  "lib/identity": typeof lib_identity;
  "lib/service": typeof lib_service;
  payrollRuns: typeof payrollRuns;
  publicInvoices: typeof publicInvoices;
  reportLinks: typeof reportLinks;
  shortLinks: typeof shortLinks;
  sourceLinks: typeof sourceLinks;
  submissionEvents: typeof submissionEvents;
  suggestedActions: typeof suggestedActions;
  tags: typeof tags;
  trackerEntries: typeof trackerEntries;
  trackerProjectTags: typeof trackerProjectTags;
  trackerProjects: typeof trackerProjects;
  transactionAttachments: typeof transactionAttachments;
  transactionCategories: typeof transactionCategories;
  transactionCategoryEmbeddings: typeof transactionCategoryEmbeddings;
  transactionTags: typeof transactionTags;
  transactions: typeof transactions;
  users: typeof users;
  widgets: typeof widgets;
  yearEndPacks: typeof yearEndPacks;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
