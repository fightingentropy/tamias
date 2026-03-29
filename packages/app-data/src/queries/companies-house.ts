import {
  buildCompaniesHouseCompanyScope,
  CompaniesHouseProvider,
  CompaniesHouseXmlGatewayProvider,
  COMPANIES_HOUSE_PSC_DISCREPANCY_SCOPE,
  type CompaniesHousePscDiscrepancyMaterialType,
  type CompaniesHousePscDiscrepancyObligedEntityType,
  type CompaniesHousePscDiscrepancyType,
  type CompaniesHousePscType,
  type CompaniesHouseEnvironment,
  type CompaniesHouseTransaction,
  CompaniesHouseProviderConfigSchema,
  extractCompaniesHouseCompanyScopes,
  getCompaniesHouseXmlGatewayEnvironment,
} from "@tamias/compliance";
import type { Database } from "../client";
import { createSubmissionEventInConvex } from "@tamias/app-data-convex";
import { getAppByAppId, setAppConfig } from "./apps";
import { getFilingProfile } from "./compliance/shared";
import { getYearEndPack } from "./year-end";

async function getCompaniesHouseProviderData(db: Database, teamId: string) {
  const app = await getAppByAppId(db, {
    teamId,
    appId: "companies-house",
  });

  if (!app?.config) {
    return null;
  }

  let config = CompaniesHouseProviderConfigSchema.parse(app.config);
  let provider = CompaniesHouseProvider.fromEnvironment(config);

  if (provider.isTokenExpired(new Date(config.expiresAt))) {
    const refreshed = await provider.refreshTokens(config.refreshToken);
    config = {
      ...refreshed,
      userId: config.userId,
      userProfile: config.userProfile,
    };

    await setAppConfig(db, {
      teamId,
      appId: "companies-house",
      config,
    });

    provider = CompaniesHouseProvider.fromEnvironment(config);
  }

  if (!config.userProfile) {
    const userProfile = await provider.getUserProfile(config.accessToken);
    config = {
      ...config,
      userId: config.userId ?? userProfile.id,
      userProfile,
    };

    await setAppConfig(db, {
      teamId,
      appId: "companies-house",
      config,
    });

    provider = CompaniesHouseProvider.fromEnvironment(config);
  }

  return { provider, config };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isCompaniesHouseApiKeyMissing(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("Companies House API key missing")
  );
}

function isMissingCompaniesHouseFilingHistoryResource(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("No static resource") &&
    error.message.includes("/filing-history")
  );
}

function getCompaniesHouseEnvironment(): CompaniesHouseEnvironment {
  return process.env.COMPANIES_HOUSE_ENVIRONMENT === "production"
    ? "production"
    : "sandbox";
}

function getRequiredCompanyNumber(params: {
  explicitCompanyNumber?: string;
  profileCompanyNumber?: string | null;
}) {
  const companyNumber =
    params.explicitCompanyNumber ?? params.profileCompanyNumber ?? null;

  if (!companyNumber) {
    throw new Error("Company number is required for this Companies House filing");
  }

  return companyNumber;
}

function requireCompaniesHouseScope(
  scopes: string[] | undefined,
  requiredScope: string,
  label: string,
) {
  if (!(scopes ?? []).includes(requiredScope)) {
    throw new Error(`Grant the ${label} scope in Companies House first`);
  }
}

async function createAccountsSubmissionEvent(args: {
  db: Database;
  teamId: string;
  eventType: string;
  status: string;
  correlationId?: string | null;
  requestPayload?: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
  errorMessage?: string | null;
}) {
  const profile = await getFilingProfile(args.db, args.teamId);

  if (!profile) {
    return null;
  }

  return createSubmissionEventInConvex({
    teamId: args.teamId,
    filingProfileId: profile.id,
    provider: "companies-house",
    obligationType: "accounts",
    status: args.status,
    eventType: args.eventType,
    correlationId: args.correlationId,
    requestPayload: args.requestPayload,
    responsePayload: args.responsePayload,
    errorMessage: args.errorMessage,
  });
}

