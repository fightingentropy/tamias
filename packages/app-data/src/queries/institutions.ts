import {
  getActiveInstitutionIdsFromConvex,
  getInstitutionByIdFromConvex,
  getInstitutionsFromConvex,
  markInstitutionsRemovedInConvex,
  upsertInstitutionsInConvex,
  updateInstitutionUsageInConvex,
} from "../convex";
import type { Database, DatabaseOrTransaction } from "../client";

type BankProvider = "gocardless" | "plaid" | "teller";

export type GetInstitutionsParams = {
  countryCode: string;
  q?: string;
  limit?: number;
  excludeProviders?: BankProvider[];
};

export async function getInstitutions(
  _db: Database | undefined,
  params: GetInstitutionsParams,
) {
  return getInstitutionsFromConvex(params);
}

export type GetInstitutionByIdParams = {
  id: string;
};

export async function getInstitutionById(
  _db: Database | undefined,
  params: GetInstitutionByIdParams,
) {
  return getInstitutionByIdFromConvex(params);
}

export type UpdateInstitutionUsageParams = {
  id: string;
};

export async function updateInstitutionUsage(
  _db: Database | undefined,
  params: UpdateInstitutionUsageParams,
) {
  return updateInstitutionUsageInConvex(params);
}

// --- Sync operations ---

export type UpsertInstitutionData = {
  id: string;
  name: string;
  logo: string | null;
  provider: "gocardless" | "plaid" | "teller";
  countries: string[];
  availableHistory: number | null;
  maximumConsentValidity: number | null;
  popularity: number;
  type: string | null;
};

export async function upsertInstitutions(
  _db: DatabaseOrTransaction | undefined,
  data: UpsertInstitutionData[],
  batchSize = 500,
): Promise<number> {
  if (data.length === 0) {
    return 0;
  }

  let total = 0;
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    total += await upsertInstitutionsInConvex({ institutions: batch });
  }

  return total;
}

export async function getActiveInstitutionIds(
  _db: DatabaseOrTransaction | undefined,
  providers?: BankProvider[],
): Promise<string[]> {
  return getActiveInstitutionIdsFromConvex({ providers });
}

export async function markInstitutionsRemoved(
  _db: DatabaseOrTransaction | undefined,
  ids: string[],
): Promise<number> {
  return markInstitutionsRemovedInConvex({ ids });
}
