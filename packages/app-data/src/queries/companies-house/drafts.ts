import type { Database } from "../../client";
import { requireCompaniesHouseProviderData, requireScopedCompanyNumber } from "./shared";

async function withDraftTransactionCleanup<T>(args: {
  provider: Awaited<ReturnType<typeof requireCompaniesHouseProviderData>>["provider"];
  accessToken: string;
  transactionId: string;
  action: () => Promise<T>;
}) {
  try {
    return await args.action();
  } catch (error) {
    try {
      await args.provider.deleteTransaction({
        transactionId: args.transactionId,
        accessToken: args.accessToken,
      });
    } catch {
      // Ignore cleanup failure and surface the original error.
    }

    throw error;
  }
}

export async function createCompaniesHouseRegisteredOfficeAddressDraft(
  db: Database,
  params: {
    teamId: string;
    companyNumber?: string;
    reference?: string;
    resumeJourneyUri?: string;
    acceptAppropriateOfficeAddressStatement: boolean;
    premises: string;
    addressLine1: string;
    addressLine2?: string;
    locality?: string;
    region?: string;
    postalCode: string;
    country: string;
  },
) {
  const { providerData, companyNumber } = await requireScopedCompanyNumber({
    db,
    teamId: params.teamId,
    explicitCompanyNumber: params.companyNumber,
    scopeKind: "registered-office-address.update",
    label: "registered office address",
  });

  const publicRegisteredOfficeAddress =
    await providerData.provider.getPublicRegisteredOfficeAddress(companyNumber);

  if (!publicRegisteredOfficeAddress.etag) {
    throw new Error(
      "Companies House did not return a reference etag for the current registered office address",
    );
  }
  const referenceEtag = publicRegisteredOfficeAddress.etag;

  const transaction = await providerData.provider.createTransaction({
    companyNumber,
    description: "Change of registered office address",
    reference: params.reference,
    resumeJourneyUri: params.resumeJourneyUri,
    accessToken: providerData.config.accessToken,
  });

  return withDraftTransactionCleanup({
    provider: providerData.provider,
    accessToken: providerData.config.accessToken,
    transactionId: transaction.id,
    action: async () => {
      const filing = await providerData.provider.upsertRegisteredOfficeAddressResource({
        transactionId: transaction.id,
        accessToken: providerData.config.accessToken,
        referenceEtag,
        acceptAppropriateOfficeAddressStatement: params.acceptAppropriateOfficeAddressStatement,
        premises: params.premises,
        addressLine1: params.addressLine1,
        addressLine2: params.addressLine2,
        locality: params.locality,
        region: params.region,
        postalCode: params.postalCode,
        country: params.country,
      });
      const validationStatus =
        await providerData.provider.getRegisteredOfficeAddressValidationStatus({
          transactionId: transaction.id,
          accessToken: providerData.config.accessToken,
        });

      return {
        transaction,
        filing,
        validationStatus,
        currentRegisteredOfficeAddress: publicRegisteredOfficeAddress,
      };
    },
  });
}

export async function refreshCompaniesHouseRegisteredOfficeAddressDraft(
  db: Database,
  params: {
    teamId: string;
    transactionId: string;
  },
) {
  const providerData = await requireCompaniesHouseProviderData(db, params.teamId);

  const [transaction, filing, validationStatus] = await Promise.all([
    providerData.provider.getTransaction({
      transactionId: params.transactionId,
      accessToken: providerData.config.accessToken,
    }),
    providerData.provider.getRegisteredOfficeAddressResource({
      transactionId: params.transactionId,
      accessToken: providerData.config.accessToken,
    }),
    providerData.provider.getRegisteredOfficeAddressValidationStatus({
      transactionId: params.transactionId,
      accessToken: providerData.config.accessToken,
    }),
  ]);

  return {
    transaction,
    filing,
    validationStatus,
  };
}

export async function createCompaniesHouseRegisteredEmailAddressDraft(
  db: Database,
  params: {
    teamId: string;
    companyNumber?: string;
    reference?: string;
    resumeJourneyUri?: string;
    registeredEmailAddress: string;
    acceptAppropriateEmailAddressStatement: boolean;
  },
) {
  const { providerData, companyNumber } = await requireScopedCompanyNumber({
    db,
    teamId: params.teamId,
    explicitCompanyNumber: params.companyNumber,
    scopeKind: "registered-email-address.update",
    label: "registered email address",
  });

  const eligibility =
    await providerData.provider.getRegisteredEmailAddressEligibility(companyNumber);

  if (eligibility.eligible === false) {
    throw new Error(
      eligibility.reasons?.[0] ??
        "Companies House reports that this company is not eligible for registered email filing",
    );
  }

  const transaction = await providerData.provider.createTransaction({
    companyNumber,
    description: "Change of registered email address",
    reference: params.reference,
    resumeJourneyUri: params.resumeJourneyUri,
    accessToken: providerData.config.accessToken,
  });

  return withDraftTransactionCleanup({
    provider: providerData.provider,
    accessToken: providerData.config.accessToken,
    transactionId: transaction.id,
    action: async () => {
      const filing = await providerData.provider.upsertRegisteredEmailAddressResource({
        transactionId: transaction.id,
        accessToken: providerData.config.accessToken,
        registeredEmailAddress: params.registeredEmailAddress,
        acceptAppropriateEmailAddressStatement: params.acceptAppropriateEmailAddressStatement,
      });
      const validationStatus =
        await providerData.provider.getRegisteredEmailAddressValidationStatus({
          transactionId: transaction.id,
          accessToken: providerData.config.accessToken,
        });

      return {
        transaction,
        filing,
        validationStatus,
        eligibility,
      };
    },
  });
}

export async function refreshCompaniesHouseRegisteredEmailAddressDraft(
  db: Database,
  params: {
    teamId: string;
    transactionId: string;
  },
) {
  const providerData = await requireCompaniesHouseProviderData(db, params.teamId);

  const [transaction, filing, validationStatus] = await Promise.all([
    providerData.provider.getTransaction({
      transactionId: params.transactionId,
      accessToken: providerData.config.accessToken,
    }),
    providerData.provider.getRegisteredEmailAddressResource({
      transactionId: params.transactionId,
      accessToken: providerData.config.accessToken,
    }),
    providerData.provider.getRegisteredEmailAddressValidationStatus({
      transactionId: params.transactionId,
      accessToken: providerData.config.accessToken,
    }),
  ]);

  return {
    transaction,
    filing,
    validationStatus,
  };
}
