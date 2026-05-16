import {
  buildSearchIndexText,
  normalizeEmail,
  normalizeOptionalString,
  tokenizeSearchValue,
  nowIso,
} from "@tamias/domain";
import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "../../client";
import type { SearchPageResult } from "../search/types";
import type {
  CustomerRecord,
  CustomerTag,
  DeleteCustomerParams,
  GetCustomerByIdParams,
  GetCustomerByPortalIdParams,
  GetCustomersParams,
  ToggleCustomerPortalParams,
  UpsertCustomerParams,
} from "./types";

export type CustomerTagAssignmentRecord = {
  customerId: string;
  tagId: string;
  teamId: string;
  createdAt: string;
  updatedAt: string;
};

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

type CustomerRow = {
  id: string;
  team_id: string;
  name: string;
  email: string;
  billing_email: string | null;
  country: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  note: string | null;
  website: string | null;
  phone: string | null;
  vat_number: string | null;
  country_code: string | null;
  token: string | null;
  contact: string | null;
  status: string | null;
  preferred_currency: string | null;
  default_payment_terms: number | null;
  is_archived: number;
  source: string | null;
  external_id: string | null;
  logo_url: string | null;
  description: string | null;
  industry: string | null;
  company_type: string | null;
  employee_count: string | null;
  founded_year: number | null;
  estimated_revenue: string | null;
  funding_stage: string | null;
  total_funding: string | null;
  headquarters_location: string | null;
  timezone: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  ceo_name: string | null;
  finance_contact: string | null;
  finance_contact_email: string | null;
  primary_language: string | null;
  fiscal_year_end: string | null;
  enrichment_status: string | null;
  enriched_at: string | null;
  portal_enabled: number;
  portal_id: string | null;
  search_text: string | null;
  created_at: string;
  updated_at: string;
};

type CustomerTagRow = {
  customer_id: string;
  tag_id: string;
  team_id: string;
  tag_name: string | null;
  created_at: string;
  updated_at: string;
};

type NormalizedCustomerValues = {
  id: string;
  createdAt?: string | null;
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
  isArchived: boolean | null;
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
  portalEnabled: boolean | null;
  portalId: string | null;
};

function toBoolean(value: number | boolean | null | undefined) {
  return value === true || value === 1;
}

function toCustomerRecord(row: CustomerRow): CustomerRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    teamId: row.team_id,
    name: row.name,
    email: row.email,
    billingEmail: row.billing_email,
    country: row.country,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    state: row.state,
    zip: row.zip,
    note: row.note,
    website: row.website,
    phone: row.phone,
    vatNumber: row.vat_number,
    countryCode: row.country_code,
    token: row.token,
    contact: row.contact,
    status: row.status,
    preferredCurrency: row.preferred_currency,
    defaultPaymentTerms: row.default_payment_terms,
    isArchived: toBoolean(row.is_archived),
    source: row.source,
    externalId: row.external_id,
    logoUrl: row.logo_url,
    description: row.description,
    industry: row.industry,
    companyType: row.company_type,
    employeeCount: row.employee_count,
    foundedYear: row.founded_year,
    estimatedRevenue: row.estimated_revenue,
    fundingStage: row.funding_stage,
    totalFunding: row.total_funding,
    headquartersLocation: row.headquarters_location,
    timezone: row.timezone,
    linkedinUrl: row.linkedin_url,
    twitterUrl: row.twitter_url,
    instagramUrl: row.instagram_url,
    facebookUrl: row.facebook_url,
    ceoName: row.ceo_name,
    financeContact: row.finance_contact,
    financeContactEmail: row.finance_contact_email,
    primaryLanguage: row.primary_language,
    fiscalYearEnd: row.fiscal_year_end,
    enrichmentStatus: row.enrichment_status,
    enrichedAt: row.enriched_at,
    portalEnabled: toBoolean(row.portal_enabled),
    portalId: row.portal_id,
  };
}

function toCustomerForEnrichment(row: CustomerRow): CustomerForEnrichmentRecord {
  return {
    id: row.id,
    name: row.name,
    website: row.website,
    teamId: row.team_id,
    email: row.email,
    country: row.country,
    countryCode: row.country_code,
    city: row.city,
    state: row.state,
    addressLine1: row.address_line1,
    phone: row.phone,
    vatNumber: row.vat_number,
    note: row.note,
    contact: row.contact,
  };
}