export async function getCompaniesHouseConnection(
  db: Database,
  params: { teamId: string },
) {
  const [profile, providerData] = await Promise.all([
    getFilingProfile(db, params.teamId),
    getCompaniesHouseProviderData(db, params.teamId),
  ]);

  if (!providerData) {
    return {
      connected: false,
      profileCompanyNumber: profile?.companyNumber ?? null,
      environment: null,
      scopes: [] as string[],
      companyScopes: [] as Array<{ companyNumber: string; scopeKind: string }>,
      userProfile: null,
    };
  }

  return {
    connected: true,
    profileCompanyNumber: profile?.companyNumber ?? null,
    environment: providerData.config.environment,
    scopes: providerData.config.scope ?? [],
    companyScopes: extractCompaniesHouseCompanyScopes(
      providerData.config.scope ?? [],
    ),
    userProfile: providerData.config.userProfile ?? null,
  };
}

export async function getCompaniesHouseAccountsStatus(
  db: Database,
  params: { teamId: string },
) {
  const [profile, providerData] = await Promise.all([
    getFilingProfile(db, params.teamId),
    getCompaniesHouseProviderData(db, params.teamId),
  ]);

  let currentPeriodEnd: string | null = null;

  if (profile) {
    try {
      const workspace = await getYearEndPack(db, {
        teamId: params.teamId,
      });
      currentPeriodEnd = workspace.period.periodEnd;
    } catch {
      currentPeriodEnd = null;
    }
  }

  const status = {
    connected: Boolean(providerData),
    environment: providerData?.config.environment ?? getCompaniesHouseEnvironment(),
    xmlGatewayEnvironment: getCompaniesHouseXmlGatewayEnvironment(),
    xmlGatewayConfigured:
      CompaniesHouseXmlGatewayProvider.isConfiguredInEnvironment(),
    packageReferenceConfigured: Boolean(
      process.env.COMPANIES_HOUSE_XML_PACKAGE_REFERENCE ??
        getCompaniesHouseXmlGatewayEnvironment() === "test",
    ),
    profileCompanyName: profile?.companyName ?? null,
    profileCompanyNumber: profile?.companyNumber ?? null,
    companyAuthenticationCodeConfigured: Boolean(
      profile?.companyAuthenticationCode,
    ),
    scopes: providerData?.config.scope ?? ([] as string[]),
    companyScopes: providerData
      ? extractCompaniesHouseCompanyScopes(providerData.config.scope ?? [])
      : ([] as Array<{ companyNumber: string; scopeKind: string }>),
    userProfile: providerData?.config.userProfile ?? null,
    apiKeyConfigured: Boolean(process.env.COMPANIES_HOUSE_API_KEY),
    companyProfile: null as Awaited<
      ReturnType<CompaniesHouseProvider["getCompanyProfile"]>
    > | null,
    recentAccountsFilings: [] as Awaited<
      ReturnType<CompaniesHouseProvider["listFilingHistory"]>
    >["items"],
    latestAccountsMadeUpTo: null as string | null,
    nextAccountsDueOn: null as string | null,
    accountsOverdue: null as boolean | null,
    canFile: null as boolean | null,
    currentPeriodEnd,
    currentPeriodFiled: null as boolean | null,
    publicDataError: null as string | null,
  };

  if (!profile?.companyNumber) {
    return status;
  }

  try {
    const provider = CompaniesHouseProvider.fromEnvironment(providerData?.config);
    const [companyProfileResult, filingHistoryResult] = await Promise.allSettled([
      provider.getCompanyProfile(profile.companyNumber),
      provider.listFilingHistory({
        companyNumber: profile.companyNumber,
        category: "accounts",
        itemsPerPage: 5,
      }),
    ]);

    if (companyProfileResult.status === "rejected") {
      throw companyProfileResult.reason;
    }

    const companyProfile = companyProfileResult.value;
    const filingHistory =
      filingHistoryResult.status === "fulfilled"
        ? filingHistoryResult.value
        : null;
    const publicDataError =
      filingHistoryResult.status === "rejected" &&
      !isMissingCompaniesHouseFilingHistoryResource(filingHistoryResult.reason)
        ? getErrorMessage(filingHistoryResult.reason)
        : null;

    const latestAccountsMadeUpTo =
      companyProfile.accounts?.lastAccounts?.madeUpTo ?? null;
    const nextAccountsDueOn =
      companyProfile.accounts?.nextAccounts?.dueOn ??
      companyProfile.accounts?.nextDue ??
      null;
    const accountsOverdue =
      companyProfile.accounts?.nextAccounts?.overdue ??
      companyProfile.accounts?.overdue ??
      null;
    const currentPeriodFiled =
      currentPeriodEnd && latestAccountsMadeUpTo
        ? latestAccountsMadeUpTo >= currentPeriodEnd
        : null;

    return {
      ...status,
      companyProfile,
      recentAccountsFilings: filingHistory?.items ?? [],
      latestAccountsMadeUpTo,
      nextAccountsDueOn,
      accountsOverdue,
      canFile: companyProfile.canFile ?? null,
      currentPeriodFiled,
      publicDataError,
    };
  } catch (error) {
    if (isCompaniesHouseApiKeyMissing(error)) {
      return {
        ...status,
        apiKeyConfigured: false,
      };
    }

    return {
      ...status,
      publicDataError: getErrorMessage(error),
    };
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
  const providerData = await getCompaniesHouseProviderData(db, params.teamId);

  if (!providerData) {
    throw new Error("Companies House is not connected");
  }

  const profile = await getFilingProfile(db, params.teamId);
  const companyNumber = getRequiredCompanyNumber({
    explicitCompanyNumber: params.companyNumber,
    profileCompanyNumber: profile?.companyNumber,
  });

  requireCompaniesHouseScope(
    providerData.config.scope,
    buildCompaniesHouseCompanyScope(
      companyNumber,
      "registered-office-address.update",
    ),
    "registered office address",
  );

  const publicRegisteredOfficeAddress =
    await providerData.provider.getPublicRegisteredOfficeAddress(companyNumber);

  if (!publicRegisteredOfficeAddress.etag) {
    throw new Error(
      "Companies House did not return a reference etag for the current registered office address",
    );
  }

  const transaction = await providerData.provider.createTransaction({
    companyNumber,
    description: "Change of registered office address",
    reference: params.reference,
    resumeJourneyUri: params.resumeJourneyUri,
    accessToken: providerData.config.accessToken,
  });

  try {
    const filing = await providerData.provider.upsertRegisteredOfficeAddressResource(
      {
        transactionId: transaction.id,
        accessToken: providerData.config.accessToken,
        referenceEtag: publicRegisteredOfficeAddress.etag,
        acceptAppropriateOfficeAddressStatement:
          params.acceptAppropriateOfficeAddressStatement,
        premises: params.premises,
        addressLine1: params.addressLine1,
        addressLine2: params.addressLine2,
        locality: params.locality,
        region: params.region,
        postalCode: params.postalCode,
        country: params.country,
      },
    );
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
  } catch (error) {
    try {
      await providerData.provider.deleteTransaction({
        transactionId: transaction.id,
        accessToken: providerData.config.accessToken,
      });
    } catch {
      // Ignore cleanup failure and surface the original error.
    }

    throw error;
  }
}

export async function refreshCompaniesHouseRegisteredOfficeAddressDraft(
  db: Database,
  params: {
    teamId: string;
    transactionId: string;
  },
) {
  const providerData = await getCompaniesHouseProviderData(db, params.teamId);

  if (!providerData) {
    throw new Error("Companies House is not connected");
  }

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
  const providerData = await getCompaniesHouseProviderData(db, params.teamId);

  if (!providerData) {
    throw new Error("Companies House is not connected");
  }

  const profile = await getFilingProfile(db, params.teamId);
  const companyNumber = getRequiredCompanyNumber({
    explicitCompanyNumber: params.companyNumber,
    profileCompanyNumber: profile?.companyNumber,
  });

  requireCompaniesHouseScope(
    providerData.config.scope,
    buildCompaniesHouseCompanyScope(
      companyNumber,
      "registered-email-address.update",
    ),
    "registered email address",
  );

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

  try {
    const filing =
      await providerData.provider.upsertRegisteredEmailAddressResource({
        transactionId: transaction.id,
        accessToken: providerData.config.accessToken,
        registeredEmailAddress: params.registeredEmailAddress,
        acceptAppropriateEmailAddressStatement:
          params.acceptAppropriateEmailAddressStatement,
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
  } catch (error) {
    try {
      await providerData.provider.deleteTransaction({
        transactionId: transaction.id,
        accessToken: providerData.config.accessToken,
      });
    } catch {
      // Ignore cleanup failure and surface the original error.
    }

    throw error;
  }
}

export async function refreshCompaniesHouseRegisteredEmailAddressDraft(
  db: Database,
  params: {
    teamId: string;
    transactionId: string;
  },
) {
  const providerData = await getCompaniesHouseProviderData(db, params.teamId);

  if (!providerData) {
    throw new Error("Companies House is not connected");
  }

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

export async function submitCompaniesHousePscDiscrepancyReport(
  db: Database,
  params: {
    teamId: string;
    companyNumber?: string;
    materialDiscrepancies: CompaniesHousePscDiscrepancyMaterialType[];
    obligedEntityType: CompaniesHousePscDiscrepancyObligedEntityType;
    obligedEntityOrganisationName: string;
    obligedEntityContactName: string;
    obligedEntityEmail: string;
    discrepancies: Array<{
      details: string;
      pscDateOfBirth?: string;
      pscDiscrepancyTypes: CompaniesHousePscDiscrepancyType[];
      pscName?: string;
      pscType: CompaniesHousePscType;
    }>;
    complete?: boolean;
  },
) {
  const providerData = await getCompaniesHouseProviderData(db, params.teamId);

  if (!providerData) {
    throw new Error("Companies House is not connected");
  }

  const profile = await getFilingProfile(db, params.teamId);
  const companyNumber = getRequiredCompanyNumber({
    explicitCompanyNumber: params.companyNumber,
    profileCompanyNumber: profile?.companyNumber,
  });

  requireCompaniesHouseScope(
    providerData.config.scope,
    COMPANIES_HOUSE_PSC_DISCREPANCY_SCOPE,
    "PSC discrepancy report",
  );

  const report = await providerData.provider.createPscDiscrepancyReport({
    accessToken: providerData.config.accessToken,
    companyNumber,
    materialDiscrepancies: params.materialDiscrepancies,
    obligedEntityType: params.obligedEntityType,
    obligedEntityOrganisationName: params.obligedEntityOrganisationName,
    obligedEntityContactName: params.obligedEntityContactName,
    obligedEntityEmail: params.obligedEntityEmail,
    status: "INCOMPLETE",
  });

  const reportId = report.links?.self?.split("/").pop();

  if (!reportId) {
    throw new Error(
      "Companies House did not return a discrepancy report id for the new report",
    );
  }

  const discrepancies = [];

  for (const discrepancy of params.discrepancies) {
    discrepancies.push(
      await providerData.provider.createPscDiscrepancy({
        reportId,
        accessToken: providerData.config.accessToken,
        details: discrepancy.details,
        pscDateOfBirth: discrepancy.pscDateOfBirth,
        pscDiscrepancyTypes: discrepancy.pscDiscrepancyTypes,
        pscName: discrepancy.pscName,
        pscType: discrepancy.pscType,
      }),
    );
  }

  const finalReport =
    params.complete === false
      ? report
      : await providerData.provider.updatePscDiscrepancyReport({
          reportId,
          accessToken: providerData.config.accessToken,
          companyNumber,
          materialDiscrepancies: params.materialDiscrepancies,
          obligedEntityType: params.obligedEntityType,
          obligedEntityOrganisationName: params.obligedEntityOrganisationName,
          obligedEntityContactName: params.obligedEntityContactName,
          obligedEntityEmail: params.obligedEntityEmail,
          status: "COMPLETE",
        });

  return {
    report,
    discrepancies,
    finalReport,
  };
}

export async function createCompaniesHouseTransaction(
  db: Database,
  params: {
    teamId: string;
    companyNumber?: string;
    description: string;
    reference?: string;
    resumeJourneyUri?: string;
  },
) {
  const providerData = await getCompaniesHouseProviderData(db, params.teamId);

  if (!providerData) {
    throw new Error("Companies House is not connected");
  }

  const profile = await getFilingProfile(db, params.teamId);
  const requestPayload = {
    companyNumber: params.companyNumber ?? profile?.companyNumber ?? undefined,
    description: params.description,
    reference: params.reference,
    resumeJourneyUri: params.resumeJourneyUri,
  };

  try {
    const transaction = await providerData.provider.createTransaction({
      companyNumber: requestPayload.companyNumber,
      description: requestPayload.description,
      reference: requestPayload.reference,
      resumeJourneyUri: requestPayload.resumeJourneyUri,
      accessToken: providerData.config.accessToken,
    });

    await createAccountsSubmissionEvent({
      db,
      teamId: params.teamId,
      eventType: "transaction_created",
      status: transaction.status,
      correlationId: transaction.id,
      requestPayload,
      responsePayload: transaction as unknown as Record<string, unknown>,
    });

    return transaction;
  } catch (error) {
    await createAccountsSubmissionEvent({
      db,
      teamId: params.teamId,
      eventType: "transaction_create_failed",
      status: "error",
      requestPayload,
      errorMessage: getErrorMessage(error),
    });

    throw error;
  }
}

export async function getCompaniesHouseTransaction(
  db: Database,
  params: {
    teamId: string;
    transactionId: string;
  },
) {
  const providerData = await getCompaniesHouseProviderData(db, params.teamId);

  if (!providerData) {
    throw new Error("Companies House is not connected");
  }

  return providerData.provider.getTransaction({
    transactionId: params.transactionId,
    accessToken: providerData.config.accessToken,
  });
}

async function recordTransactionEvent(args: {
  db: Database;
  teamId: string;
  transactionId: string;
  eventType: string;
  action: () => Promise<CompaniesHouseTransaction | { success: true }>;
}) {
  try {
    const result = await args.action();

    await createAccountsSubmissionEvent({
      db: args.db,
      teamId: args.teamId,
      eventType: args.eventType,
      status:
        "status" in result && typeof result.status === "string"
          ? result.status
          : "deleted",
      correlationId: args.transactionId,
      requestPayload: {
        transactionId: args.transactionId,
      },
      responsePayload: result as unknown as Record<string, unknown>,
    });

    return result;
  } catch (error) {
    await createAccountsSubmissionEvent({
      db: args.db,
      teamId: args.teamId,
      eventType: `${args.eventType}_failed`,
      status: "error",
      correlationId: args.transactionId,
      requestPayload: {
        transactionId: args.transactionId,
      },
      errorMessage: getErrorMessage(error),
    });

    throw error;
  }
}

export async function closeCompaniesHouseTransaction(
  db: Database,
  params: {
    teamId: string;
    transactionId: string;
  },
) {
  const providerData = await getCompaniesHouseProviderData(db, params.teamId);

  if (!providerData) {
    throw new Error("Companies House is not connected");
  }

  return recordTransactionEvent({
    db,
    teamId: params.teamId,
    transactionId: params.transactionId,
    eventType: "transaction_closed",
    action: () =>
      providerData.provider.closeTransaction({
        transactionId: params.transactionId,
        accessToken: providerData.config.accessToken,
      }),
  });
}

export async function deleteCompaniesHouseTransaction(
  db: Database,
  params: {
    teamId: string;
    transactionId: string;
  },
) {
  const providerData = await getCompaniesHouseProviderData(db, params.teamId);

  if (!providerData) {
    throw new Error("Companies House is not connected");
  }

  return recordTransactionEvent({
    db,
    teamId: params.teamId,
    transactionId: params.transactionId,
    eventType: "transaction_deleted",
    action: () =>
      providerData.provider.deleteTransaction({
        transactionId: params.transactionId,
        accessToken: providerData.config.accessToken,
      }),
  });
}
