import {
  CompaniesHouseProvider,
  CompaniesHouseXmlGatewayProvider,
  extractCompaniesHouseCompanyScopes,
  getCompaniesHouseXmlGatewayEnvironment,
} from "@tamias/compliance";
import type { Database } from "../../client";
import { reuseQueryResult } from "../../utils/request-cache";
import { getFilingProfile } from "../compliance/shared";
import { getYearEndPack } from "../year-end";
import {
  getCompaniesHouseEnvironment,
  getCompaniesHouseProviderData,
  getErrorMessage,
  isCompaniesHouseApiKeyMissing,
  isMissingCompaniesHouseFilingHistoryResource,
} from "./shared";

async function getCompaniesHouseConnectionImpl(
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

export const getCompaniesHouseConnection = reuseQueryResult({
  keyPrefix: "companies-house-connection",
  keyFn: (params: { teamId: string }) => params.teamId,
  load: getCompaniesHouseConnectionImpl,
});

async function getCompaniesHouseAccountsStatusImpl(
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

export const getCompaniesHouseAccountsStatus = reuseQueryResult({
  keyPrefix: "companies-house-accounts-status",
  keyFn: (params: { teamId: string }) => params.teamId,
  load: getCompaniesHouseAccountsStatusImpl,
});
