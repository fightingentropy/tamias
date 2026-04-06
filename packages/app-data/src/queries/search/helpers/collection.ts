import type { SearchCandidate, SearchPageResult } from "../types";

export function getSearchPageSize(args: { searchTerm?: string; itemsPerTableLimit: number }) {
  if (!args.searchTerm) {
    return args.itemsPerTableLimit;
  }

  return Math.min(Math.max(args.itemsPerTableLimit * 8, 50), 200);
}

export function getIndexedSearchLimit(itemsPerTableLimit: number) {
  return Math.min(Math.max(itemsPerTableLimit * 8, 80), 200);
}

function collectCandidateMatches<TRecord>(args: {
  records: TRecord[];
  itemsPerTableLimit: number;
  toCandidate: (record: TRecord) => SearchCandidate | null;
  matchesCandidate: (candidate: SearchCandidate) => boolean;
}) {
  const matches: SearchCandidate[] = [];

  for (const record of args.records) {
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

  return matches;
}

export async function collectSearchMatches<TRecord>(args: {
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

    matches.push(
      ...collectCandidateMatches({
        records: page.page,
        itemsPerTableLimit: args.itemsPerTableLimit - matches.length,
        toCandidate: args.toCandidate,
        matchesCandidate: args.matchesCandidate,
      }),
    );

    if (page.isDone) {
      break;
    }

    cursor = page.continueCursor;
  }

  return matches;
}

export async function loadCandidatesForSource<TRecord>(args: {
  searchTerm?: string;
  itemsPerTableLimit: number;
  loadSearch?: ((limit: number) => Promise<TRecord[]>) | null | undefined;
  loadPage: (cursor: string | null, pageSize: number) => Promise<SearchPageResult<TRecord>>;
  toCandidate: (record: TRecord) => SearchCandidate | null;
  matchesCandidate: (candidate: SearchCandidate) => boolean;
}) {
  if (args.searchTerm && args.loadSearch) {
    return collectCandidateMatches({
      records: await args.loadSearch(getIndexedSearchLimit(args.itemsPerTableLimit)),
      itemsPerTableLimit: args.itemsPerTableLimit,
      toCandidate: args.toCandidate,
      matchesCandidate: args.matchesCandidate,
    });
  }

  const pageSize = getSearchPageSize({
    searchTerm: args.searchTerm,
    itemsPerTableLimit: args.itemsPerTableLimit,
  });

  return collectSearchMatches({
    itemsPerTableLimit: args.itemsPerTableLimit,
    pageSize,
    loadPage: (cursor) => args.loadPage(cursor, pageSize),
    toCandidate: args.toCandidate,
    matchesCandidate: args.matchesCandidate,
  });
}