function buildCustomerSearchText(
  customer: Pick<
    CustomerRecord,
    | "name"
    | "email"
    | "billingEmail"
    | "website"
    | "phone"
    | "contact"
    | "note"
    | "description"
    | "industry"
    | "city"
    | "state"
    | "country"
    | "financeContact"
    | "financeContactEmail"
    | "status"
    | "preferredCurrency"
    | "externalId"
    | "vatNumber"
    | "companyType"
  >,
) {
  return (
    buildSearchIndexText([
      customer.name,
      customer.email,
      customer.billingEmail,
      customer.website,
      customer.phone,
      customer.contact,
      customer.note,
      customer.description,
      customer.industry,
      customer.city,
      customer.state,
      customer.country,
      customer.financeContact,
      customer.financeContactEmail,
      customer.status,
      customer.preferredCurrency,
      customer.externalId,
      customer.vatNumber,
      customer.companyType,
    ]) || null
  );
}

function normalizeCustomerValues(params: UpsertCustomerParams): NormalizedCustomerValues {
  return {
    id: params.id ?? crypto.randomUUID(),
    createdAt: params.createdAt,
    name: params.name.trim(),
    email: normalizeEmail(params.email) ?? params.email.trim().toLowerCase(),
    billingEmail: normalizeEmail(params.billingEmail),
    country: normalizeOptionalString(params.country),
    addressLine1: normalizeOptionalString(params.addressLine1),
    addressLine2: normalizeOptionalString(params.addressLine2),
    city: normalizeOptionalString(params.city),
    state: normalizeOptionalString(params.state),
    zip: normalizeOptionalString(params.zip),
    note: normalizeOptionalString(params.note),
    website: normalizeOptionalString(params.website),
    phone: normalizeOptionalString(params.phone),
    vatNumber: normalizeOptionalString(params.vatNumber),
    countryCode: normalizeOptionalString(params.countryCode),
    token: normalizeOptionalString(params.token),
    contact: normalizeOptionalString(params.contact),
    status: normalizeOptionalString(params.status),
    preferredCurrency: normalizeOptionalString(params.preferredCurrency),
    defaultPaymentTerms: params.defaultPaymentTerms ?? null,
    isArchived: params.isArchived ?? null,
    source: normalizeOptionalString(params.source),
    externalId: normalizeOptionalString(params.externalId),
    logoUrl: normalizeOptionalString(params.logoUrl),
    description: normalizeOptionalString(params.description),
    industry: normalizeOptionalString(params.industry),
    companyType: normalizeOptionalString(params.companyType),
    employeeCount: normalizeOptionalString(params.employeeCount),
    foundedYear: params.foundedYear ?? null,
    estimatedRevenue: normalizeOptionalString(params.estimatedRevenue),
    fundingStage: normalizeOptionalString(params.fundingStage),
    totalFunding: normalizeOptionalString(params.totalFunding),
    headquartersLocation: normalizeOptionalString(params.headquartersLocation),
    timezone: normalizeOptionalString(params.timezone),
    linkedinUrl: normalizeOptionalString(params.linkedinUrl),
    twitterUrl: normalizeOptionalString(params.twitterUrl),
    instagramUrl: normalizeOptionalString(params.instagramUrl),
    facebookUrl: normalizeOptionalString(params.facebookUrl),
    ceoName: normalizeOptionalString(params.ceoName),
    financeContact: normalizeOptionalString(params.financeContact),
    financeContactEmail: normalizeEmail(params.financeContactEmail),
    primaryLanguage: normalizeOptionalString(params.primaryLanguage),
    fiscalYearEnd: normalizeOptionalString(params.fiscalYearEnd),
    enrichmentStatus: normalizeOptionalString(params.enrichmentStatus),
    enrichedAt: normalizeOptionalString(params.enrichedAt),
    portalEnabled: params.portalEnabled ?? null,
    portalId: normalizeOptionalString(params.portalId),
  };
}

function getSearchTextFromNormalizedCustomer(values: NormalizedCustomerValues) {
  return buildCustomerSearchText({
    name: values.name,
    email: values.email,
    billingEmail: values.billingEmail,
    website: values.website,
    phone: values.phone,
    contact: values.contact,
    note: values.note,
    description: values.description,
    industry: values.industry,
    city: values.city,
    state: values.state,
    country: values.country,
    financeContact: values.financeContact,
    financeContactEmail: values.financeContactEmail,
    status: values.status,
    preferredCurrency: values.preferredCurrency,
    externalId: values.externalId,
    vatNumber: values.vatNumber,
    companyType: values.companyType,
  });
}

function buildCustomerSearchWhere(
  params: Pick<GetCustomersParams, "q"> & { teamId: string; status?: string | null },
) {
  const filters = ["team_id = ?"];
  const values: unknown[] = [params.teamId];

  if (params.status) {
    filters.push("status = ?");
    values.push(params.status);
  }

  return {
    clause: filters.join(" and "),
    values,
  };
}

