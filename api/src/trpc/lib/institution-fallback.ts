import { Provider } from "@tamias/banking";

const TRUELAYER_FALLBACK_COUNTRIES = new Set(["GB"]);

export type InstitutionsGetInput = {
  countryCode: string;
  q?: string;
  limit: number;
  excludeProviders?: "truelayer"[];
};

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getSearchRank(name: string, queryText: string): number {
  const normalizedName = normalizeSearchValue(name);
  const normalizedQuery = normalizeSearchValue(queryText);

  if (!normalizedQuery) {
    return 1;
  }

  if (normalizedName === normalizedQuery) {
    return 5;
  }

  if (normalizedName.startsWith(normalizedQuery)) {
    return 4;
  }

  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  const containsAllTokens = queryTokens.every((token) => normalizedName.includes(token));

  if (containsAllTokens) {
    return 3;
  }

  if (normalizedName.includes(normalizedQuery)) {
    return 2;
  }

  return 0;
}

export type InstitutionTrpcRow = {
  id: string;
  name: string;
  logo: string | null;
  popularity: number;
  availableHistory: number | null;
  maximumConsentValidity: number | null;
  provider: "truelayer";
  type: "personal" | "business" | null;
  country: string | null;
};

/**
 * When the D1 institution index is empty or stale, load institutions live from the
 * TrueLayer catalog so bank search works in dev and after sync gaps.
 */
export async function fetchLiveInstitutionsForSearch(
  input: InstitutionsGetInput,
): Promise<InstitutionTrpcRow[]> {
  const excluded = new Set(input.excludeProviders ?? []);

  if (!TRUELAYER_FALLBACK_COUNTRIES.has(input.countryCode) || excluded.has("truelayer")) {
    return [];
  }

  const api = new Provider({ provider: "truelayer" });
  const rows = await api.getInstitutions({ countryCode: input.countryCode });

  const hasSearch = !!input.q && input.q !== "*" && input.q.trim() !== "";

  return rows
    .map((row) => ({
      row,
      rank: hasSearch ? getSearchRank(row.name, input.q!) : 1,
    }))
    .filter(({ rank }) => !hasSearch || rank > 0)
    .sort((left, right) => {
      if (left.rank !== right.rank) {
        return right.rank - left.rank;
      }

      return left.row.name.localeCompare(right.row.name);
    })
    .slice(0, input.limit)
    .map(({ row }) => ({
      id: row.id,
      name: row.name,
      logo: row.logo ?? null,
      popularity: 0,
      availableHistory: null,
      maximumConsentValidity: null,
      provider: "truelayer",
      type: null,
      country: input.countryCode,
    }));
}
