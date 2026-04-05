import {
  ALL_SEARCH_SOURCE_TYPES,
  type RawSearchCandidateLoadParams,
  type SearchCandidate,
  type SearchSourceType,
} from "../types";
import { loadRawCustomerCandidates } from "./customers";
import { loadRawDocumentCandidates } from "./documents";
import { loadRawInvoiceCandidates } from "./invoices";
import { loadRawTrackerProjectCandidates } from "./tracker-projects";
import { loadRawTransactionCandidates } from "./transactions";

type RawSearchCandidateLoader = (
  params: RawSearchCandidateLoadParams,
) => Promise<SearchCandidate[]>;

const rawSearchCandidateLoaders: Record<
  SearchSourceType,
  RawSearchCandidateLoader
> = {
  customers: loadRawCustomerCandidates,
  documents: loadRawDocumentCandidates,
  invoices: loadRawInvoiceCandidates,
  tracker_projects: loadRawTrackerProjectCandidates,
  transactions: loadRawTransactionCandidates,
};

export async function loadRawSearchCandidates(
  params: RawSearchCandidateLoadParams,
) {
  const loads = await Promise.all(
    ALL_SEARCH_SOURCE_TYPES.map((sourceType) =>
      rawSearchCandidateLoaders[sourceType](params),
    ),
  );

  return loads.flat();
}
