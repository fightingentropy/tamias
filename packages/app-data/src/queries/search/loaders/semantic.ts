import {
  getRequestedSourceTypes,
  sourceCanMatchFilters,
} from "../helpers";
import type {
  SearchCandidate,
  SearchCandidateLoadParams,
  SearchSourceType,
} from "../types";
import { loadCustomerCandidates } from "./customers";
import { loadDocumentCandidates } from "./documents";
import { loadInvoiceCandidates } from "./invoices";
import { loadTrackerProjectCandidates } from "./tracker-projects";
import { loadTransactionCandidates } from "./transactions";

type SearchCandidateLoader = (
  params: SearchCandidateLoadParams,
) => Promise<SearchCandidate[]>;

const semanticSearchCandidateLoaders: Record<
  SearchSourceType,
  SearchCandidateLoader
> = {
  customers: loadCustomerCandidates,
  documents: loadDocumentCandidates,
  invoices: loadInvoiceCandidates,
  tracker_projects: loadTrackerProjectCandidates,
  transactions: loadTransactionCandidates,
};

export async function loadSearchCandidates(params: SearchCandidateLoadParams) {
  const requestedSourceTypes = getRequestedSourceTypes(params.types).filter(
    (sourceType) => sourceCanMatchFilters(sourceType, params),
  );
  const loads = await Promise.all(
    requestedSourceTypes.map((sourceType) =>
      semanticSearchCandidateLoaders[sourceType](params),
    ),
  );

  return loads.flat();
}
