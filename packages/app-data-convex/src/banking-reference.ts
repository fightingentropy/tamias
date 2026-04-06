import { api, createClient, serviceArgs } from "./base";

export type ExchangeRateRecord = {
  base: string;
  target: string;
  rate: number;
  updatedAt: string;
};

export type InstitutionProvider = "gocardless" | "plaid" | "teller";

export type InstitutionRecord = {
  id: string;
  name: string;
  logo: string | null;
  popularity: number;
  availableHistory: number | null;
  maximumConsentValidity: number | null;
  provider: InstitutionProvider;
  type: string | null;
  countries: string[];
};

export type UpsertInstitutionInput = {
  id: string;
  name: string;
  logo: string | null;
  provider: InstitutionProvider;
  countries: string[];
  availableHistory: number | null;
  maximumConsentValidity: number | null;
  popularity: number;
  type: string | null;
};

export async function getExchangeRatesForTargetFromConvex(args: { target: string }) {
  return createClient().query(
    api.exchangeRates.serviceGetExchangeRatesForTarget,
    serviceArgs({
      target: args.target,
    }),
  ) as Promise<ExchangeRateRecord[]>;
}

export async function upsertExchangeRatesInConvex(args: { rates: ExchangeRateRecord[] }) {
  return createClient().mutation(
    api.exchangeRates.serviceUpsertExchangeRates,
    serviceArgs({
      rates: args.rates,
    }),
  ) as Promise<{ processed: number }>;
}

export async function getInstitutionsFromConvex(args: {
  countryCode: string;
  q?: string;
  limit?: number;
  excludeProviders?: InstitutionProvider[];
}) {
  return createClient().query(
    api.institutions.serviceGetInstitutions,
    serviceArgs({
      countryCode: args.countryCode,
      q: args.q,
      limit: args.limit,
      excludeProviders: args.excludeProviders,
    }),
  ) as Promise<InstitutionRecord[]>;
}

export async function getInstitutionByIdFromConvex(args: { id: string }) {
  return createClient().query(
    api.institutions.serviceGetInstitutionById,
    serviceArgs({
      id: args.id,
    }),
  ) as Promise<InstitutionRecord | null>;
}

export async function updateInstitutionUsageInConvex(args: { id: string }) {
  return createClient().mutation(
    api.institutions.serviceUpdateInstitutionUsage,
    serviceArgs({
      id: args.id,
    }),
  ) as Promise<InstitutionRecord | null>;
}

export async function upsertInstitutionsInConvex(args: { institutions: UpsertInstitutionInput[] }) {
  return createClient().mutation(
    api.institutions.serviceUpsertInstitutions,
    serviceArgs({
      institutions: args.institutions,
    }),
  ) as Promise<number>;
}

export async function getActiveInstitutionIdsFromConvex(args?: {
  providers?: InstitutionProvider[];
}) {
  return createClient().query(
    api.institutions.serviceGetActiveInstitutionIds,
    serviceArgs({
      providers: args?.providers,
    }),
  ) as Promise<string[]>;
}

export async function markInstitutionsRemovedInConvex(args: { ids: string[] }) {
  return createClient().mutation(
    api.institutions.serviceMarkInstitutionsRemoved,
    serviceArgs({
      ids: args.ids,
    }),
  ) as Promise<number>;
}
