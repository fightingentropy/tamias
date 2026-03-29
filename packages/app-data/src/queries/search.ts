import {
  getCustomersPageFromConvex,
  getDocumentsPageFromConvex,
  getPublicInvoicesPageFromConvex,
  getTrackerProjectsPageFromConvex,
  getTransactionsPageFromConvex,
  type CustomerRecord,
  type DocumentRecord,
  type TrackerProjectRecord,
  type TransactionRecord,
} from "@tamias/app-data-convex";
import type { Database } from "../client";
import type { InvoiceStatus } from "./index";
import {
  getProjectedInvoicePayload,
  type ProjectedInvoiceRecord,
} from "./invoices/shared";

export type GlobalSearchReturnType = {
  id: string;
  type: string;
  title: string;
  relevance: number;
  created_at: string;
  data: any;
};

type SearchSourceType =
  | "customers"
  | "documents"
  | "invoices"
  | "tracker_projects"
  | "transactions";

type SearchCandidate = GlobalSearchReturnType & {
  sourceType: SearchSourceType;
  searchText: string;
  filterDate: string | null;
  dueDate: string | null;
  amount: number | null;
  currency: string | null;
  status: string | null;
};

type SearchCandidateLoadParams = {
  teamId: string;
  searchTerm?: string;
  itemsPerTableLimit?: number;
  types?: string[];
  amount?: number;
  amountMin?: number;
  amountMax?: number;
  status?: string;
  currency?: string;
  startDate?: string;
  endDate?: string;
  dueDateStart?: string;
  dueDateEnd?: string;
};

type RawSearchCandidateLoadParams = {
  teamId: string;
  searchTerm?: string;
  itemsPerTableLimit: number;
};

type SearchPageResult<TRecord> = {
  page: TRecord[];
  isDone: boolean;
  continueCursor: string;
};

export type GlobalSemanticSearchParams = {
  teamId: string;
  searchTerm: string;
  itemsPerTableLimit: number;
  language?: string;
  types?: string[];
  amount?: number;
  amountMin?: number;
  amountMax?: number;
  status?: string;
  currency?: string;
  startDate?: string;
  endDate?: string;
  dueDateStart?: string;
  dueDateEnd?: string;
};

type GlobalSearchParams = {
  teamId: string;
  searchTerm?: string;
  limit?: number;
  itemsPerTableLimit?: number;
  language?: string;
  relevanceThreshold?: number;
};

const ALL_SEARCH_SOURCE_TYPES: SearchSourceType[] = [
  "customers",
  "documents",
  "invoices",
  "tracker_projects",
  "transactions",
];
const INVOICE_SEARCH_STATUSES = new Set<InvoiceStatus>([
  "draft",
  "overdue",
  "paid",
  "unpaid",
  "canceled",
  "scheduled",
  "refunded",
]);
const TRACKER_PROJECT_SEARCH_STATUSES = new Set(["in_progress", "completed"]);
const TRANSACTION_SEARCH_STATUS_VALUES = [
  "posted",
  "pending",
  "excluded",
  "completed",
  "archived",
  "exported",
] as const;
const TRANSACTION_SEARCH_STATUSES = new Set<string>(
  TRANSACTION_SEARCH_STATUS_VALUES,
);

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