function buildCustomerSearchFtsQuery(query?: string | null) {
  const tokens = tokenizeSearchValue(query);
  if (tokens.length === 0) {
    return null;
  }

  return tokens.map((token) => `${token}*`).join(" ");
}

function getCustomerOrder(sort?: string[] | null, tableAlias = "") {
  const column = (name: string) => `${tableAlias}${name}`;

  if (!sort || sort.length === 0) {
    return `${column("created_at")} desc, ${column("name")} asc`;
  }

  const [sortColumn, direction = "desc"] = sort;
  const sqlDirection = direction === "asc" ? "asc" : "desc";

  switch (sortColumn) {
    case "name":
      return `${column("name")} ${sqlDirection}, ${column("created_at")} desc`;
    case "created_at":
      return `${column("created_at")} ${sqlDirection}, ${column("name")} asc`;
    case "contact":
      return `${column("contact")} ${sqlDirection}, ${column("created_at")} desc`;
    case "email":
      return `${column("email")} ${sqlDirection}, ${column("created_at")} desc`;
    case "industry":
      return `${column("industry")} ${sqlDirection}, ${column("created_at")} desc`;
    case "country":
      return `${column("country")} ${sqlDirection}, ${column("created_at")} desc`;
    default:
      return `${column("created_at")} desc, ${column("name")} asc`;
  }
}

async function replaceCustomerSearchFtsEntry(
  d1: CloudflareD1DatabaseBinding,
  params: { customerId: string; teamId: string; searchText: string | null },
) {
  await d1
    .prepare("delete from customer_search_fts where customer_id = ? and team_id = ?")
    .bind(params.customerId, params.teamId)
    .run();
  await d1
    .prepare("insert into customer_search_fts (customer_id, team_id, search_text) values (?, ?, ?)")
    .bind(params.customerId, params.teamId, params.searchText ?? "")
    .run();
}

async function deleteCustomerSearchFtsEntry(
  d1: CloudflareD1DatabaseBinding,
  params: { customerId: string; teamId: string },
) {
  await d1
    .prepare("delete from customer_search_fts where customer_id = ? and team_id = ?")
    .bind(params.customerId, params.teamId)
    .run();
}

export function getCustomersD1(db: Database) {
  return requireCloudflareD1Database(db);
}

export function requireCustomersD1(db: Database) {
  const d1 = getCustomersD1(db);

  if (!d1) {
    throw new Error("Customers require Cloudflare D1");
  }

  return d1;
}

export async function getCustomerByIdFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: GetCustomerByIdParams,
) {
  const row = await d1
    .prepare("select * from customers where id = ? and team_id = ? limit 1")
    .bind(params.id, params.teamId)
    .first<CustomerRow>();

  return row ? toCustomerRecord(row) : null;
}

export async function getCustomersByIdsFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: { teamId: string; customerIds: string[] },
) {
  const customerIds = [...new Set(params.customerIds)];

  if (customerIds.length === 0) {
    return [];
  }

  const { results = [] } = await d1
    .prepare(
      `select *
       from customers
       where team_id = ?
         and id in (${customerIds.map(() => "?").join(", ")})`,
    )
    .bind(params.teamId, ...customerIds)
    .all<CustomerRow>();
  const customersById = new Map(results.map((row) => [row.id, toCustomerRecord(row)]));

  return customerIds.flatMap((customerId) => {
    const customer = customersById.get(customerId);

    return customer ? [customer] : [];
  });
}

export async function getCustomersFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: Pick<GetCustomersParams, "teamId" | "q" | "sort">,
) {
  const ftsQuery = buildCustomerSearchFtsQuery(params.q);
  if (ftsQuery) {
    const { results = [] } = await d1
      .prepare(
        `select c.*
         from customer_search_fts f
         join customers c on c.id = f.customer_id and c.team_id = f.team_id
         where f.search_text match ?
           and c.team_id = ?
         order by ${getCustomerOrder(params.sort, "c.")}`,
      )
      .bind(ftsQuery, params.teamId)
      .all<CustomerRow>();

    return results.map(toCustomerRecord);
  }

  const { clause, values } = buildCustomerSearchWhere(params);
  const { results = [] } = await d1
    .prepare(
      `select *
       from customers
       where ${clause}
       order by ${getCustomerOrder(params.sort)}`,
    )
    .bind(...values)
    .all<CustomerRow>();

  return results.map(toCustomerRecord);
}

