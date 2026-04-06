import { api, createClient, serviceArgs } from "./base";

export type CustomerForEnrichmentRecord = {
  id: string;
  name: string;
  website: string | null;
  teamId: string;
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

export type CustomerEnrichmentUpdateRecord = {
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

export async function getCustomerForEnrichmentFromConvex(args: {
  teamId: string;
  customerId: string;
}) {
  return createClient().query(
    api.customers.serviceGetCustomerForEnrichment,
    serviceArgs({
      teamId: args.teamId,
      customerId: args.customerId,
    }),
  ) as Promise<CustomerForEnrichmentRecord | null>;
}

export async function updateCustomerEnrichmentStatusInConvex(args: {
  customerId: string;
  status: "pending" | "processing" | "completed" | "failed" | null;
}) {
  return createClient().mutation(
    api.customers.serviceUpdateCustomerEnrichmentStatus,
    serviceArgs({
      customerId: args.customerId,
      status: args.status,
    }),
  ) as Promise<{ id: string } | null>;
}

export async function updateCustomerEnrichmentInConvex(args: {
  teamId: string;
  customerId: string;
  data: CustomerEnrichmentUpdateRecord;
}) {
  return createClient().mutation(
    api.customers.serviceUpdateCustomerEnrichment,
    serviceArgs({
      teamId: args.teamId,
      customerId: args.customerId,
      description: args.data.description,
      industry: args.data.industry,
      companyType: args.data.companyType,
      employeeCount: args.data.employeeCount,
      foundedYear: args.data.foundedYear,
      estimatedRevenue: args.data.estimatedRevenue,
      fundingStage: args.data.fundingStage,
      totalFunding: args.data.totalFunding,
      headquartersLocation: args.data.headquartersLocation,
      timezone: args.data.timezone,
      linkedinUrl: args.data.linkedinUrl,
      twitterUrl: args.data.twitterUrl,
      instagramUrl: args.data.instagramUrl,
      facebookUrl: args.data.facebookUrl,
      ceoName: args.data.ceoName,
      financeContact: args.data.financeContact,
      financeContactEmail: args.data.financeContactEmail,
      primaryLanguage: args.data.primaryLanguage,
      fiscalYearEnd: args.data.fiscalYearEnd,
      vatNumber: args.data.vatNumber,
    }),
  ) as Promise<{ id: string } | null>;
}

export async function markCustomerEnrichmentFailedInConvex(args: { customerId: string }) {
  return createClient().mutation(
    api.customers.serviceMarkCustomerEnrichmentFailed,
    serviceArgs({
      customerId: args.customerId,
    }),
  ) as Promise<{ id: string } | null>;
}

export async function getCustomersNeedingEnrichmentFromConvex(args: {
  teamId: string;
  limit?: number;
}) {
  return createClient().query(
    api.customers.serviceGetCustomersNeedingEnrichment,
    serviceArgs({
      teamId: args.teamId,
      limit: args.limit,
    }),
  ) as Promise<CustomerForEnrichmentRecord[]>;
}

export async function clearCustomerEnrichmentInConvex(args: {
  teamId: string;
  customerId: string;
}) {
  return createClient().mutation(
    api.customers.serviceClearCustomerEnrichment,
    serviceArgs({
      teamId: args.teamId,
      customerId: args.customerId,
    }),
  ) as Promise<{ id: string } | null>;
}
