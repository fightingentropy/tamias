import { createHash } from "node:crypto";
import {
  CompaniesHouseCompanyProfileSchema,
  type CompaniesHouseCompanyProfile,
  COMPANIES_HOUSE_PSC_DISCREPANCY_SCOPE,
  COMPANIES_HOUSE_PROFILE_SCOPE,
  type CompaniesHouseEnvironment,
  CompaniesHouseFilingHistoryPageSchema,
  type CompaniesHouseFilingHistoryItem,
  type CompaniesHouseFilingHistoryPage,
  type CompaniesHouseProviderConfig,
  CompaniesHouseProviderConfigSchema,
  type CompaniesHouseTransaction,
  type CompaniesHouseUserProfile,
} from "../types";

export {
  COMPANIES_HOUSE_PROFILE_SCOPE,
  COMPANIES_HOUSE_PSC_DISCREPANCY_SCOPE,
} from "../types";

type OAuthCredentials = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

type CompaniesHouseTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
};

type CompaniesHouseVerifyResponse = {
  user_id?: string;
  scope?: string;
};

type CompaniesHouseUserProfileResponse = {
  id: string;
  email?: string;
  forename?: string;
  surname?: string;
  language?: string;
};

type CompaniesHouseCompanyProfileResponse = {
  company_name: string;
  company_number: string;
  company_status?: string;
  can_file?: boolean;
  type?: string;
  accounts?: {
    accounting_reference_date?: {
      day?: number | string;
      month?: number | string;
    };
    last_accounts?: {
      made_up_to?: string;
      period_end_on?: string;
      period_start_on?: string;
      type?: string;
    };
    next_accounts?: {
      due_on?: string;
      overdue?: boolean;
      period_end_on?: string;
      period_start_on?: string;
    };
    next_due?: string;
    next_made_up_to?: string;
    overdue?: boolean;
  };
  links?: {
    filing_history?: string;
    self?: string;
  };
};

type CompaniesHouseFilingHistoryListResponse = {
  items?: Array<{
    transaction_id?: string;
    category?: string;
    subcategory?: string;
    type?: string;
    date?: string;
    description?: string;
    description_values?: Record<string, string>;
    pages?: number;
    paper_filed?: boolean;
    links?: {
      document_metadata?: string;
      self?: string;
    };
  }>;
  items_per_page?: number;
  start_index?: number;
  total_count?: number;
};

type CompaniesHouseTransactionResponse = {
  id: string;
  company_number?: string;
  company_name?: string;
  description?: string;
  reference?: string;
  resume_journey_uri?: string;
  status: "open" | "closed";
  created_at?: string;
  updated_at?: string;
  closed_at?: string;
  filings?: Record<
    string,
    {
      company_number?: string;
      description?: string;
      description_identifier?: string;
      status?: "accepted" | "processing" | "rejected";
      type?: "accounts" | "change-of-registered-office-address";
      created_on?: string;
      processed_at?: string;
      reject_reasons?: Array<{
        english?: string;
        welsh?: string;
      }>;
    }
  >;
  resources?: Record<
    string,
    {
      kind?: string;
      links?: {
        resource?: string;
        validation_status?: string;
        costs?: string;
      };
      updated_at?: string;
    }
  >;
  links?: {
    self?: string;
    payment?: string;
    validation_status?: string;
  };
};

type CompaniesHouseRegisteredOfficeAddressResponse = {
  etag?: string;
  kind?: string;
  premises?: string;
  address_line_1?: string;
  address_line_2?: string;
  locality?: string;
  region?: string;
  postal_code?: string;
  country?: string;
  links?: {
    self?: string;
    validation_status?: string;
  };
};

type CompaniesHouseRegisteredEmailAddressResponse = {
  etag?: string;
  kind?: string;
  registered_email_address?: string;
  accept_appropriate_email_address_statement?: boolean;
  links?: {
    self?: string;
    validation_status?: string;
  };
};

type CompaniesHouseValidationStatusResponse = Record<string, unknown>;
type CompaniesHouseRegisteredEmailEligibilityResponse = Record<string, unknown>;

type CompaniesHouseDiscrepancyReportResponse = {
  material_discrepancies?: string[];
  obliged_entity_type?: string;
  obliged_entity_organisation_name?: string;
  obliged_entity_contact_name?: string;
  obliged_entity_email?: string;
  company_number?: string;
  status?: string;
  etag?: string;
  kind?: string;
  links?: {
    self?: string;
  };
};

type CompaniesHouseDiscrepancyResponse = {
  details?: string;
  psc_name?: string;
  psc_date_of_birth?: string;
  psc_type?: string;
  psc_discrepancy_types?: string[];
  etag?: string;
  kind?: string;
  links?: {
    self?: string;
    psc_discrepancy_report?: string;
  };
};

export const COMPANIES_HOUSE_COMPANY_SCOPE_KINDS = [
  "registered-office-address.update",
  "registered-email-address.update",
] as const;

export const COMPANIES_HOUSE_PSC_DISCREPANCY_SCOPE_KIND =
  "psc-discrepancy-reports.write-full" as const;

export const COMPANIES_HOUSE_SCOPE_KINDS = [
  ...COMPANIES_HOUSE_COMPANY_SCOPE_KINDS,
  COMPANIES_HOUSE_PSC_DISCREPANCY_SCOPE_KIND,
] as const;

export type CompaniesHouseCompanyScopeKind =
  (typeof COMPANIES_HOUSE_COMPANY_SCOPE_KINDS)[number];

export type CompaniesHouseScopeKind =
  (typeof COMPANIES_HOUSE_SCOPE_KINDS)[number];

export type CompaniesHouseRegisteredOfficeAddress = {
  etag?: string;
  kind?: string;
  premises?: string;
  addressLine1?: string;
  addressLine2?: string;
  locality?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  links?: {
    self?: string;
    validationStatus?: string;
  };
};

export type CompaniesHouseRegisteredEmailAddress = {
  etag?: string;
  kind?: string;
  registeredEmailAddress?: string;
  acceptAppropriateEmailAddressStatement?: boolean;
  links?: {
    self?: string;
    validationStatus?: string;
  };
};

export type CompaniesHouseValidationStatus = {
  raw: Record<string, unknown>;
  isValid?: boolean;
  status?: string;
  validationStatus?: string;
  errors?: Array<Record<string, unknown>>;
};

export type CompaniesHouseXmlGatewayEnvironment = "test" | "production";

