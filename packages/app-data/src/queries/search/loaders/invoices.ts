import { createDatabase } from "../../../client";
import { getPublicInvoicesPage, searchPublicInvoices } from "../../public-invoices";
import { toProjectedInvoiceCandidate } from "../candidates";
import { loadCandidatesForSource, matchesSearchTerm, matchesSemanticCandidate } from "../helpers";
import type { RawSearchCandidateLoadParams, SearchCandidateLoadParams } from "../types";
import { getInvoiceStatusFilter } from "./filters";

export async function loadInvoiceCandidates(params: SearchCandidateLoadParams) {
  const statusFilter = getInvoiceStatusFilter(params.status);
  const itemsPerTableLimit = params.itemsPerTableLimit ?? 5;
  const db = params.db ?? createDatabase();

  return loadCandidatesForSource({
    searchTerm: params.searchTerm,
    itemsPerTableLimit,
    loadSearch: params.searchTerm
      ? (limit) =>
          searchPublicInvoices(db, {
            teamId: params.teamId,
            query: params.searchTerm!,
            status: statusFilter,
            limit,
          })
      : undefined,
    loadPage: (cursor, pageSize) =>
      getPublicInvoicesPage(db, {
        teamId: params.teamId,
        cursor,
        pageSize,
        order: "desc",
        status: statusFilter,
      }),
    toCandidate: (invoice) => toProjectedInvoiceCandidate(invoice, params.teamId),
    matchesCandidate: (candidate) => matchesSemanticCandidate(candidate, params),
  });
}

export async function loadRawInvoiceCandidates(params: RawSearchCandidateLoadParams) {
  const db = params.db ?? createDatabase();

  return loadCandidatesForSource({
    searchTerm: params.searchTerm,
    itemsPerTableLimit: params.itemsPerTableLimit,
    loadSearch: params.searchTerm
      ? (limit) =>
          searchPublicInvoices(db, {
            teamId: params.teamId,
            query: params.searchTerm!,
            limit,
          })
      : undefined,
    loadPage: (cursor, pageSize) =>
      getPublicInvoicesPage(db, {
        teamId: params.teamId,
        cursor,
        pageSize,
        order: "desc",
      }),
    toCandidate: (invoice) => toProjectedInvoiceCandidate(invoice, params.teamId),
    matchesCandidate: (candidate) => matchesSearchTerm(candidate, params.searchTerm),
  });
}
