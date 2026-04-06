import { z } from "zod";

const companiesHouseMaterialDiscrepancySchema = z.enum([
  "appears-to-conceal-details",
  "money-laundering",
  "terrorist-financing",
]);

const companiesHouseObligedEntityTypeSchema = z.enum([
  "credit-institution",
  "financial-institution",
  "auditor-external-accountant-or-tax-advisor",
  "notary-or-independent-legal-professional",
  "trust-or-company-service-provider",
  "estate-agent-or-intermediary",
  "entity-trading-goods-in-cash-over-ten-thousand-euros",
  "gambling-service-provider",
  "exchange-service-provider-of-fiat-and-virtual-currencies",
  "custodian-wallet-provider",
  "art-dealer-galleries-and-auction-houses",
  "art-dealer-free-ports",
  "insolvency-practictioner",
]);

const companiesHousePscTypeSchema = z.enum([
  "individual-person-with-significant-control",
  "individual-beneficial-owner",
  "corporate-entity-person-with-significant-control",
  "corporate-entity-beneficial-owner",
  "legal-person-person-with-significant-control",
  "legal-person-beneficial-owner",
  "psc-is-missing",
]);

const companiesHousePscDiscrepancyTypeSchema = z.enum([
  "Nature of control",
  "Correspondence address",
  "Notified date",
  "Other reason",
  "Name",
  "Date of birth",
  "Nationality",
  "Country of residence",
  "Company name",
  "Governing law",
  "Legal form",
  "Company number",
  "Place of registration",
  "Incorporation law",
  "Principal office address",
  "Sanctioned",
]);

export const createCompaniesHouseTransactionSchema = z.object({
  companyNumber: z.string().trim().min(1).max(20).optional(),
  description: z.string().trim().min(1).max(160),
  reference: z.string().trim().min(1).max(64).optional(),
  resumeJourneyUri: z.string().url().optional(),
});

export const getCompaniesHouseTransactionSchema = z.object({
  transactionId: z.string().trim().min(1),
});

export const closeCompaniesHouseTransactionSchema = getCompaniesHouseTransactionSchema;

export const deleteCompaniesHouseTransactionSchema = getCompaniesHouseTransactionSchema;

const companiesHouseAddressDraftBaseSchema = z.object({
  companyNumber: z.string().trim().min(1).max(20).optional(),
  reference: z.string().trim().min(1).max(64).optional(),
  resumeJourneyUri: z.string().url().optional(),
});

export const createCompaniesHouseRegisteredOfficeAddressDraftSchema =
  companiesHouseAddressDraftBaseSchema.extend({
    acceptAppropriateOfficeAddressStatement: z.boolean(),
    premises: z.string().trim().min(1).max(50),
    addressLine1: z.string().trim().min(1).max(50),
    addressLine2: z.string().trim().max(50).optional(),
    locality: z.string().trim().max(50).optional(),
    region: z.string().trim().max(50).optional(),
    postalCode: z.string().trim().min(1).max(15),
    country: z.string().trim().min(1).max(50),
  });

export const refreshCompaniesHouseRegisteredOfficeAddressDraftSchema =
  getCompaniesHouseTransactionSchema;

export const createCompaniesHouseRegisteredEmailAddressDraftSchema =
  companiesHouseAddressDraftBaseSchema.extend({
    registeredEmailAddress: z.string().trim().email().max(200),
    acceptAppropriateEmailAddressStatement: z.boolean(),
  });

export const refreshCompaniesHouseRegisteredEmailAddressDraftSchema =
  getCompaniesHouseTransactionSchema;

const companiesHousePscDiscrepancySchema = z
  .object({
    details: z.string().trim().min(1).max(5000),
    pscDateOfBirth: z
      .string()
      .trim()
      .regex(/^\d{2}\/\d{4}$/)
      .optional(),
    pscDiscrepancyTypes: z.array(companiesHousePscDiscrepancyTypeSchema).min(1),
    pscName: z.string().trim().max(200).optional(),
    pscType: companiesHousePscTypeSchema,
  })
  .superRefine((value, ctx) => {
    if (value.pscType === "individual-person-with-significant-control" && !value.pscDateOfBirth) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Date of birth is required for an individual PSC.",
        path: ["pscDateOfBirth"],
      });
    }

    if (value.pscType !== "psc-is-missing" && !value.pscName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "PSC name is required unless the PSC is missing.",
        path: ["pscName"],
      });
    }
  });

export const submitCompaniesHousePscDiscrepancyReportSchema = z.object({
  companyNumber: z.string().trim().min(1).max(20).optional(),
  materialDiscrepancies: z.array(companiesHouseMaterialDiscrepancySchema).min(1),
  obligedEntityType: companiesHouseObligedEntityTypeSchema,
  obligedEntityOrganisationName: z.string().trim().min(1).max(160),
  obligedEntityContactName: z.string().trim().min(1).max(160),
  obligedEntityEmail: z.string().trim().email().max(200),
  discrepancies: z.array(companiesHousePscDiscrepancySchema).min(1),
  complete: z.boolean().optional(),
});
