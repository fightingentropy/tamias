import type { InvoiceStatus } from "../invoice-projections";

export type GlobalSearchReturnType = {
  id: string;
  type: string;
  title: string;
  relevance: number;
  created_at: string;
  data: any;
};

export type SearchSourceType =
  | "customers"
  | "documents"
  | "invoices"
  | "tracker_projects"
  | "transactions";

export type SearchCandidate = GlobalSearchReturnType & {
  sourceType: SearchSourceType;
  searchText: string;
  filterDate: string | null;
  dueDate: string | null;
  amount: number | null;
  currency: string | null;
  status: string | null;
};

export type SearchCandidateLoadParams = {
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

export type RawSearchCandidateLoadParams = {
  teamId: string;
  searchTerm?: string;
  itemsPerTableLimit: number;
};

export type SearchPageResult<TRecord> = {
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

export type GlobalSearchParams = {
  teamId: string;
  searchTerm?: string;
  limit?: number;
  itemsPerTableLimit?: number;
  language?: string;
  relevanceThreshold?: number;
};

export const ALL_SEARCH_SOURCE_TYPES: SearchSourceType[] = [
  "customers",
  "documents",
  "invoices",
  "tracker_projects",
  "transactions",
];

export const INVOICE_SEARCH_STATUSES = new Set<InvoiceStatus>([
  "draft",
  "overdue",
  "paid",
  "unpaid",
  "canceled",
  "scheduled",
  "refunded",
]);

export const TRACKER_PROJECT_SEARCH_STATUSES = new Set(["in_progress", "completed"]);

export const TRANSACTION_SEARCH_STATUS_VALUES = [
  "posted",
  "pending",
  "excluded",
  "completed",
  "archived",
  "exported",
] as const;

export const TRANSACTION_SEARCH_STATUSES = new Set<string>(TRANSACTION_SEARCH_STATUS_VALUES);