export async function getCustomersPageFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: Pick<GetCustomersParams, "teamId" | "cursor" | "pageSize" | "q" | "sort"> & {
    order?: "asc" | "desc";
  },
): Promise<SearchPageResult<CustomerRecord>> {
  const pageSize = params.pageSize ?? 25;
  const offset = params.cursor ? Number.parseInt(params.cursor, 10) : 0;
  const sort = params.sort ?? ["created_at", params.order ?? "desc"];
  const ftsQuery = buildCustomerSearchFtsQuery(params.q);
  const limit = pageSize + 1;

  if (ftsQuery) {
    const { results = [] } = await d1
      .prepare(
        `select c.*
         from customer_search_fts f
         join customers c on c.id = f.customer_id and c.team_id = f.team_id
         where f.search_text match ?
           and c.team_id = ?
         order by ${getCustomerOrder(sort, "c.")}
         limit ? offset ?`,
      )
      .bind(ftsQuery, params.teamId, limit, offset)
      .all<CustomerRow>();
    const page = results.slice(0, pageSize);

    return {
      page: page.map(toCustomerRecord),
      isDone: results.length <= pageSize,
      continueCursor: String(offset + page.length),
    };
  }

  const { clause, values } = buildCustomerSearchWhere(params);
  const { results = [] } = await d1
    .prepare(
      `select *
       from customers
       where ${clause}
       order by ${getCustomerOrder(sort)}
       limit ? offset ?`,
    )
    .bind(...values, limit, offset)
    .all<CustomerRow>();

  const page = results.slice(0, pageSize);

  return {
    page: page.map(toCustomerRecord),
    isDone: results.length <= pageSize,
    continueCursor: String(offset + page.length),
  };
}

export async function searchCustomersFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: {
    teamId: string;
    query: string;
    status?: string | null;
    limit?: number;
  },
) {
  const ftsQuery = buildCustomerSearchFtsQuery(params.query);
  if (ftsQuery) {
    const values: unknown[] = [ftsQuery, params.teamId];
    const filters = ["f.search_text match ?", "c.team_id = ?"];

    if (params.status) {
      filters.push("c.status = ?");
      values.push(params.status);
    }

    const { results = [] } = await d1
      .prepare(
        `select c.*
         from customer_search_fts f
         join customers c on c.id = f.customer_id and c.team_id = f.team_id
         where ${filters.join(" and ")}
         order by c.created_at desc, c.name asc
         limit ?`,
      )
      .bind(...values, params.limit ?? 100)
      .all<CustomerRow>();

    return results.map(toCustomerRecord);
  }

  const { clause, values } = buildCustomerSearchWhere({
    teamId: params.teamId,
    status: params.status,
  });
  const { results = [] } = await d1
    .prepare(
      `select *
       from customers
       where ${clause}
       order by created_at desc, name asc
       limit ?`,
    )
    .bind(...values, params.limit ?? 100)
    .all<CustomerRow>();

  return results.map(toCustomerRecord);
}

