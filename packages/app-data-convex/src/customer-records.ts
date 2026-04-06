import { api, convexApi, createClient, serviceArgs } from "./base";

export type CustomerRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  teamId: string;
  name: string;
  email: string;
  billingEmail: string | null;
  country: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  note: string | null;
  website: string | null;
  phone: string | null;
  vatNumber: string | null;
  countryCode: string | null;
  token: string | null;
  contact: string | null;
  status: string | null;
  preferredCurrency: string | null;
  defaultPaymentTerms: number | null;
  isArchived: boolean;
  source: string | null;
  externalId: string | null;
  logoUrl: string | null;
  description: string | null;
  industry: string | null;
  companyType: string | null;
  employeeCount: string | null;
  foundedYear: number | null;
  estimatedRevenue: string | null;
  fundingStage: string | null;
  totalFunding: string | null;
  headquartersLocation: string | null;
  timezone: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  ceoName: string | null;
  financeContact: string | null;
  financeContactEmail: string | null;
  primaryLanguage: string | null;
  fiscalYearEnd: string | null;
  enrichmentStatus: string | null;
  enrichedAt: string | null;
  portalEnabled: boolean;
  portalId: string | null;
};

export type UpsertCustomerInConvexInput = {
  teamId: string;
  id?: string | null;
  createdAt?: string | null;
  name: string;
  email: string;
  billingEmail?: string | null;
  country?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  note?: string | null;
  website?: string | null;
  phone?: string | null;
  vatNumber?: string | null;
  countryCode?: string | null;
  token?: string | null;
  contact?: string | null;
  status?: string | null;
  preferredCurrency?: string | null;
  defaultPaymentTerms?: number | null;
  isArchived?: boolean | null;
  source?: string | null;
  externalId?: string | null;
  logoUrl?: string | null;
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
  enrichmentStatus?: string | null;
  enrichedAt?: string | null;
  portalEnabled?: boolean | null;
  portalId?: string | null;
};

export async function getCustomerByIdFromConvex(args: { teamId: string; customerId: string }) {
  return createClient().query(
    api.customers.serviceGetCustomerById,
    serviceArgs({
      teamId: args.teamId,
      customerId: args.customerId,
    }),
  ) as Promise<CustomerRecord | null>;
}

export async function getCustomersByIdsFromConvex(args: { teamId: string; customerIds: string[] }) {
  return createClient().query(
    api.customers.serviceGetCustomersByIds,
    serviceArgs({
      teamId: args.teamId,
      customerIds: args.customerIds,
    }),
  ) as Promise<CustomerRecord[]>;
}

export async function getCustomersFromConvex(args: { teamId: string }) {
  return createClient().query(
    api.customers.serviceListCustomers,
    serviceArgs({
      teamId: args.teamId,
    }),
  ) as Promise<CustomerRecord[]>;
}

export async function getCustomersPageFromConvex(args: {
  teamId: string;
  cursor?: string | null;
  pageSize: number;
  order?: "asc" | "desc";
}) {
  return createClient().query(
    convexApi.customers.serviceListCustomersPage,
    serviceArgs({
      teamId: args.teamId,
      order: args.order,
      paginationOpts: {
        numItems: args.pageSize,
        cursor: args.cursor ?? null,
      },
    }),
  ) as Promise<{
    page: CustomerRecord[];
    isDone: boolean;
    continueCursor: string;
  }>;
}

export async function searchCustomersFromConvex(args: {
  teamId: string;
  query: string;
  status?: string | null;
  limit?: number;
}) {
  return createClient().query(
    convexApi.customers.serviceSearchCustomers,
    serviceArgs({
      teamId: args.teamId,
      query: args.query,
      status: args.status ?? null,
      limit: args.limit,
    }),
  ) as Promise<CustomerRecord[]>;
}

export async function rebuildCustomerSearchTextsInConvex(args: { teamId?: string | null }) {
  return createClient().mutation(
    convexApi.customers.serviceRebuildCustomerSearchTexts,
    serviceArgs({
      teamId: args.teamId ?? null,
    }),
  ) as Promise<
    Array<{
      teamId: string;
      customerCount: number;
      updatedCustomerCount: number;
    }>
  >;
}

export async function upsertCustomerInConvex(args: UpsertCustomerInConvexInput) {
  return createClient().mutation(
    api.customers.serviceUpsertCustomer,
    serviceArgs({
      teamId: args.teamId,
      id: args.id ?? undefined,
      createdAt: args.createdAt ?? undefined,
      name: args.name,
      email: args.email,
      billingEmail: args.billingEmail,
      country: args.country,
      addressLine1: args.addressLine1,
      addressLine2: args.addressLine2,
      city: args.city,
      state: args.state,
      zip: args.zip,
      note: args.note,
      website: args.website,
      phone: args.phone,
      vatNumber: args.vatNumber,
      countryCode: args.countryCode,
      token: args.token,
      contact: args.contact,
      status: args.status,
      preferredCurrency: args.preferredCurrency,
      defaultPaymentTerms: args.defaultPaymentTerms,
      isArchived: args.isArchived,
      source: args.source,
      externalId: args.externalId,
      logoUrl: args.logoUrl,
      description: args.description,
      industry: args.industry,
      companyType: args.companyType,
      employeeCount: args.employeeCount,
      foundedYear: args.foundedYear,
      estimatedRevenue: args.estimatedRevenue,
      fundingStage: args.fundingStage,
      totalFunding: args.totalFunding,
      headquartersLocation: args.headquartersLocation,
      timezone: args.timezone,
      linkedinUrl: args.linkedinUrl,
      twitterUrl: args.twitterUrl,
      instagramUrl: args.instagramUrl,
      facebookUrl: args.facebookUrl,
      ceoName: args.ceoName,
      financeContact: args.financeContact,
      financeContactEmail: args.financeContactEmail,
      primaryLanguage: args.primaryLanguage,
      fiscalYearEnd: args.fiscalYearEnd,
      enrichmentStatus: args.enrichmentStatus,
      enrichedAt: args.enrichedAt,
      portalEnabled: args.portalEnabled,
      portalId: args.portalId,
    }),
  ) as Promise<CustomerRecord>;
}

export async function deleteCustomerInConvex(args: { teamId: string; customerId: string }) {
  return createClient().mutation(
    api.customers.serviceDeleteCustomer,
    serviceArgs({
      teamId: args.teamId,
      customerId: args.customerId,
    }),
  ) as Promise<{ id: string } | null>;
}