function tokenizeSearchTerm(searchTerm: string | null | undefined) {
  return normalizeText(searchTerm)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function calculateRelevance(
  searchTerm: string | null | undefined,
  searchText: string,
) {
  const tokens = tokenizeSearchTerm(searchTerm);

  if (tokens.length === 0) {
    return 1;
  }

  let matches = 0;
  let exactBoost = 0;

  for (const token of tokens) {
    if (searchText.includes(token)) {
      matches += 1;
    }
  }

  if (tokens.length > 1 && searchText.includes(tokens.join(" "))) {
    exactBoost = 0.2;
  }

  return Math.min(1, matches / tokens.length + exactBoost);
}

function matchesSearchTerm(candidate: SearchCandidate, searchTerm?: string) {
  const tokens = tokenizeSearchTerm(searchTerm);

  if (tokens.length === 0) {
    return true;
  }

  return tokens.every((token) => candidate.searchText.includes(token));
}

function matchesDateRange(value: string | null, start?: string, end?: string) {
  if (!(start || end)) {
    return true;
  }

  if (!value) {
    return false;
  }

  if (start && value < start) {
    return false;
  }

  if (end && value > end) {
    return false;
  }

  return true;
}

function matchesAmountRange(
  value: number | null,
  args: {
    amount?: number;
    amountMin?: number;
    amountMax?: number;
  },
) {
  if (args.amount == null && args.amountMin == null && args.amountMax == null) {
    return true;
  }

  if (value == null) {
    return false;
  }

  if (args.amount != null && value !== args.amount) {
    return false;
  }

  if (args.amountMin != null && value < args.amountMin) {
    return false;
  }

  if (args.amountMax != null && value > args.amountMax) {
    return false;
  }

  return true;
}

function matchesCurrency(value: string | null, currency?: string) {
  if (!currency) {
    return true;
  }

  return value === currency;
}

function matchesStatus(value: string | null, status?: string) {
  if (!status) {
    return true;
  }

  return value === status;
}

function matchesType(candidate: SearchCandidate, types?: string[]) {
  if (!types?.length) {
    return true;
  }

  return types.includes(candidate.sourceType);
}

function isSearchableDocument(document: DocumentRecord) {
  return !document.name.endsWith(".folderPlaceholder");
}

function hasAmountFilters(args: {
  amount?: number;
  amountMin?: number;
  amountMax?: number;
}) {
  return (
    args.amount != null || args.amountMin != null || args.amountMax != null
  );
}

function getRequestedSourceTypes(types?: string[]) {
  if (!types?.length) {
    return ALL_SEARCH_SOURCE_TYPES;
  }

  const requested = new Set(types);

  return ALL_SEARCH_SOURCE_TYPES.filter((sourceType) =>
    requested.has(sourceType),
  );
}

function sourceCanMatchFilters(
  sourceType: SearchSourceType,
  params: SearchCandidateLoadParams,
) {
  if (
    (params.dueDateStart || params.dueDateEnd) &&
    sourceType !== "invoices"
  ) {
    return false;
  }

  if (hasAmountFilters(params)) {
    if (sourceType === "customers" || sourceType === "documents") {
      return false;
    }
  }

  if (params.currency) {
    if (sourceType === "documents") {
      return false;
    }
  }

  if (params.status) {
    if (
      sourceType === "invoices" &&
      !INVOICE_SEARCH_STATUSES.has(params.status as InvoiceStatus)
    ) {
      return false;
    }

    if (
      sourceType === "tracker_projects" &&
      !TRACKER_PROJECT_SEARCH_STATUSES.has(params.status)
    ) {
      return false;
    }

    if (
      sourceType === "transactions" &&
      !TRANSACTION_SEARCH_STATUSES.has(params.status)
    ) {
      return false;
    }
  }

  return true;
}

function matchesSemanticCandidate(
  candidate: SearchCandidate,
  params: SearchCandidateLoadParams,
) {
  if (!matchesType(candidate, params.types)) {
    return false;
  }

  if (!matchesSearchTerm(candidate, params.searchTerm)) {
    return false;
  }

  if (
    !matchesDateRange(candidate.filterDate, params.startDate, params.endDate)
  ) {
    return false;
  }

  if (
    !matchesDateRange(candidate.dueDate, params.dueDateStart, params.dueDateEnd)
  ) {
    return false;
  }

  if (
    !matchesAmountRange(candidate.amount, {
      amount: params.amount,
      amountMin: params.amountMin,
      amountMax: params.amountMax,
    })
  ) {
    return false;
  }

  if (!matchesCurrency(candidate.currency, params.currency)) {
    return false;
  }

  return matchesStatus(candidate.status, params.status);
}

function toCustomerCandidate(customer: CustomerRecord): SearchCandidate {
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

function toDocumentCandidate(document: DocumentRecord): SearchCandidate {
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

function toInvoiceCandidate(invoice: ProjectedInvoiceRecord): SearchCandidate {
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

function toTrackerProjectCandidate(
  project: TrackerProjectRecord,
): SearchCandidate {
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

function toTransactionCandidate(
  transaction: TransactionRecord,
): SearchCandidate {
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

async function loadCustomerCandidates(params: SearchCandidateLoadParams) {
  const pageSize = getSearchPageSize({
    searchTerm: params.searchTerm,
    itemsPerTableLimit: params.itemsPerTableLimit ?? 5,
  });

  return collectSearchMatches({
    itemsPerTableLimit: params.itemsPerTableLimit ?? 5,
    pageSize,
    loadPage: (cursor) =>
      getCustomersPageFromConvex({
        teamId: params.teamId,
        cursor,
        pageSize,
        order: "desc",
      }),
    toCandidate: (customer) =>
      customer.isArchived ? null : toCustomerCandidate(customer),
    matchesCandidate: (candidate) => matchesSemanticCandidate(candidate, params),
  });
}

async function loadDocumentCandidates(params: SearchCandidateLoadParams) {
  const pageSize = getSearchPageSize({
    searchTerm: params.searchTerm,
    itemsPerTableLimit: params.itemsPerTableLimit ?? 5,
  });

  return collectSearchMatches({
    itemsPerTableLimit: params.itemsPerTableLimit ?? 5,
    pageSize,
    loadPage: (cursor) =>
      getDocumentsPageFromConvex({
        teamId: params.teamId,
        cursor,
        pageSize,
        order: "desc",
      }),
    toCandidate: (document) =>
      isSearchableDocument(document) ? toDocumentCandidate(document) : null,
    matchesCandidate: (candidate) => matchesSemanticCandidate(candidate, params),
  });
}

async function loadInvoiceCandidates(params: SearchCandidateLoadParams) {
  const statusFilter =
    params.status && INVOICE_SEARCH_STATUSES.has(params.status as InvoiceStatus)
      ? (params.status as InvoiceStatus)
      : undefined;
  const pageSize = getSearchPageSize({
    searchTerm: params.searchTerm,
    itemsPerTableLimit: params.itemsPerTableLimit ?? 5,
  });

  return collectSearchMatches({
    itemsPerTableLimit: params.itemsPerTableLimit ?? 5,
    pageSize,
    loadPage: (cursor) =>
      getPublicInvoicesPageFromConvex({
        teamId: params.teamId,
        cursor,
        pageSize,
        order: "desc",
        status: statusFilter,
      }),
    toCandidate: (invoice) => {
      const projected = getProjectedInvoicePayload(invoice);

      return projected && projected.teamId === params.teamId
        ? toInvoiceCandidate(projected)
        : null;
    },
    matchesCandidate: (candidate) => matchesSemanticCandidate(candidate, params),
  });
}

async function loadTrackerProjectCandidates(params: SearchCandidateLoadParams) {
  const pageSize = getSearchPageSize({
    searchTerm: params.searchTerm,
    itemsPerTableLimit: params.itemsPerTableLimit ?? 5,
  });

  return collectSearchMatches({
    itemsPerTableLimit: params.itemsPerTableLimit ?? 5,
    pageSize,
    loadPage: (cursor) =>
      getTrackerProjectsPageFromConvex({
        teamId: params.teamId,
        cursor,
        pageSize,
        order: "desc",
      }),
    toCandidate: (project) => toTrackerProjectCandidate(project),
    matchesCandidate: (candidate) => matchesSemanticCandidate(candidate, params),
  });
}

async function loadTransactionCandidates(params: SearchCandidateLoadParams) {
  const wantedStatus =
    params.status && TRANSACTION_SEARCH_STATUSES.has(params.status)
      ? params.status
      : undefined;
  const pageSize = getSearchPageSize({
    searchTerm: params.searchTerm,
    itemsPerTableLimit: params.itemsPerTableLimit ?? 5,
  });

  return collectSearchMatches({
    itemsPerTableLimit: params.itemsPerTableLimit ?? 5,
    pageSize,
    loadPage: (cursor) =>
      getTransactionsPageFromConvex({
        teamId: params.teamId,
        cursor,
        pageSize,
        order: "desc",
        dateGte: params.startDate,
        statusesNotIn: wantedStatus
          ? TRANSACTION_SEARCH_STATUS_VALUES.filter(
              (status) => status !== wantedStatus,
            )
          : undefined,
      }),
    toCandidate: (transaction) => toTransactionCandidate(transaction),
    matchesCandidate: (candidate) => matchesSemanticCandidate(candidate, params),
  });
}

async function loadSearchCandidates(params: SearchCandidateLoadParams) {
  const requestedSourceTypes = getRequestedSourceTypes(params.types).filter(
    (sourceType) => sourceCanMatchFilters(sourceType, params),
  );
  const loads = await Promise.all(
    requestedSourceTypes.map(async (sourceType) => {
      switch (sourceType) {
        case "customers":
          return loadCustomerCandidates(params);
        case "documents":
          return loadDocumentCandidates(params);
        case "invoices":
          return loadInvoiceCandidates(params);
        case "tracker_projects":
          return loadTrackerProjectCandidates(params);
        case "transactions":
          return loadTransactionCandidates(params);
      }
    }),
  );

  return loads.flat();
}

function getSearchPageSize(args: {
  searchTerm?: string;
  itemsPerTableLimit: number;
}) {
  if (!args.searchTerm) {
    return args.itemsPerTableLimit;
  }

  return Math.min(Math.max(args.itemsPerTableLimit * 8, 50), 200);
}

async function collectSearchMatches<TRecord>(args: {
  itemsPerTableLimit: number;
  pageSize: number;
  loadPage: (cursor: string | null) => Promise<SearchPageResult<TRecord>>;
  toCandidate: (record: TRecord) => SearchCandidate | null;
  matchesCandidate: (candidate: SearchCandidate) => boolean;
}) {
  const matches: SearchCandidate[] = [];
  let cursor: string | null = null;

  while (matches.length < args.itemsPerTableLimit) {
    const page = await args.loadPage(cursor);

    if (page.page.length === 0) {
      break;
    }

    for (const record of page.page) {
      const candidate = args.toCandidate(record);

      if (!candidate) {
        continue;
      }

      if (!args.matchesCandidate(candidate)) {
        continue;
      }

      matches.push(candidate);

      if (matches.length >= args.itemsPerTableLimit) {
        break;
      }
    }

    if (page.isDone) {
      break;
    }

    cursor = page.continueCursor;
  }

  return matches;
}

async function loadRawCustomerCandidates(params: RawSearchCandidateLoadParams) {
  const pageSize = getSearchPageSize(params);

  return collectSearchMatches({
    itemsPerTableLimit: params.itemsPerTableLimit,
    pageSize,
    loadPage: (cursor) =>
      getCustomersPageFromConvex({
        teamId: params.teamId,
        cursor,
        pageSize,
        order: "desc",
      }),
    toCandidate: (customer) =>
      customer.isArchived ? null : toCustomerCandidate(customer),
    matchesCandidate: (candidate) =>
      matchesSearchTerm(candidate, params.searchTerm),
  });
}

async function loadRawDocumentCandidates(params: RawSearchCandidateLoadParams) {
  const pageSize = getSearchPageSize(params);

  return collectSearchMatches({
    itemsPerTableLimit: params.itemsPerTableLimit,
    pageSize,
    loadPage: (cursor) =>
      getDocumentsPageFromConvex({
        teamId: params.teamId,
        cursor,
        pageSize,
        order: "desc",
      }),
    toCandidate: (document) =>
      isSearchableDocument(document) ? toDocumentCandidate(document) : null,
    matchesCandidate: (candidate) =>
      matchesSearchTerm(candidate, params.searchTerm),
  });
}

async function loadRawInvoiceCandidates(params: RawSearchCandidateLoadParams) {
  const pageSize = getSearchPageSize(params);

  return collectSearchMatches({
    itemsPerTableLimit: params.itemsPerTableLimit,
    pageSize,
    loadPage: (cursor) =>
      getPublicInvoicesPageFromConvex({
        teamId: params.teamId,
        cursor,
        pageSize,
        order: "desc",
      }),
    toCandidate: (invoice) => {
      const projected = getProjectedInvoicePayload(invoice);

      return projected && projected.teamId === params.teamId
        ? toInvoiceCandidate(projected)
        : null;
    },
    matchesCandidate: (candidate) =>
      matchesSearchTerm(candidate, params.searchTerm),
  });
}

async function loadRawTrackerProjectCandidates(
  params: RawSearchCandidateLoadParams,
) {
  const pageSize = getSearchPageSize(params);

  return collectSearchMatches({
    itemsPerTableLimit: params.itemsPerTableLimit,
    pageSize,
    loadPage: (cursor) =>
      getTrackerProjectsPageFromConvex({
        teamId: params.teamId,
        cursor,
        pageSize,
        order: "desc",
      }),
    toCandidate: (project) => toTrackerProjectCandidate(project),
    matchesCandidate: (candidate) =>
      matchesSearchTerm(candidate, params.searchTerm),
  });
}

async function loadRawTransactionCandidates(params: RawSearchCandidateLoadParams) {
  const pageSize = getSearchPageSize(params);

  return collectSearchMatches({
    itemsPerTableLimit: params.itemsPerTableLimit,
    pageSize,
    loadPage: (cursor) =>
      getTransactionsPageFromConvex({
        teamId: params.teamId,
        cursor,
        pageSize,
        order: "desc",
      }),
    toCandidate: (transaction) => toTransactionCandidate(transaction),
    matchesCandidate: (candidate) =>
      matchesSearchTerm(candidate, params.searchTerm),
  });
}

async function loadRawSearchCandidates(params: RawSearchCandidateLoadParams) {
  const loads = await Promise.all(
    ALL_SEARCH_SOURCE_TYPES.map(async (sourceType) => {
      switch (sourceType) {
        case "customers":
          return loadRawCustomerCandidates(params);
        case "documents":
          return loadRawDocumentCandidates(params);
        case "invoices":
          return loadRawInvoiceCandidates(params);
        case "tracker_projects":
          return loadRawTrackerProjectCandidates(params);
        case "transactions":
          return loadRawTransactionCandidates(params);
      }
    }),
  );

  return loads.flat();
}

function rankAndLimitCandidates(
  candidates: SearchCandidate[],
  args: {
    searchTerm?: string;
    relevanceThreshold?: number;
    limit: number;
    itemsPerTableLimit: number;
  },
) {
  const ranked = candidates
    .map((candidate) => ({
      ...candidate,
      relevance: calculateRelevance(args.searchTerm, candidate.searchText),
    }))
    .filter((candidate) =>
      args.searchTerm
        ? candidate.relevance >= (args.relevanceThreshold ?? 0) &&
          candidate.relevance > 0
        : true,
    )
    .sort((left, right) => {
      if (right.relevance !== left.relevance) {
        return right.relevance - left.relevance;
      }

      return right.created_at.localeCompare(left.created_at);
    });

  const countsBySourceType = new Map<SearchSourceType, number>();
  const limitedPerType: GlobalSearchReturnType[] = [];

  for (const candidate of ranked) {
    const current = countsBySourceType.get(candidate.sourceType) ?? 0;

    if (current >= args.itemsPerTableLimit) {
      continue;
    }

    countsBySourceType.set(candidate.sourceType, current + 1);
    limitedPerType.push(candidate);
  }

  return limitedPerType
    .sort((left, right) => {
      if (right.relevance !== left.relevance) {
        return right.relevance - left.relevance;
      }

      return right.created_at.localeCompare(left.created_at);
    })
    .slice(0, args.limit);
}

export async function globalSemanticSearchQuery(
  _db: Database,
  params: GlobalSemanticSearchParams,
): Promise<GlobalSearchReturnType[]> {
  const candidates = await loadSearchCandidates(params);

  return rankAndLimitCandidates(
    candidates.filter((candidate) => matchesSemanticCandidate(candidate, params)),
    {
      searchTerm: params.searchTerm,
      relevanceThreshold: 0,
      limit: params.itemsPerTableLimit * 5,
      itemsPerTableLimit: params.itemsPerTableLimit,
    },
  );
}

export async function globalSearchQuery(
  _db: Database,
  params: GlobalSearchParams,
) {
  const itemsPerTableLimit = params.itemsPerTableLimit ?? 5;
  const candidates = await loadRawSearchCandidates({
    teamId: params.teamId,
    searchTerm: params.searchTerm,
    itemsPerTableLimit,
  });

  return rankAndLimitCandidates(candidates, {
    searchTerm: params.searchTerm,
    relevanceThreshold: params.relevanceThreshold,
    limit: params.limit ?? 30,
    itemsPerTableLimit,
  });
}
