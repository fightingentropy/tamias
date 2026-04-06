import { Provider } from "@tamias/banking";

const PLAID_LINK_COUNTRIES = new Set(["GB", "US", "CA"]);

export type InstitutionsGetInput = {
  countryCode: string;
  q?: string;
  limit: number;
  excludeProviders?: ("plaid" | "teller")[];
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
  provider: "gocardless" | "plaid" | "teller";
  type: "personal" | "business" | null;
  country: string | null;
};

/**
 * When the Convex institution index is empty or stale, load institutions directly from Plaid
 * (same source as the nightly sync) so bank search works in dev and after sync gaps.
 */
export async function fetchPlaidInstitutionsForSearch(
  input: InstitutionsGetInput,
): Promise<InstitutionTrpcRow[]> {
  const excluded = new Set(input.excludeProviders ?? []);

  if (excluded.has("plaid")) {
    return [];
  }

  if (!PLAID_LINK_COUNTRIES.has(input.countryCode)) {
    return [];
  }

  const plaid = new Provider({ provider: "plaid" });
  const rows = await plaid.getInstitutions({ countryCode: input.countryCode });

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
      provider: "plaid" as const,
      type: null,
      country: input.countryCode,
    }));
}
