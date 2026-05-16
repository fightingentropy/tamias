import type { Database } from "../client";
import {
  clearCustomerEnrichmentFromD1,
  getCustomerForEnrichmentFromD1,
  getCustomersNeedingEnrichmentFromD1,
  markCustomerEnrichmentFailedInD1,
  requireCustomersD1,
  updateCustomerEnrichmentInD1,
  updateCustomerEnrichmentStatusInD1,
} from "./customers/d1";

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
  db: Database,
  params: { customerId: string; teamId: string },
): Promise<CustomerForEnrichment | null> {
  return getCustomerForEnrichmentFromD1(requireCustomersD1(db), params);
}

/**
 * Update customer enrichment status
 */
export async function updateCustomerEnrichmentStatus(
  db: Database,
  params: {
    customerId: string;
    status: "pending" | "processing" | "completed" | "failed" | null;
  },
): Promise<void> {
  await updateCustomerEnrichmentStatusInD1(requireCustomersD1(db), params);
}

/**
 * Update customer with enrichment data
 * Only updates fields that are provided (non-undefined)
 */
export async function updateCustomerEnrichment(
  db: Database,
  params: UpdateCustomerEnrichmentParams,
): Promise<void> {
  await updateCustomerEnrichmentInD1(requireCustomersD1(db), params);
}

/**
 * Mark customer enrichment as failed
 */
export async function markCustomerEnrichmentFailed(
  db: Database,
  customerId: string,
): Promise<void> {
  await markCustomerEnrichmentFailedInD1(requireCustomersD1(db), customerId);
}

/**
 * Get customers that need enrichment (have website but not yet enriched)
 */
export async function getCustomersNeedingEnrichment(
  db: Database,
  params: { teamId: string; limit?: number },
): Promise<CustomerForEnrichment[]> {
  return getCustomersNeedingEnrichmentFromD1(requireCustomersD1(db), params);
}

/**
 * Clear all enrichment data for a customer
 */
export async function clearCustomerEnrichment(
  db: Database,
  params: { customerId: string; teamId: string },
): Promise<void> {
  await clearCustomerEnrichmentFromD1(requireCustomersD1(db), params);
}