type CompaniesHouseXmlGatewayCredentials = {
  presenterId: string;
  presenterAuthenticationCode: string;
  packageReference: string;
};

export type CompaniesHouseSubmissionRejectReason = {
  rejectCode: string | null;
  description: string | null;
  instanceNumber: string | null;
};

export type CompaniesHouseSubmissionStatus = {
  submissionNumber: string | null;
  statusCode: string | null;
  companyNumber: string | null;
  examinerTelephone: string | null;
  examinerComment: string | null;
  rejections: CompaniesHouseSubmissionRejectReason[];
};

export type CompaniesHouseGatewayMessage = {
  className: string | null;
  qualifier: string | null;
  transactionId: string | null;
  gatewayTimestamp: string | null;
  statuses: CompaniesHouseSubmissionStatus[];
  rawXml: string;
};

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function readXmlTagValue(xml: string, tagName: string) {
  const match = new RegExp(
    `<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)</${tagName}>`,
    "i",
  ).exec(xml);

  return match?.[1]?.trim() ?? null;
}

function readXmlBlocks(xml: string, tagName: string) {
  return [...xml.matchAll(new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)</${tagName}>`, "gi"))].map(
    (match) => match[1] ?? "",
  );
}

function stripUtf8ByteOrderMark(value: string) {
  return value.replace(/^\uFEFF/, "");
}

function stripLeadingXmlDeclaration(value: string) {
  return value.replace(/^\s*<\?xml[^>]*\?>\s*/i, "");
}

function applyMd5Hash(value: string) {
  return createHash("md5").update(value, "utf8").digest("hex");
}

function sanitizeCustomerReference(value?: string | null) {
  const normalized = (value ?? "")
    .replaceAll(/[^A-Za-z0-9]/g, "")
    .slice(0, 25);

  return normalized.length ? normalized : null;
}

function resolveCompaniesHouseCompanyHeader(companyNumber: string) {
  const normalized = companyNumber.trim().toUpperCase();
  const prefixedMatch = /^([A-Z]{1,2})(\d+)$/.exec(normalized);

  if (!prefixedMatch) {
    return {
      companyNumber: normalized.replaceAll(/\D/g, ""),
      companyType: undefined as
        | "EW"
        | "SC"
        | "NI"
        | "R"
        | "OC"
        | "SO"
        | "NC"
        | undefined,
    };
  }

  const prefix = prefixedMatch[1]!;
  const digits = prefixedMatch[2]!;

  switch (prefix) {
    case "SC":
    case "NI":
    case "R":
    case "OC":
    case "SO":
    case "NC":
      return {
        companyNumber: digits,
        companyType: prefix,
      };
    default:
      return {
        companyNumber: digits,
        companyType: undefined,
      };
  }
}

export function normalizeCompaniesHouseAccountsDocument(value: string) {
  return `<?xml version="1.0"?>\n${stripLeadingXmlDeclaration(
    stripUtf8ByteOrderMark(value),
  ).trimStart()}`;
}

function parseCompaniesHouseSubmissionStatus(statusXml: string) {
  return {
    submissionNumber: readXmlTagValue(statusXml, "SubmissionNumber"),
    statusCode: readXmlTagValue(statusXml, "StatusCode"),
    companyNumber: readXmlTagValue(statusXml, "CompanyNumber"),
    examinerTelephone: readXmlTagValue(statusXml, "Telephone"),
    examinerComment: readXmlTagValue(statusXml, "Comment"),
    rejections: readXmlBlocks(statusXml, "Reject").map((rejectXml) => ({
      rejectCode: readXmlTagValue(rejectXml, "RejectCode"),
      description: readXmlTagValue(rejectXml, "Description"),
      instanceNumber: readXmlTagValue(rejectXml, "InstanceNumber"),
    })),
  } satisfies CompaniesHouseSubmissionStatus;
}

export function parseCompaniesHouseGatewayMessage(
  xml: string,
): CompaniesHouseGatewayMessage {
  return {
    className: readXmlTagValue(xml, "Class"),
    qualifier: readXmlTagValue(xml, "Qualifier"),
    transactionId: readXmlTagValue(xml, "TransactionID"),
    gatewayTimestamp: readXmlTagValue(xml, "GatewayTimestamp"),
    statuses: readXmlBlocks(xml, "Status").map(parseCompaniesHouseSubmissionStatus),
    rawXml: xml,
  };
}

export function getCompaniesHouseXmlGatewayEnvironment(): CompaniesHouseXmlGatewayEnvironment {
  return process.env.COMPANIES_HOUSE_XML_ENVIRONMENT === "production"
    ? "production"
    : "test";
}

export type CompaniesHouseRegisteredEmailEligibility = {
  raw: Record<string, unknown>;
  eligible?: boolean;
  reasons?: string[];
};

export type CompaniesHousePscDiscrepancyReportStatus =
  | "INCOMPLETE"
  | "COMPLETE";

export type CompaniesHousePscDiscrepancyMaterialType =
  | "appears-to-conceal-details"
  | "money-laundering"
  | "terrorist-financing";

export type CompaniesHousePscDiscrepancyType =
  | "Nature of control"
  | "Correspondence address"
  | "Notified date"
  | "Other reason"
  | "Name"
  | "Date of birth"
  | "Nationality"
  | "Country of residence"
  | "Company name"
  | "Governing law"
  | "Legal form"
  | "Company number"
  | "Place of registration"
  | "Incorporation law"
  | "Principal office address"
  | "Sanctioned";

export type CompaniesHousePscType =
  | "individual-person-with-significant-control"
  | "individual-beneficial-owner"
  | "corporate-entity-person-with-significant-control"
  | "corporate-entity-beneficial-owner"
  | "legal-person-person-with-significant-control"
  | "legal-person-beneficial-owner"
  | "psc-is-missing";

export type CompaniesHousePscDiscrepancyObligedEntityType =
  | "credit-institution"
  | "financial-institution"
  | "auditor-external-accountant-or-tax-advisor"
  | "notary-or-independent-legal-professional"
  | "trust-or-company-service-provider"
  | "estate-agent-or-intermediary"
  | "entity-trading-goods-in-cash-over-ten-thousand-euros"
  | "gambling-service-provider"
  | "exchange-service-provider-of-fiat-and-virtual-currencies"
  | "custodian-wallet-provider"
  | "art-dealer-galleries-and-auction-houses"
  | "art-dealer-free-ports"
  | "insolvency-practictioner";

export type CompaniesHousePscDiscrepancyReport = {
  materialDiscrepancies: CompaniesHousePscDiscrepancyMaterialType[];
  obligedEntityType?: CompaniesHousePscDiscrepancyObligedEntityType;
  obligedEntityOrganisationName?: string;
  obligedEntityContactName?: string;
  obligedEntityEmail?: string;
  companyNumber?: string;
  status?: CompaniesHousePscDiscrepancyReportStatus;
  etag?: string;
  kind?: string;
  links?: {
    self?: string;
  };
};

export type CompaniesHousePscDiscrepancy = {
  details?: string;
  pscName?: string;
  pscDateOfBirth?: string;
  pscType?: CompaniesHousePscType;
  pscDiscrepancyTypes?: CompaniesHousePscDiscrepancyType[];
  etag?: string;
  kind?: string;
  links?: {
    self?: string;
    pscDiscrepancyReport?: string;
  };
};

export function buildCompaniesHouseCompanyScope(
  companyNumber: string,
  scopeKind: CompaniesHouseCompanyScopeKind,
) {
  return `https://api.company-information.service.gov.uk/company/${companyNumber}/${scopeKind}`;
}

export function isCompaniesHouseCompanyScopeKind(
  scopeKind: CompaniesHouseScopeKind,
): scopeKind is CompaniesHouseCompanyScopeKind {
  return (
    scopeKind === "registered-office-address.update" ||
    scopeKind === "registered-email-address.update"
  );
}

export function buildCompaniesHouseScope(params: {
  scopeKind: CompaniesHouseScopeKind;
  companyNumber?: string;
}) {
  if (params.scopeKind === COMPANIES_HOUSE_PSC_DISCREPANCY_SCOPE_KIND) {
    return COMPANIES_HOUSE_PSC_DISCREPANCY_SCOPE;
  }

  if (!params.companyNumber) {
    throw new Error(
      "companyNumber is required for company-specific Companies House scopes",
    );
  }

  return buildCompaniesHouseCompanyScope(params.companyNumber, params.scopeKind);
}

export function extractCompaniesHouseCompanyScopes(scopes: string[]) {
  const regex =
    /^https:\/\/api(?:-sandbox)?\.company-information\.service\.gov\.uk\/company\/([^/]+)\/([^/]+)$/;

  return scopes
    .map((scope) => {
      const match = regex.exec(scope);

      if (!match) {
        return null;
      }

      return {
        companyNumber: match[1]!,
        scopeKind: match[2]!,
      };
    })
    .filter(
      (
        scope,
      ): scope is {
        companyNumber: string;
        scopeKind: string;
      } => scope !== null,
    );
}

function getHttpStatusCodeFromError(error: unknown) {
  if (!(error instanceof Error)) {
    return null;
  }

  const match = /\((\d{3})\):/.exec(error.message);
  return match ? Number(match[1]) : null;
}

function normalizeUserProfile(
  profile: CompaniesHouseUserProfileResponse,
): CompaniesHouseUserProfile {
  return {
    id: profile.id,
    email: profile.email,
    forename: profile.forename,
    surname: profile.surname,
    language: profile.language,
  };
}

function normalizeCompanyProfile(
  profile: CompaniesHouseCompanyProfileResponse,
): CompaniesHouseCompanyProfile {
  const accountingReferenceDate = profile.accounts?.accounting_reference_date
    ? {
        day:
          profile.accounts.accounting_reference_date.day === undefined
            ? undefined
            : Number(profile.accounts.accounting_reference_date.day),
        month:
          profile.accounts.accounting_reference_date.month === undefined
            ? undefined
            : Number(profile.accounts.accounting_reference_date.month),
      }
    : undefined;

  return CompaniesHouseCompanyProfileSchema.parse({
    companyName: profile.company_name,
    companyNumber: profile.company_number,
    companyStatus: profile.company_status,
    canFile: profile.can_file,
    type: profile.type,
    accounts: profile.accounts
      ? {
          accountingReferenceDate,
          lastAccounts: profile.accounts.last_accounts
            ? {
                madeUpTo: profile.accounts.last_accounts.made_up_to,
                periodEndOn: profile.accounts.last_accounts.period_end_on,
                periodStartOn: profile.accounts.last_accounts.period_start_on,
                type: profile.accounts.last_accounts.type,
              }
            : undefined,
          nextAccounts: profile.accounts.next_accounts
            ? {
                dueOn: profile.accounts.next_accounts.due_on,
                overdue: profile.accounts.next_accounts.overdue,
                periodEndOn: profile.accounts.next_accounts.period_end_on,
                periodStartOn: profile.accounts.next_accounts.period_start_on,
              }
            : undefined,
          nextDue: profile.accounts.next_due,
          nextMadeUpTo: profile.accounts.next_made_up_to,
          overdue: profile.accounts.overdue,
        }
      : undefined,
    links: profile.links
      ? {
          filingHistory: profile.links.filing_history,
          self: profile.links.self,
        }
      : undefined,
  });
}

function normalizeFilingHistoryItem(item: {
  transaction_id?: string;
  category?: string;
  subcategory?: string;
  type?: string;
  date?: string;
  description?: string;
  description_values?: Record<string, string>;
  pages?: number;
  paper_filed?: boolean;
  links?: {
    document_metadata?: string;
    self?: string;
  };
}): CompaniesHouseFilingHistoryItem {
  return {
    transactionId: item.transaction_id,
    category: item.category,
    subcategory: item.subcategory,
    type: item.type,
    date: item.date,
    description: item.description,
    descriptionValues: item.description_values,
    pages: item.pages,
    paperFiled: item.paper_filed,
    links: item.links
      ? {
          documentMetadata: item.links.document_metadata,
          self: item.links.self,
        }
      : undefined,
  };
}

function normalizeRegisteredOfficeAddress(
  resource: CompaniesHouseRegisteredOfficeAddressResponse,
): CompaniesHouseRegisteredOfficeAddress {
  return {
    etag: resource.etag,
    kind: resource.kind,
    premises: resource.premises,
    addressLine1: resource.address_line_1,
    addressLine2: resource.address_line_2,
    locality: resource.locality,
    region: resource.region,
    postalCode: resource.postal_code,
    country: resource.country,
    links: resource.links
      ? {
          self: resource.links.self,
          validationStatus: resource.links.validation_status,
        }
      : undefined,
  };
}

function normalizeRegisteredEmailAddress(
  resource: CompaniesHouseRegisteredEmailAddressResponse,
): CompaniesHouseRegisteredEmailAddress {
  return {
    etag: resource.etag,
    kind: resource.kind,
    registeredEmailAddress: resource.registered_email_address,
    acceptAppropriateEmailAddressStatement:
      resource.accept_appropriate_email_address_statement,
    links: resource.links
      ? {
          self: resource.links.self,
          validationStatus: resource.links.validation_status,
        }
      : undefined,
  };
}

function normalizeValidationStatus(
  resource: CompaniesHouseValidationStatusResponse,
): CompaniesHouseValidationStatus {
  return {
    raw: resource,
    isValid:
      typeof resource.is_valid === "boolean"
        ? resource.is_valid
        : typeof resource.isValid === "boolean"
          ? resource.isValid
          : undefined,
    status:
      typeof resource.status === "string"
        ? resource.status
        : typeof resource.validation_status === "string"
          ? resource.validation_status
          : typeof resource.validationStatus === "string"
            ? resource.validationStatus
            : undefined,
    validationStatus:
      typeof resource.validation_status === "string"
        ? resource.validation_status
        : typeof resource.validationStatus === "string"
          ? resource.validationStatus
          : undefined,
    errors: Array.isArray(resource.errors)
      ? resource.errors.filter(
          (value): value is Record<string, unknown> =>
            typeof value === "object" && value !== null,
        )
      : undefined,
  };
}

function normalizeRegisteredEmailEligibility(
  resource: CompaniesHouseRegisteredEmailEligibilityResponse,
): CompaniesHouseRegisteredEmailEligibility {
  const reasons = Array.isArray(resource.reasons)
    ? resource.reasons.filter((value): value is string => typeof value === "string")
    : Array.isArray(resource.errors)
      ? resource.errors
          .map((value) => {
            if (typeof value === "string") {
              return value;
            }

            if (typeof value === "object" && value !== null) {
              const message = (value as Record<string, unknown>).message;
              return typeof message === "string" ? message : null;
            }

            return null;
          })
          .filter((value): value is string => Boolean(value))
      : undefined;

  return {
    raw: resource,
    eligible:
      typeof resource.eligible === "boolean"
        ? resource.eligible
        : typeof resource.is_eligible === "boolean"
          ? resource.is_eligible
          : typeof resource.can_file === "boolean"
            ? resource.can_file
            : undefined,
    reasons,
  };
}

function normalizeDiscrepancyReport(
  resource: CompaniesHouseDiscrepancyReportResponse,
): CompaniesHousePscDiscrepancyReport {
  return {
    materialDiscrepancies: (resource.material_discrepancies ??
      []) as CompaniesHousePscDiscrepancyMaterialType[],
    obligedEntityType:
      resource.obliged_entity_type as CompaniesHousePscDiscrepancyObligedEntityType,
    obligedEntityOrganisationName: resource.obliged_entity_organisation_name,
    obligedEntityContactName: resource.obliged_entity_contact_name,
    obligedEntityEmail: resource.obliged_entity_email,
    companyNumber: resource.company_number,
    status: resource.status as CompaniesHousePscDiscrepancyReportStatus,
    etag: resource.etag,
    kind: resource.kind,
    links: resource.links
      ? {
          self: resource.links.self,
        }
      : undefined,
  };
}

function normalizeDiscrepancy(
  resource: CompaniesHouseDiscrepancyResponse,
): CompaniesHousePscDiscrepancy {
  return {
    details: resource.details,
    pscName: resource.psc_name,
    pscDateOfBirth: resource.psc_date_of_birth,
    pscType: resource.psc_type as CompaniesHousePscType,
    pscDiscrepancyTypes:
      resource.psc_discrepancy_types as CompaniesHousePscDiscrepancyType[],
    etag: resource.etag,
    kind: resource.kind,
    links: resource.links
      ? {
          self: resource.links.self,
          pscDiscrepancyReport: resource.links.psc_discrepancy_report,
        }
      : undefined,
  };
}

function normalizeTransaction(
  transaction: CompaniesHouseTransactionResponse,
): CompaniesHouseTransaction {
  return {
    id: transaction.id,
    companyNumber: transaction.company_number,
    companyName: transaction.company_name,
    description: transaction.description,
    reference: transaction.reference,
    resumeJourneyUri: transaction.resume_journey_uri,
    status: transaction.status,
    createdAt: transaction.created_at,
    updatedAt: transaction.updated_at,
    closedAt: transaction.closed_at,
    filings: transaction.filings
      ? Object.fromEntries(
          Object.entries(transaction.filings).map(([key, filing]) => [
            key,
            {
              companyNumber: filing.company_number,
              description: filing.description,
              descriptionIdentifier: filing.description_identifier,
              status: filing.status,
              type: filing.type,
              createdOn: filing.created_on,
              processedAt: filing.processed_at,
              rejectReasons: filing.reject_reasons,
            },
          ]),
        )
      : undefined,
    resources: transaction.resources
      ? Object.fromEntries(
          Object.entries(transaction.resources).map(([key, resource]) => [
            key,
            {
              kind: resource.kind,
              links: resource.links
                ? {
                    resource: resource.links.resource,
                    validationStatus: resource.links.validation_status,
                    costs: resource.links.costs,
                  }
                : undefined,
              updatedAt: resource.updated_at,
            },
          ]),
        )
      : undefined,
    links: transaction.links
      ? {
          self: transaction.links.self,
          payment: transaction.links.payment,
          validationStatus: transaction.links.validation_status,
        }
      : undefined,
  };
}

export class CompaniesHouseXmlGatewayProvider {
  readonly id = "companies-house-xml" as const;
  readonly name = "Companies House XML Gateway";

  constructor(
    private readonly credentials: CompaniesHouseXmlGatewayCredentials,
    private readonly config?: {
      environment?: CompaniesHouseXmlGatewayEnvironment;
    },
  ) {}

  static fromEnvironment() {
    const presenterId = process.env.COMPANIES_HOUSE_XML_PRESENTER_ID;
    const presenterAuthenticationCode =
      process.env.COMPANIES_HOUSE_XML_PRESENTER_AUTHENTICATION_CODE;
    const environment = getCompaniesHouseXmlGatewayEnvironment();
    const packageReference =
      process.env.COMPANIES_HOUSE_XML_PACKAGE_REFERENCE ??
      (environment === "test" ? "OPSLDG" : null);

    if (!presenterId || !presenterAuthenticationCode || !packageReference) {
      throw new Error("Companies House XML gateway configuration missing");
    }

    return new CompaniesHouseXmlGatewayProvider(
      {
        presenterId,
        presenterAuthenticationCode,
        packageReference,
      },
      {
        environment,
      },
    );
  }

  static isConfiguredInEnvironment() {
    try {
      CompaniesHouseXmlGatewayProvider.fromEnvironment();
      return true;
    } catch {
      return false;
    }
  }

  get environment(): CompaniesHouseXmlGatewayEnvironment {
    return this.config?.environment ?? "test";
  }

  get baseUrl() {
    return "https://xmlgw.companieshouse.gov.uk/v1-0/xmlgw/Gateway";
  }

  get presenterId() {
    return this.credentials.presenterId;
  }

  get packageReference() {
    return this.credentials.packageReference;
  }

  get senderId() {
    return applyMd5Hash(this.credentials.presenterId);
  }

  get authenticationValue() {
    return applyMd5Hash(this.credentials.presenterAuthenticationCode);
  }

  buildAccountsSubmissionXml(args: {
    companyName: string;
    companyNumber: string;
    companyAuthenticationCode?: string | null;
    dateSigned: string;
    accountsIxbrl: string;
    submissionNumber: string;
    transactionId?: string;
    customerReference?: string | null;
    filename?: string;
  }) {
    const companyHeader = resolveCompaniesHouseCompanyHeader(args.companyNumber);

    if (!companyHeader.companyNumber) {
      throw new Error(
        "A numeric Companies House company number is required for XML accounts submission",
      );
    }

    const companyAuthenticationCode =
      args.companyAuthenticationCode?.trim().toUpperCase() || null;
    const customerReference = sanitizeCustomerReference(args.customerReference);
    const encodedAccounts = Buffer.from(
      normalizeCompaniesHouseAccountsDocument(args.accountsIxbrl),
      "utf8",
    ).toString("base64");
    const transactionId =
      args.transactionId ??
      `${Date.now()}${Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0")}`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<GovTalkMessage xsi:schemaLocation="http://www.govtalk.gov.uk/CM/envelope http://xmlgw.companieshouse.gov.uk/v2-1/schema/Egov_ch-v2-0.xsd" xmlns="http://www.govtalk.gov.uk/CM/envelope" xmlns:dsig="http://www.w3.org/2000/09/xmldsig#" xmlns:gt="http://www.govtalk.gov.uk/schemas/govtalk/core" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <EnvelopeVersion>1.0</EnvelopeVersion>
  <Header>
    <MessageDetails>
      <Class>Accounts</Class>
      <Qualifier>request</Qualifier>
      <TransactionID>${escapeXml(transactionId)}</TransactionID>
      ${
        this.environment === "test"
          ? "<GatewayTest>1</GatewayTest>"
          : ""
      }
    </MessageDetails>
    <SenderDetails>
      <IDAuthentication>
        <SenderID>${escapeXml(this.senderId)}</SenderID>
        <Authentication>
          <Method>clear</Method>
          <Value>${escapeXml(this.authenticationValue)}</Value>
        </Authentication>
      </IDAuthentication>
    </SenderDetails>
  </Header>
  <GovTalkDetails>
    <Keys/>
  </GovTalkDetails>
  <Body>
    <FormSubmission xmlns="http://xmlgw.companieshouse.gov.uk/Header" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://xmlgw.companieshouse.gov.uk/Header http://xmlgw.companieshouse.gov.uk/v1-0/schema/forms/FormSubmission-v2-9.xsd">
      <FormHeader>
        <CompanyNumber>${escapeXml(companyHeader.companyNumber)}</CompanyNumber>
        ${
          companyHeader.companyType
            ? `<CompanyType>${companyHeader.companyType}</CompanyType>`
            : ""
        }
        <CompanyName>${escapeXml(args.companyName)}</CompanyName>
        ${
          companyAuthenticationCode
            ? `<CompanyAuthenticationCode>${escapeXml(
                companyAuthenticationCode,
              )}</CompanyAuthenticationCode>`
            : ""
        }
        <PackageReference>${escapeXml(this.packageReference)}</PackageReference>
        <Language>EN</Language>
        <FormIdentifier>Accounts</FormIdentifier>
        <SubmissionNumber>${escapeXml(
          args.submissionNumber.toUpperCase().slice(0, 6),
        )}</SubmissionNumber>
        ${
          customerReference
            ? `<CustomerReference>${escapeXml(customerReference)}</CustomerReference>`
            : ""
        }
      </FormHeader>
      <DateSigned>${escapeXml(args.dateSigned)}</DateSigned>
      <Form/>
      <Document>
        <Data>${encodedAccounts}</Data>
        <Filename>${escapeXml((args.filename ?? "accounts.xhtml").slice(0, 32))}</Filename>
        <ContentType>application/xml</ContentType>
        <Category>ACCOUNTS</Category>
      </Document>
    </FormSubmission>
  </Body>
</GovTalkMessage>`;
  }

  buildSubmissionStatusRequestXml(args: {
    submissionNumber?: string | null;
    companyNumber?: string | null;
    transactionId?: string;
  }) {
    const companyHeader = args.companyNumber
      ? resolveCompaniesHouseCompanyHeader(args.companyNumber)
      : null;

    if (!args.submissionNumber && !companyHeader?.companyNumber) {
      throw new Error(
        "Provide either a submission number or company number when polling Companies House submission status",
      );
    }

    const transactionId =
      args.transactionId ??
      `${Date.now()}${Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0")}`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<GovTalkMessage xsi:schemaLocation="http://www.govtalk.gov.uk/CM/envelope http://xmlgw.companieshouse.gov.uk/v2-1/schema/Egov_ch-v2-0.xsd" xmlns="http://www.govtalk.gov.uk/CM/envelope" xmlns:dsig="http://www.w3.org/2000/09/xmldsig#" xmlns:gt="http://www.govtalk.gov.uk/schemas/govtalk/core" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <EnvelopeVersion>1.0</EnvelopeVersion>
  <Header>
    <MessageDetails>
      <Class>GetSubmissionStatus</Class>
      <Qualifier>request</Qualifier>
      <TransactionID>${escapeXml(transactionId)}</TransactionID>
      ${
        this.environment === "test"
          ? "<GatewayTest>1</GatewayTest>"
          : ""
      }
    </MessageDetails>
    <SenderDetails>
      <IDAuthentication>
        <SenderID>${escapeXml(this.senderId)}</SenderID>
        <Authentication>
          <Method>clear</Method>
          <Value>${escapeXml(this.authenticationValue)}</Value>
        </Authentication>
      </IDAuthentication>
    </SenderDetails>
  </Header>
  <GovTalkDetails>
    <Keys/>
  </GovTalkDetails>
  <Body>
    <GetSubmissionStatus xmlns="http://xmlgw.companieshouse.gov.uk" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://xmlgw.companieshouse.gov.uk http://xmlgw.companieshouse.gov.uk/v2-1/schema/forms/GetSubmissionStatus-v2-5.xsd">
      ${
        args.submissionNumber
          ? `<SubmissionNumber>${escapeXml(
              args.submissionNumber.toUpperCase().slice(0, 6),
            )}</SubmissionNumber>`
          : companyHeader?.companyNumber
            ? `<CompanyNumber>${escapeXml(companyHeader.companyNumber)}</CompanyNumber>`
            : ""
      }
      <PresenterID>${escapeXml(this.presenterId)}</PresenterID>
    </GetSubmissionStatus>
  </Body>
</GovTalkMessage>`;
  }

  async submitAccountsXml(xml: string) {
    return this.postXml(xml);
  }

  async pollSubmissionStatus(args: {
    submissionNumber?: string | null;
    companyNumber?: string | null;
  }) {
    return this.postXml(
      this.buildSubmissionStatusRequestXml({
        submissionNumber: args.submissionNumber,
        companyNumber: args.companyNumber,
      }),
    );
  }

  private async postXml(xml: string) {
    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        Accept: "application/xml, text/xml;q=0.9, */*;q=0.8",
        "Content-Type": "text/xml; charset=utf-8",
      },
      body: xml,
    });
    const text = await response.text();

    if (!response.ok) {
      throw new Error(
        `Companies House XML gateway request failed (${response.status}): ${text}`,
      );
    }

    return parseCompaniesHouseGatewayMessage(text);
  }
}

export class CompaniesHouseProvider {
  readonly id = "companies-house" as const;
  readonly name = "Companies House";

  constructor(
    private readonly credentials?: OAuthCredentials,
    private readonly config?: CompaniesHouseProviderConfig,
    private readonly apiKey = process.env.COMPANIES_HOUSE_API_KEY,
  ) {}

  static fromEnvironment(config?: CompaniesHouseProviderConfig) {
    const clientId = process.env.COMPANIES_HOUSE_CLIENT_ID;
    const clientSecret = process.env.COMPANIES_HOUSE_CLIENT_SECRET;
    const redirectUri = process.env.COMPANIES_HOUSE_OAUTH_REDIRECT_URL;
    const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
    const credentials =
      clientId && clientSecret && redirectUri
        ? { clientId, clientSecret, redirectUri }
        : undefined;

    if (!credentials && !apiKey) {
      throw new Error("Companies House configuration missing");
    }

    return new CompaniesHouseProvider(
      credentials,
      config,
      apiKey,
    );
  }

  get environment(): CompaniesHouseEnvironment {
    return (
      this.config?.environment ??
      (process.env.COMPANIES_HOUSE_ENVIRONMENT === "production"
        ? "production"
        : "sandbox")
    );
  }

  get identityBaseUrl() {
    return this.environment === "production"
      ? "https://identity.company-information.service.gov.uk"
      : "https://identity-sandbox.company-information.service.gov.uk";
  }

  get apiBaseUrl() {
    return this.environment === "production"
      ? "https://api.company-information.service.gov.uk"
      : "https://api-sandbox.company-information.service.gov.uk";
  }

  buildConsentUrl(
    state: string,
    options?: {
      scopes?: string[];
    },
  ) {
    const credentials = this.requireOAuthCredentials();
    const params = new URLSearchParams({
      response_type: "code",
      client_id: credentials.clientId,
      redirect_uri: credentials.redirectUri,
      scope: (options?.scopes?.length
        ? options.scopes
        : [COMPANIES_HOUSE_PROFILE_SCOPE]
      ).join(" "),
      state,
    });

    return `${this.identityBaseUrl}/oauth2/authorise?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string) {
    const credentials = this.requireOAuthCredentials();

    return this.exchangeToken({
      grant_type: "authorization_code",
      code,
      redirect_uri: credentials.redirectUri,
    });
  }

  async refreshTokens(refreshToken: string) {
    return this.exchangeToken({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
  }

  private requireOAuthCredentials() {
    if (!this.credentials) {
      throw new Error("Companies House OAuth configuration missing");
    }

    return this.credentials;
  }

  private requireApiKey() {
    if (!this.apiKey) {
      throw new Error("Companies House API key missing");
    }

    return this.apiKey;
  }

  isTokenExpired(expiresAt: Date, bufferSeconds = 60) {
    return expiresAt.getTime() - Date.now() <= bufferSeconds * 1000;
  }

  async verifyAccessToken(accessToken?: string) {
    const token = accessToken ?? this.config?.accessToken;

    if (!token) {
      throw new Error("Companies House access token missing");
    }

    return this.requestIdentity<CompaniesHouseVerifyResponse>(
      `/oauth/verify?access_token=${encodeURIComponent(token)}`,
      {
        method: "GET",
      },
    );
  }

  async getUserProfile(accessToken?: string) {
    const profile =
      await this.requestIdentity<CompaniesHouseUserProfileResponse>(
        "/user/profile",
        {
          method: "GET",
          accessToken,
        },
      );

    return normalizeUserProfile(profile);
  }

  async getCompanyProfile(companyNumber: string) {
    const profile =
      await this.requestPublicData<CompaniesHouseCompanyProfileResponse>(
        `/company/${companyNumber}`,
      );

    return normalizeCompanyProfile(profile);
  }

  async listFilingHistory(params: {
    companyNumber: string;
    category?: "accounts";
    itemsPerPage?: number;
    startIndex?: number;
  }): Promise<CompaniesHouseFilingHistoryPage> {
    const searchParams = new URLSearchParams({
      items_per_page: String(params.itemsPerPage ?? 5),
      start_index: String(params.startIndex ?? 0),
    });

    if (params.category) {
      searchParams.set("category", params.category);
    }

    const page =
      await this.requestPublicData<CompaniesHouseFilingHistoryListResponse>(
        `/company/${params.companyNumber}/filing-history?${searchParams.toString()}`,
      );

    return CompaniesHouseFilingHistoryPageSchema.parse({
      items: (page.items ?? []).map(normalizeFilingHistoryItem),
      itemsPerPage: page.items_per_page ?? params.itemsPerPage ?? 5,
      startIndex: page.start_index ?? params.startIndex ?? 0,
      totalCount: page.total_count ?? 0,
    });
  }

  async getPublicRegisteredOfficeAddress(companyNumber: string) {
    const resource =
      await this.requestPublicData<CompaniesHouseRegisteredOfficeAddressResponse>(
        `/company/${companyNumber}/registered-office-address`,
      );

    return normalizeRegisteredOfficeAddress(resource);
  }

  async getRegisteredEmailAddressEligibility(companyNumber: string) {
    const eligibility =
      await this.requestApi<CompaniesHouseRegisteredEmailEligibilityResponse>(
        `/registered-email-address/company/${companyNumber}/eligibility`,
        {
          method: "GET",
        },
      );

    return normalizeRegisteredEmailEligibility(eligibility);
  }

  async getRegisteredOfficeAddressResource(params: {
    transactionId: string;
    accessToken?: string;
  }) {
    const resource =
      await this.requestApi<CompaniesHouseRegisteredOfficeAddressResponse>(
        `/transactions/${params.transactionId}/registered-office-address`,
        {
          method: "GET",
          accessToken: params.accessToken,
        },
      );

    return normalizeRegisteredOfficeAddress(resource);
  }

  async getRegisteredOfficeAddressValidationStatus(params: {
    transactionId: string;
    accessToken?: string;
  }) {
    const validation =
      await this.requestApi<CompaniesHouseValidationStatusResponse>(
        `/transactions/${params.transactionId}/registered-office-address/validation-status`,
        {
          method: "GET",
          accessToken: params.accessToken,
        },
      );

    return normalizeValidationStatus(validation);
  }

  async upsertRegisteredOfficeAddressResource(params: {
    transactionId: string;
    accessToken?: string;
    referenceEtag: string;
    acceptAppropriateOfficeAddressStatement: boolean;
    premises: string;
    addressLine1: string;
    addressLine2?: string;
    locality?: string;
    region?: string;
    postalCode: string;
    country: string;
  }) {
    const path = `/transactions/${params.transactionId}/registered-office-address`;
    const body = JSON.stringify({
      accept_appropriate_office_address_statement:
        params.acceptAppropriateOfficeAddressStatement,
      premises: params.premises,
      address_line_1: params.addressLine1,
      address_line_2: params.addressLine2,
      locality: params.locality,
      region: params.region,
      postal_code: params.postalCode,
      country: params.country,
      reference_etag: params.referenceEtag,
    });

    try {
      const resource =
        await this.requestApi<CompaniesHouseRegisteredOfficeAddressResponse>(
          path,
          {
            method: "POST",
            accessToken: params.accessToken,
            body,
          },
        );

      return normalizeRegisteredOfficeAddress(resource);
    } catch (error) {
      if (getHttpStatusCodeFromError(error) !== 409) {
        throw error;
      }

      const resource =
        await this.requestApi<CompaniesHouseRegisteredOfficeAddressResponse>(
          path,
          {
            method: "PUT",
            accessToken: params.accessToken,
            body,
          },
        );

      return normalizeRegisteredOfficeAddress(resource);
    }
  }

  async getRegisteredEmailAddressResource(params: {
    transactionId: string;
    accessToken?: string;
  }) {
    const resource =
      await this.requestApi<CompaniesHouseRegisteredEmailAddressResponse>(
        `/transactions/${params.transactionId}/registered-email-address`,
        {
          method: "GET",
          accessToken: params.accessToken,
        },
      );

    return normalizeRegisteredEmailAddress(resource);
  }

  async getRegisteredEmailAddressValidationStatus(params: {
    transactionId: string;
    accessToken?: string;
  }) {
    const validation =
      await this.requestApi<CompaniesHouseValidationStatusResponse>(
        `/transactions/${params.transactionId}/registered-email-address/validation-status`,
        {
          method: "GET",
          accessToken: params.accessToken,
        },
      );

    return normalizeValidationStatus(validation);
  }

  async upsertRegisteredEmailAddressResource(params: {
    transactionId: string;
    accessToken?: string;
    registeredEmailAddress: string;
    acceptAppropriateEmailAddressStatement: boolean;
  }) {
    const path = `/transactions/${params.transactionId}/registered-email-address`;
    const body = JSON.stringify({
      registered_email_address: params.registeredEmailAddress,
      accept_appropriate_email_address_statement:
        params.acceptAppropriateEmailAddressStatement,
    });

    try {
      const resource =
        await this.requestApi<CompaniesHouseRegisteredEmailAddressResponse>(
          path,
          {
            method: "POST",
            accessToken: params.accessToken,
            body,
          },
        );

      return normalizeRegisteredEmailAddress(resource);
    } catch (error) {
      if (getHttpStatusCodeFromError(error) !== 409) {
        throw error;
      }

      const resource =
        await this.requestApi<CompaniesHouseRegisteredEmailAddressResponse>(
          path,
          {
            method: "PUT",
            accessToken: params.accessToken,
            body,
          },
        );

      return normalizeRegisteredEmailAddress(resource);
    }
  }

  async createPscDiscrepancyReport(params: {
    accessToken?: string;
    materialDiscrepancies: CompaniesHousePscDiscrepancyMaterialType[];
    obligedEntityType?: CompaniesHousePscDiscrepancyObligedEntityType;
    obligedEntityOrganisationName?: string;
    obligedEntityContactName?: string;
    obligedEntityEmail?: string;
    companyNumber?: string;
    status?: Extract<CompaniesHousePscDiscrepancyReportStatus, "INCOMPLETE">;
  }) {
    const report =
      await this.requestApi<CompaniesHouseDiscrepancyReportResponse>(
        "/psc-discrepancy-reports",
        {
          method: "POST",
          accessToken: params.accessToken,
          body: JSON.stringify({
            material_discrepancies: params.materialDiscrepancies,
            obliged_entity_type: params.obligedEntityType,
            obliged_entity_organisation_name:
              params.obligedEntityOrganisationName,
            obliged_entity_contact_name: params.obligedEntityContactName,
            obliged_entity_email: params.obligedEntityEmail,
            company_number: params.companyNumber,
            status: params.status ?? "INCOMPLETE",
          }),
        },
      );

    return normalizeDiscrepancyReport(report);
  }

  async createPscDiscrepancy(params: {
    reportId: string;
    accessToken?: string;
    details: string;
    pscDateOfBirth?: string;
    pscDiscrepancyTypes: CompaniesHousePscDiscrepancyType[];
    pscName?: string;
    pscType: CompaniesHousePscType;
  }) {
    const discrepancy =
      await this.requestApi<CompaniesHouseDiscrepancyResponse>(
        `/psc-discrepancy-reports/${params.reportId}/discrepancies`,
        {
          method: "POST",
          accessToken: params.accessToken,
          body: JSON.stringify({
            details: params.details,
            psc_date_of_birth: params.pscDateOfBirth,
            psc_discrepancy_types: params.pscDiscrepancyTypes,
            psc_name: params.pscName,
            psc_type: params.pscType,
          }),
        },
      );

    return normalizeDiscrepancy(discrepancy);
  }

  async updatePscDiscrepancyReport(params: {
    reportId: string;
    accessToken?: string;
    materialDiscrepancies: CompaniesHousePscDiscrepancyMaterialType[];
    obligedEntityType: CompaniesHousePscDiscrepancyObligedEntityType;
    obligedEntityOrganisationName: string;
    obligedEntityContactName: string;
    obligedEntityEmail: string;
    companyNumber: string;
    status: CompaniesHousePscDiscrepancyReportStatus;
  }) {
    const report =
      await this.requestApi<CompaniesHouseDiscrepancyReportResponse>(
        `/psc-discrepancy-reports/${params.reportId}`,
        {
          method: "PUT",
          accessToken: params.accessToken,
          body: JSON.stringify({
            material_discrepancies: params.materialDiscrepancies,
            obliged_entity_type: params.obligedEntityType,
            obliged_entity_organisation_name:
              params.obligedEntityOrganisationName,
            obliged_entity_contact_name: params.obligedEntityContactName,
            obliged_entity_email: params.obligedEntityEmail,
            company_number: params.companyNumber,
            status: params.status,
          }),
        },
      );

    return normalizeDiscrepancyReport(report);
  }

  async createTransaction(params: {
    companyNumber?: string;
    description: string;
    reference?: string;
    resumeJourneyUri?: string;
    accessToken?: string;
  }) {
    const transaction =
      await this.requestApi<CompaniesHouseTransactionResponse>("/transactions", {
        method: "POST",
        accessToken: params.accessToken,
        body: JSON.stringify({
          company_number: params.companyNumber,
          description: params.description,
          reference: params.reference,
          resume_journey_uri: params.resumeJourneyUri,
        }),
      });

    return normalizeTransaction(transaction);
  }

  async getTransaction(params: {
    transactionId: string;
    accessToken?: string;
  }) {
    const transaction =
      await this.requestApi<CompaniesHouseTransactionResponse>(
        `/transactions/${params.transactionId}`,
        {
          method: "GET",
          accessToken: params.accessToken,
        },
      );

    return normalizeTransaction(transaction);
  }

  async updateTransaction(params: {
    transactionId: string;
    reference?: string;
    resumeJourneyUri?: string;
    status?: "open" | "closed";
    accessToken?: string;
  }) {
    const transaction =
      await this.requestApi<CompaniesHouseTransactionResponse>(
        `/transactions/${params.transactionId}`,
        {
          method: "PUT",
          accessToken: params.accessToken,
          body: JSON.stringify({
            reference: params.reference,
            resume_journey_uri: params.resumeJourneyUri,
            status: params.status,
          }),
        },
      );

    return normalizeTransaction(transaction);
  }

  async closeTransaction(params: {
    transactionId: string;
    accessToken?: string;
  }) {
    return this.updateTransaction({
      transactionId: params.transactionId,
      status: "closed",
      accessToken: params.accessToken,
    });
  }

  async deleteTransaction(params: {
    transactionId: string;
    accessToken?: string;
  }) {
    await this.requestApi<void>(`/transactions/${params.transactionId}`, {
      method: "DELETE",
      accessToken: params.accessToken,
    });

    return { success: true as const };
  }

  private async exchangeToken(
    payload: Record<string, string>,
  ): Promise<CompaniesHouseProviderConfig> {
    const credentials = this.requireOAuthCredentials();
    const body = new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      ...payload,
    });

    const response = await fetch(`${this.identityBaseUrl}/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Companies House token exchange failed: ${text}`);
    }

    const tokenData = (await response.json()) as CompaniesHouseTokenResponse;
    const scope =
      tokenData.scope?.split(" ").filter(Boolean) ?? [COMPANIES_HOUSE_PROFILE_SCOPE];

    return CompaniesHouseProviderConfigSchema.parse({
      provider: "companies-house",
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: new Date(
        Date.now() + tokenData.expires_in * 1000,
      ).toISOString(),
      scope,
      tokenType: tokenData.token_type,
      environment: this.environment,
    });
  }

  private async requestIdentity<T>(
    path: string,
    params: {
      method: "GET" | "POST";
      accessToken?: string;
      body?: string;
    },
  ): Promise<T> {
    const accessToken = params.accessToken ?? this.config?.accessToken;

    const response = await fetch(`${this.identityBaseUrl}${path}`, {
      method: params.method,
      headers: {
        Accept: "application/json",
        ...(accessToken
          ? {
              Authorization: `Bearer ${accessToken}`,
            }
          : {}),
        ...(params.body ? { "Content-Type": "application/json" } : {}),
      },
      body: params.body,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Companies House identity request failed (${response.status}): ${text}`,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  private async requestPublicData<T>(path: string): Promise<T> {
    const apiKey = this.requireApiKey();
    const credentials = Buffer.from(`${apiKey}:`, "utf8").toString("base64");
    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${credentials}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Companies House public data request failed (${response.status}): ${text}`,
      );
    }

    return (await response.json()) as T;
  }

  private async requestApi<T>(
    path: string,
    params: {
      method: "GET" | "POST" | "PUT" | "DELETE";
      accessToken?: string;
      body?: string;
    },
  ): Promise<T> {
    const accessToken = params.accessToken ?? this.config?.accessToken;

    if (!accessToken) {
      throw new Error("Companies House access token missing");
    }

    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      method: params.method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...(params.body ? { "Content-Type": "application/json" } : {}),
      },
      body: params.body,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Companies House API request failed (${response.status}): ${text}`,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }
}
