import { TrueLayerApi } from "./providers/truelayer/truelayer-api";
import type { Providers } from "./types";
import { getLogoURL } from "./utils/logo";

export type InstitutionRecord = {
  id: string;
  name: string;
  logo: string | null;
  sourceLogo: string | null;
  provider: Providers;
  countries: string[];
  availableHistory: number | null;
  maximumConsentValidity: number | null;
  popularity: number;
  type: string | null;
};

export type FetchInstitutionsResult = {
  institutions: InstitutionRecord[];
  errors: { provider: string; error: string }[];
  succeededProviders: Providers[];
};

// TrueLayer reports country as ISO-3166-1 alpha-2 lowercase, plus legacy "uk" for GB.
function normalizeTrueLayerCountry(country: string | null | undefined): string {
  if (!country) return "GB";
  const upper = country.toUpperCase();
  return upper === "UK" ? "GB" : upper;
}

async function fetchTrueLayerInstitutions(): Promise<InstitutionRecord[]> {
  const api = new TrueLayerApi();
  const providers = await api.getProviders();

  return providers.map((provider) => ({
    id: provider.provider_id,
    name: provider.display_name,
    logo: provider.logo_url ? getLogoURL(provider.provider_id, "png") : null,
    sourceLogo: provider.logo_url ?? null,
    provider: "truelayer" as const,
    countries: [normalizeTrueLayerCountry(provider.country)],
    availableHistory: null,
    maximumConsentValidity: 90,
    popularity: 5,
    type: null,
  }));
}

/**
 * Fetch institutions from all banking providers.
 * Each provider resolves its own env vars internally.
 * Returns both the fetched institutions and any errors that occurred.
 */
export async function fetchAllInstitutions(): Promise<FetchInstitutionsResult> {
  const results = await Promise.allSettled([fetchTrueLayerInstitutions()]);

  const institutions: InstitutionRecord[] = [];
  const errors: { provider: string; error: string }[] = [];
  const succeededProviders: Providers[] = [];
  const providers: Providers[] = ["truelayer"];

  for (let i = 0; i < results.length; i++) {
    const result = results[i]!;
    if (result.status === "fulfilled") {
      institutions.push(...result.value);
      succeededProviders.push(providers[i]!);
    } else {
      errors.push({
        provider: providers[i]!,
        error: result.reason?.message ?? "Unknown error",
      });
    }
  }

  return { institutions, errors, succeededProviders };
}
