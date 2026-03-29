import {
  clearCustomerEnrichmentInConvex,
  getCustomerForEnrichmentFromConvex,
  getCustomersNeedingEnrichmentFromConvex,
  markCustomerEnrichmentFailedInConvex,
  updateCustomerEnrichmentInConvex,
  updateCustomerEnrichmentStatusInConvex,
} from "@tamias/app-data-convex";
import type { Database } from "../client";

export type CustomerForEnrichment = {
  id: string;
  name: string;
  website: string | null;
  teamId: string;
  // Additional context for better enrichment
  email: string | null;
  country: string | null;
  countryCode: string | null;
  city: string | null;
  state: string | null;
  addressLine1: string | null;
  phone: string | null;
  vatNumber: string | null;
  note: string | null;
  contact: string | null;
};

export type CustomerEnrichmentUpdateData = {
  description?: string | null;
  industry?: string | null;
  companyType?: string | null;
  employeeCount?: string | null;
  foundedYear?: number | null;
  estimatedRevenue?: string | null;
  fundingStage?: string | null;
  totalFunding?: string | null;
  headquartersLocation?: string | null;
  timezone?: string | null;
  linkedinUrl?: string | null;
  twitterUrl?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  ceoName?: string | null;
  financeContact?: string | null;
  financeContactEmail?: string | null;
  primaryLanguage?: string | null;
  fiscalYearEnd?: string | null;
  vatNumber?: string | null;
};

export type UpdateCustomerEnrichmentParams = {
  customerId: string;
  teamId: string;
  data: CustomerEnrichmentUpdateData;
};

/**
 * Get customer for enrichment with additional context
 */
export async function getCustomerForEnrichment(
  _db: Database,
  params: { customerId: string; teamId: string },
): Promise<CustomerForEnrichment | null> {
  return getCustomerForEnrichmentFromConvex(params);
}

/**
 * Update customer enrichment status
 */
export async function updateCustomerEnrichmentStatus(
  _db: Database,
  params: {
    customerId: string;
    status: "pending" | "processing" | "completed" | "failed" | null;
  },
): Promise<void> {
  await updateCustomerEnrichmentStatusInConvex(params);
}

/**
 * Update customer with enrichment data
 * Only updates fields that are provided (non-undefined)
 */
export async function updateCustomerEnrichment(
  _db: Database,
  params: UpdateCustomerEnrichmentParams,
): Promise<void> {
  await updateCustomerEnrichmentInConvex(params);
}

/**
 * Mark customer enrichment as failed
 */
export async function markCustomerEnrichmentFailed(
  _db: Database,
  customerId: string,
): Promise<void> {
  await markCustomerEnrichmentFailedInConvex({ customerId });
}

/**
 * Get customers that need enrichment (have website but not yet enriched)
 */
export async function getCustomersNeedingEnrichment(
  _db: Database,
  params: { teamId: string; limit?: number },
): Promise<CustomerForEnrichment[]> {
  return getCustomersNeedingEnrichmentFromConvex(params);
}

/**
 * Clear all enrichment data for a customer
 */
export async function clearCustomerEnrichment(
  _db: Database,
  params: { customerId: string; teamId: string },
): Promise<void> {
  await clearCustomerEnrichmentInConvex(params);
}
