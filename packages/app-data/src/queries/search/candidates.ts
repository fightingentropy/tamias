import type {
  CustomerRecord,
  DocumentRecord,
  TrackerProjectRecord,
  TransactionRecord,
} from "@tamias/app-data-convex";
import { getProjectedInvoicePayload, type ProjectedInvoiceRecord } from "../invoices/shared";
import type { SearchCandidate } from "./types";

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function joinSearchText(values: Array<string | null | undefined>) {
  return values
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .join("\n");
}

function getFileName(path: string | null | undefined) {
  return path?.split("/").at(-1) ?? path ?? "";
}

export function isSearchableDocument(document: DocumentRecord) {
  return !document.name.endsWith(".folderPlaceholder");
}

export function toCustomerCandidate(customer: CustomerRecord): SearchCandidate {
  return {
    id: customer.id,
    type: "customer",
    sourceType: "customers",
    title: customer.name,
    relevance: 0,
    created_at: customer.createdAt,
    data: {
      name: customer.name,
      email: customer.email,
      website: customer.website,
      status: customer.status,
    },
    searchText: joinSearchText([
      customer.name,
      customer.email,
      customer.billingEmail,
      customer.website,
      customer.phone,
      customer.contact,
      customer.note,
      customer.description,
      customer.industry,
      customer.city,
      customer.state,
      customer.country,
    ]),
    filterDate: customer.createdAt,
    dueDate: null,
    amount: null,
    currency: customer.preferredCurrency,
    status: customer.status,
  };
}

export function toDocumentCandidate(document: DocumentRecord): SearchCandidate {
  const title = document.title ?? getFileName(document.name) ?? "Document";

  return {
    id: document.id,
    type: "vault",
    sourceType: "documents",
    title,
    relevance: 0,
    created_at: document.createdAt,
    data: {
      name: document.name,
      title: document.title,
      summary: document.summary,
      metadata: document.metadata,
      path_tokens: document.pathTokens,
      date: document.date,
      processing_status: document.processingStatus,
    },
    searchText: joinSearchText([
      document.name,
      document.title,
      document.summary,
      document.body,
      document.content,
      document.tag,
      document.language,
    ]),
    filterDate: document.date ?? document.createdAt,
    dueDate: null,
    amount: null,
    currency: null,
    status: document.processingStatus,
  };
}

export function toInvoiceCandidate(invoice: ProjectedInvoiceRecord): SearchCandidate {
  return {
    id: invoice.id,
    type: "invoice",
    sourceType: "invoices",
    title: invoice.invoiceNumber,
    relevance: 0,
    created_at: invoice.createdAt,
    data: {
      invoice_number: invoice.invoiceNumber,
      customer_name: invoice.customerName,
      amount: invoice.amount,
      currency: invoice.currency,
      status: invoice.status,
      file_path: invoice.filePath,
      due_date: invoice.dueDate,
      template: invoice.template,
    },
    searchText: joinSearchText([
      invoice.invoiceNumber,
      invoice.customerName,
      invoice.status,
      invoice.note,
      invoice.sentTo,
      invoice.currency,
    ]),
    filterDate: invoice.issueDate ?? invoice.createdAt,
    dueDate: invoice.dueDate,
    amount: invoice.amount,
    currency: invoice.currency,
    status: invoice.status,
  };
}

export function toTrackerProjectCandidate(project: TrackerProjectRecord): SearchCandidate {
  return {
    id: project.id,
    type: "tracker_project",
    sourceType: "tracker_projects",
    title: project.name,
    relevance: 0,
    created_at: project.createdAt,
    data: {
      name: project.name,
      description: project.description,
      status: project.status,
      customer_id: project.customerId,
    },
    searchText: joinSearchText([
      project.name,
      project.description,
      project.status,
      project.currency,
    ]),
    filterDate: project.createdAt,
    dueDate: null,
    amount: project.rate,
    currency: project.currency,
    status: project.status,
  };
}

export function toTransactionCandidate(transaction: TransactionRecord): SearchCandidate {
  return {
    id: transaction.id,
    type: "transaction",
    sourceType: "transactions",
    title: transaction.name,
    relevance: 0,
    created_at: transaction.createdAt,
    data: {
      name: transaction.name,
      amount: transaction.amount,
      currency: transaction.currency,
      date: transaction.date,
      status: transaction.status,
      url: `/transactions?transactionId=${transaction.id}`,
    },
    searchText: joinSearchText([
      transaction.name,
      transaction.description,
      transaction.counterpartyName,
      transaction.merchantName,
      transaction.currency,
      transaction.categorySlug,
      transaction.note,
    ]),
    filterDate: transaction.date,
    dueDate: null,
    amount: transaction.amount,
    currency: transaction.currency,
    status: transaction.status,
  };
}

export function toProjectedInvoiceCandidate(
  invoice: Parameters<typeof getProjectedInvoicePayload>[0],
  teamId: string,
) {
  const projected = getProjectedInvoicePayload(invoice);

  return projected && projected.teamId === teamId ? toInvoiceCandidate(projected) : null;
}