export async function upsertCustomerInD1(
  d1: CloudflareD1DatabaseBinding,
  params: UpsertCustomerParams,
) {
  const timestamp = nowIso();
  const values = normalizeCustomerValues(params);
  const existing = await getCustomerByIdFromD1(d1, {
    id: values.id,
    teamId: params.teamId,
  });
  const createdAt = values.createdAt ?? existing?.createdAt ?? timestamp;
  const status = values.status ?? "active";
  const isArchived = values.isArchived ?? false;
  const source = values.source ?? "manual";
  const portalEnabled = values.portalEnabled ?? false;
  const searchText = getSearchTextFromNormalizedCustomer({
    ...values,
    status,
    source,
    isArchived,
    portalEnabled,
  });

  await d1
    .prepare(
      `insert into customers (
        id,
        team_id,
        name,
        email,
        billing_email,
        country,
        address_line1,
        address_line2,
        city,
        state,
        zip,
        note,
        website,
        phone,
        vat_number,
        country_code,
        token,
        contact,
        status,
        preferred_currency,
        default_payment_terms,
        is_archived,
        source,
        external_id,
        logo_url,
        description,
        industry,
        company_type,
        employee_count,
        founded_year,
        estimated_revenue,
        funding_stage,
        total_funding,
        headquarters_location,
        timezone,
        linkedin_url,
        twitter_url,
        instagram_url,
        facebook_url,
        ceo_name,
        finance_contact,
        finance_contact_email,
        primary_language,
        fiscal_year_end,
        enrichment_status,
        enriched_at,
        portal_enabled,
        portal_id,
        search_text,
        created_at,
        updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(id) do update set
        team_id = excluded.team_id,
        name = excluded.name,
        email = excluded.email,
        billing_email = excluded.billing_email,
        country = excluded.country,
        address_line1 = excluded.address_line1,
        address_line2 = excluded.address_line2,
        city = excluded.city,
        state = excluded.state,
        zip = excluded.zip,
        note = excluded.note,
        website = excluded.website,
        phone = excluded.phone,
        vat_number = excluded.vat_number,
        country_code = excluded.country_code,
        token = excluded.token,
        contact = excluded.contact,
        status = excluded.status,
        preferred_currency = excluded.preferred_currency,
        default_payment_terms = excluded.default_payment_terms,
        is_archived = excluded.is_archived,
        source = excluded.source,
        external_id = excluded.external_id,
        logo_url = excluded.logo_url,
        description = excluded.description,
        industry = excluded.industry,
        company_type = excluded.company_type,
        employee_count = excluded.employee_count,
        founded_year = excluded.founded_year,
        estimated_revenue = excluded.estimated_revenue,
        funding_stage = excluded.funding_stage,
        total_funding = excluded.total_funding,
        headquarters_location = excluded.headquarters_location,
        timezone = excluded.timezone,
        linkedin_url = excluded.linkedin_url,
        twitter_url = excluded.twitter_url,
        instagram_url = excluded.instagram_url,
        facebook_url = excluded.facebook_url,
        ceo_name = excluded.ceo_name,
        finance_contact = excluded.finance_contact,
        finance_contact_email = excluded.finance_contact_email,
        primary_language = excluded.primary_language,
        fiscal_year_end = excluded.fiscal_year_end,
        enrichment_status = excluded.enrichment_status,
        enriched_at = excluded.enriched_at,
        portal_enabled = excluded.portal_enabled,
        portal_id = excluded.portal_id,
        search_text = excluded.search_text,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at`,
    )
    .bind(
      values.id,
      params.teamId,
      values.name,
      values.email,
      values.billingEmail,
      values.country,
      values.addressLine1,
      values.addressLine2,
      values.city,
      values.state,
      values.zip,
      values.note,
      values.website,
      values.phone,
      values.vatNumber,
      values.countryCode,
      values.token,
      values.contact,
      status,
      values.preferredCurrency,
      values.defaultPaymentTerms,
      isArchived ? 1 : 0,
      source,
      values.externalId,
      values.logoUrl,
      values.description,
      values.industry,
      values.companyType,
      values.employeeCount,
      values.foundedYear,
      values.estimatedRevenue,
      values.fundingStage,
      values.totalFunding,
      values.headquartersLocation,
      values.timezone,
      values.linkedinUrl,
      values.twitterUrl,
      values.instagramUrl,
      values.facebookUrl,
      values.ceoName,
      values.financeContact,
      values.financeContactEmail,
      values.primaryLanguage,
      values.fiscalYearEnd,
      values.enrichmentStatus,
      values.enrichedAt,
      portalEnabled ? 1 : 0,
      values.portalId,
      searchText,
      createdAt,
      timestamp,
    )
    .run();
  await replaceCustomerSearchFtsEntry(d1, {
    customerId: values.id,
    teamId: params.teamId,
    searchText,
  });

  const customer = await getCustomerByIdFromD1(d1, {
    id: values.id,
    teamId: params.teamId,
  });

  if (!customer) {
    throw new Error("Failed to load customer after D1 upsert");
  }

  return customer;
}

export async function deleteCustomerFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: DeleteCustomerParams,
) {
  const existing = await getCustomerByIdFromD1(d1, params);

  if (!existing) {
    return null;
  }

  await d1
    .prepare("delete from customer_tag_assignments where team_id = ? and customer_id = ?")
    .bind(params.teamId, params.id)
    .run();
  await d1
    .prepare("delete from customers where id = ? and team_id = ?")
    .bind(params.id, params.teamId)
    .run();
  await deleteCustomerSearchFtsEntry(d1, {
    customerId: params.id,
    teamId: params.teamId,
  });

  return existing;
}

export async function replaceCustomerTagsInD1(
  d1: CloudflareD1DatabaseBinding,
  params: {
    teamId: string;
    customerId: string;
    tagIds: string[];
  },
) {
  const current = await getCustomerTagAssignmentsForCustomerIdsFromD1(d1, {
    teamId: params.teamId,
    customerIds: [params.customerId],
  });
  const currentCreatedAtByTagId = new Map(
    current.map((assignment) => [assignment.tagId, assignment.createdAt]),
  );
  const nextTagIds = [...new Set(params.tagIds)];
  const nextTagIdSet = new Set(nextTagIds);
  const timestamp = nowIso();

  for (const assignment of current) {
    if (!nextTagIdSet.has(assignment.tagId)) {
      await d1
        .prepare(
          `delete from customer_tag_assignments
           where team_id = ? and customer_id = ? and tag_id = ?`,
        )
        .bind(params.teamId, params.customerId, assignment.tagId)
        .run();
    }
  }

  for (const tagId of nextTagIds) {
    await d1
      .prepare(
        `insert into customer_tag_assignments (
          team_id,
          customer_id,
          tag_id,
          created_at,
          updated_at
        ) values (?, ?, ?, ?, ?)
        on conflict(team_id, customer_id, tag_id) do update set
          updated_at = excluded.updated_at`,
      )
      .bind(
        params.teamId,
        params.customerId,
        tagId,
        currentCreatedAtByTagId.get(tagId) ?? timestamp,
        timestamp,
      )
      .run();
  }

  return getCustomerTagAssignmentsForCustomerIdsFromD1(d1, {
    teamId: params.teamId,
    customerIds: [params.customerId],
  });
}

export async function getCustomerTagAssignmentsForCustomerIdsFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: {
    teamId: string;
    customerIds: string[];
  },
) {
  const customerIds = [...new Set(params.customerIds)];

  if (customerIds.length === 0) {
    return [];
  }

  const { results = [] } = await d1
    .prepare(
      `select
        customer_id,
        tag_id,
        team_id,
        null as tag_name,
        created_at,
        updated_at
       from customer_tag_assignments
       where team_id = ?
         and customer_id in (${customerIds.map(() => "?").join(", ")})
       order by created_at asc`,
    )
    .bind(params.teamId, ...customerIds)
    .all<CustomerTagRow>();

  return results.map((row) => ({
    customerId: row.customer_id,
    tagId: row.tag_id,
    teamId: row.team_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getCustomerTagsByCustomerIdFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: {
    teamId: string;
    customerIds: string[];
  },
) {
  const customerIds = [...new Set(params.customerIds)];

  if (customerIds.length === 0) {
    return new Map<string, CustomerTag[]>();
  }

  const { results = [] } = await d1
    .prepare(
      `select
        assignment.customer_id,
        assignment.tag_id,
        assignment.team_id,
        tag.name as tag_name,
        assignment.created_at,
        assignment.updated_at
       from customer_tag_assignments assignment
       inner join tags tag on tag.id = assignment.tag_id and tag.team_id = assignment.team_id
       where assignment.team_id = ?
         and assignment.customer_id in (${customerIds.map(() => "?").join(", ")})
       order by tag.name asc`,
    )
    .bind(params.teamId, ...customerIds)
    .all<CustomerTagRow>();
  const tagsByCustomerId = new Map<string, CustomerTag[]>();

  for (const row of results) {
    if (!row.tag_name) {
      continue;
    }

    const current = tagsByCustomerId.get(row.customer_id) ?? [];
    current.push({
      id: row.tag_id,
      name: row.tag_name,
    });
    tagsByCustomerId.set(row.customer_id, current);
  }

  return tagsByCustomerId;
}

export async function deleteCustomerTagsForCustomerInD1(
  d1: CloudflareD1DatabaseBinding,
  params: { teamId: string; customerId: string },
) {
  await d1
    .prepare("delete from customer_tag_assignments where team_id = ? and customer_id = ?")
    .bind(params.teamId, params.customerId)
    .run();

  return { customerId: params.customerId };
}

export async function deleteCustomerTagsForTagInD1(
  d1: CloudflareD1DatabaseBinding,
  params: { teamId: string; tagId: string },
) {
  await d1
    .prepare("delete from customer_tag_assignments where team_id = ? and tag_id = ?")
    .bind(params.teamId, params.tagId)
    .run();

  return { tagId: params.tagId };
}

export async function toggleCustomerPortalInD1(
  d1: CloudflareD1DatabaseBinding,
  params: ToggleCustomerPortalParams,
) {
  const customer = await getCustomerByIdFromD1(d1, {
    id: params.customerId,
    teamId: params.teamId,
  });

  if (!customer) {
    throw new Error("Customer not found");
  }

  const portalId =
    params.enabled && !customer.portalId
      ? crypto.randomUUID().replaceAll("-", "").slice(0, 21)
      : customer.portalId;

  await d1
    .prepare(
      `update customers
       set portal_enabled = ?, portal_id = ?, updated_at = ?
       where id = ? and team_id = ?`,
    )
    .bind(params.enabled ? 1 : 0, portalId, nowIso(), params.customerId, params.teamId)
    .run();

  return {
    id: customer.id,
    portalEnabled: params.enabled,
    portalId,
  };
}

export async function getCustomerByPortalIdFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: GetCustomerByPortalIdParams,
) {
  const row = await d1
    .prepare("select * from customers where portal_id = ? and portal_enabled = 1 limit 1")
    .bind(params.portalId)
    .first<CustomerRow>();

  return row ? toCustomerRecord(row) : null;
}

export async function getCustomerForEnrichmentFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: { teamId: string; customerId: string },
) {
  const row = await d1
    .prepare("select * from customers where id = ? and team_id = ? limit 1")
    .bind(params.customerId, params.teamId)
    .first<CustomerRow>();

  return row ? toCustomerForEnrichment(row) : null;
}

export async function updateCustomerEnrichmentStatusInD1(
  d1: CloudflareD1DatabaseBinding,
  params: {
    customerId: string;
    status: "pending" | "processing" | "completed" | "failed" | null;
  },
) {
  const existing = await d1
    .prepare("select * from customers where id = ? limit 1")
    .bind(params.customerId)
    .first<CustomerRow>();

  if (!existing) {
    return null;
  }

  await d1
    .prepare(
      `update customers
       set enrichment_status = ?, enriched_at = ?, updated_at = ?
       where id = ?`,
    )
    .bind(
      normalizeOptionalString(params.status),
      params.status === "completed" ? nowIso() : existing.enriched_at,
      nowIso(),
      params.customerId,
    )
    .run();

  return { id: params.customerId };
}

export async function updateCustomerEnrichmentInD1(
  d1: CloudflareD1DatabaseBinding,
  params: {
    teamId: string;
    customerId: string;
    data: CustomerEnrichmentUpdateRecord;
  },
) {
  const existing = await getCustomerByIdFromD1(d1, {
    id: params.customerId,
    teamId: params.teamId,
  });

  if (!existing) {
    throw new Error("Customer not found");
  }

  const nextCustomer: CustomerRecord = {
    ...existing,
    description: normalizeOptionalString(params.data.description),
    industry: normalizeOptionalString(params.data.industry),
    companyType: normalizeOptionalString(params.data.companyType),
    employeeCount: normalizeOptionalString(params.data.employeeCount),
    foundedYear: params.data.foundedYear ?? null,
    estimatedRevenue: normalizeOptionalString(params.data.estimatedRevenue),
    fundingStage: normalizeOptionalString(params.data.fundingStage),
    totalFunding: normalizeOptionalString(params.data.totalFunding),
    headquartersLocation: normalizeOptionalString(params.data.headquartersLocation),
    timezone: normalizeOptionalString(params.data.timezone),
    linkedinUrl: normalizeOptionalString(params.data.linkedinUrl),
    twitterUrl: normalizeOptionalString(params.data.twitterUrl),
    instagramUrl: normalizeOptionalString(params.data.instagramUrl),
    facebookUrl: normalizeOptionalString(params.data.facebookUrl),
    ceoName: normalizeOptionalString(params.data.ceoName),
    financeContact: normalizeOptionalString(params.data.financeContact),
    financeContactEmail: normalizeEmail(params.data.financeContactEmail),
    primaryLanguage: normalizeOptionalString(params.data.primaryLanguage),
    fiscalYearEnd: normalizeOptionalString(params.data.fiscalYearEnd),
    vatNumber: normalizeOptionalString(params.data.vatNumber),
    enrichmentStatus: "completed",
    enrichedAt: nowIso(),
  };
  const searchText = buildCustomerSearchText(nextCustomer);

  await d1
    .prepare(
      `update customers
       set description = ?,
           industry = ?,
           company_type = ?,
           employee_count = ?,
           founded_year = ?,
           estimated_revenue = ?,
           funding_stage = ?,
           total_funding = ?,
           headquarters_location = ?,
           timezone = ?,
           linkedin_url = ?,
           twitter_url = ?,
           instagram_url = ?,
           facebook_url = ?,
           ceo_name = ?,
           finance_contact = ?,
           finance_contact_email = ?,
           primary_language = ?,
           fiscal_year_end = ?,
           vat_number = ?,
           search_text = ?,
           enrichment_status = 'completed',
           enriched_at = ?,
           updated_at = ?
       where id = ? and team_id = ?`,
    )
    .bind(
      nextCustomer.description,
      nextCustomer.industry,
      nextCustomer.companyType,
      nextCustomer.employeeCount,
      nextCustomer.foundedYear,
      nextCustomer.estimatedRevenue,
      nextCustomer.fundingStage,
      nextCustomer.totalFunding,
      nextCustomer.headquartersLocation,
      nextCustomer.timezone,
      nextCustomer.linkedinUrl,
      nextCustomer.twitterUrl,
      nextCustomer.instagramUrl,
      nextCustomer.facebookUrl,
      nextCustomer.ceoName,
      nextCustomer.financeContact,
      nextCustomer.financeContactEmail,
      nextCustomer.primaryLanguage,
      nextCustomer.fiscalYearEnd,
      nextCustomer.vatNumber,
      searchText,
      nextCustomer.enrichedAt,
      nowIso(),
      params.customerId,
      params.teamId,
    )
    .run();
  await replaceCustomerSearchFtsEntry(d1, {
    customerId: params.customerId,
    teamId: params.teamId,
    searchText,
  });

  return { id: params.customerId };
}

export async function markCustomerEnrichmentFailedInD1(
  d1: CloudflareD1DatabaseBinding,
  customerId: string,
) {
  await d1
    .prepare("update customers set enrichment_status = 'failed', updated_at = ? where id = ?")
    .bind(nowIso(), customerId)
    .run();

  return { id: customerId };
}

export async function getCustomersNeedingEnrichmentFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: { teamId: string; limit?: number },
) {
  const { results = [] } = await d1
    .prepare(
      `select *
       from customers
       where team_id = ?
         and enrichment_status = 'pending'
       order by updated_at asc
       limit ?`,
    )
    .bind(params.teamId, params.limit ?? 50)
    .all<CustomerRow>();

  return results.map(toCustomerForEnrichment);
}

export async function clearCustomerEnrichmentFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: { teamId: string; customerId: string },
) {
  const existing = await getCustomerByIdFromD1(d1, {
    id: params.customerId,
    teamId: params.teamId,
  });

  if (!existing) {
    throw new Error("Customer not found");
  }

  const nextCustomer: CustomerRecord = {
    ...existing,
    description: null,
    industry: null,
    companyType: null,
    employeeCount: null,
    foundedYear: null,
    estimatedRevenue: null,
    fundingStage: null,
    totalFunding: null,
    headquartersLocation: null,
    timezone: null,
    linkedinUrl: null,
    twitterUrl: null,
    instagramUrl: null,
    facebookUrl: null,
    ceoName: null,
    financeContact: null,
    financeContactEmail: null,
    primaryLanguage: null,
    fiscalYearEnd: null,
    enrichmentStatus: null,
    enrichedAt: null,
  };
  const searchText = buildCustomerSearchText(nextCustomer);

  await d1
    .prepare(
      `update customers
       set description = null,
           industry = null,
           company_type = null,
           employee_count = null,
           founded_year = null,
           estimated_revenue = null,
           funding_stage = null,
           total_funding = null,
           headquarters_location = null,
           timezone = null,
           linkedin_url = null,
           twitter_url = null,
           instagram_url = null,
           facebook_url = null,
           ceo_name = null,
           finance_contact = null,
           finance_contact_email = null,
           primary_language = null,
           fiscal_year_end = null,
           enrichment_status = null,
           enriched_at = null,
           search_text = ?,
           updated_at = ?
       where id = ? and team_id = ?`,
    )
    .bind(searchText, nowIso(), params.customerId, params.teamId)
    .run();
  await replaceCustomerSearchFtsEntry(d1, {
    customerId: params.customerId,
    teamId: params.teamId,
    searchText,
  });

  return { id: params.customerId };
}

export async function countCustomersCreatedBetweenFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: { teamId: string; from: string; to: string },
) {
  const row = await d1
    .prepare(
      `select count(*) as count
       from customers
       where team_id = ?
         and created_at >= ?
         and created_at <= ?`,
    )
    .bind(params.teamId, params.from, params.to)
    .first<{ count: number }>();

  return row?.count ?? 0;
}

export async function getRecentCustomerCountsFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: {
    teamId: string;
    sinceIso: string;
    activeCustomerIds: ReadonlySet<string>;
  },
) {
  const newCustomersRow = await d1
    .prepare(
      `select count(*) as count
      from customers
      where team_id = ?
        and created_at >= ?`,
    )
    .bind(params.teamId, params.sinceIso)
    .first<{ count: number }>();
  const activeCustomerIds = [...params.activeCustomerIds];
  const olderCustomersRow = await d1
    .prepare(
      `select count(*) as count
       from customers
       where team_id = ?
         and created_at < ?`,
    )
    .bind(params.teamId, params.sinceIso)
    .first<{ count: number }>();
  let activeOlderCustomerCount = 0;

  for (let index = 0; index < activeCustomerIds.length; index += 90) {
    const chunk = activeCustomerIds.slice(index, index + 90);
    const activeOlderRow = await d1
      .prepare(
        `select count(*) as count
         from customers
         where team_id = ?
           and created_at < ?
           and id in (${chunk.map(() => "?").join(", ")})`,
      )
      .bind(params.teamId, params.sinceIso, ...chunk)
      .first<{ count: number }>();

    activeOlderCustomerCount += activeOlderRow?.count ?? 0;
  }

  return {
    newCustomersCount: newCustomersRow?.count ?? 0,
    inactiveClientsCount: Math.max((olderCustomersRow?.count ?? 0) - activeOlderCustomerCount, 0),
  };
}
