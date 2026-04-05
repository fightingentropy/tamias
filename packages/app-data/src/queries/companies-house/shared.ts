import {
  buildCompaniesHouseCompanyScope,
  CompaniesHouseProvider,
  CompaniesHouseProviderConfigSchema,
  type CompaniesHouseEnvironment,
} from "@tamias/compliance";
import { createSubmissionEventInConvex } from "../../convex";
import type { Database } from "../../client";
import { getAppByAppId, setAppConfig } from "../apps";
import { getFilingProfile } from "../compliance/shared";

export async function getCompaniesHouseProviderData(
  db: Database,
  teamId: string,
) {
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

export async function requireCompaniesHouseProviderData(
  db: Database,
  teamId: string,
) {
  const providerData = await getCompaniesHouseProviderData(db, teamId);

  if (!providerData) {
    throw new Error("Companies House is not connected");
  }

  return providerData;
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function isCompaniesHouseApiKeyMissing(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("Companies House API key missing")
  );
}

export function isMissingCompaniesHouseFilingHistoryResource(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("No static resource") &&
    error.message.includes("/filing-history")
  );
}

export function getCompaniesHouseEnvironment(): CompaniesHouseEnvironment {
  return process.env.COMPANIES_HOUSE_ENVIRONMENT === "production"
    ? "production"
    : "sandbox";
}

export function getRequiredCompanyNumber(params: {
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

export function requireCompaniesHouseScope(
  scopes: string[] | undefined,
  requiredScope: string,
  label: string,
) {
  if (!(scopes ?? []).includes(requiredScope)) {
    throw new Error(`Grant the ${label} scope in Companies House first`);
  }
}

export async function requireScopedCompanyNumber(args: {
  db: Database;
  teamId: string;
  explicitCompanyNumber?: string;
  scopeKind: Parameters<typeof buildCompaniesHouseCompanyScope>[1];
  label: string;
}) {
  const [providerData, profile] = await Promise.all([
    requireCompaniesHouseProviderData(args.db, args.teamId),
    getFilingProfile(args.db, args.teamId),
  ]);
  const companyNumber = getRequiredCompanyNumber({
    explicitCompanyNumber: args.explicitCompanyNumber,
    profileCompanyNumber: profile?.companyNumber,
  });

  requireCompaniesHouseScope(
    providerData.config.scope,
    buildCompaniesHouseCompanyScope(companyNumber, args.scopeKind),
    args.label,
  );

  return {
    providerData,
    profile,
    companyNumber,
  };
}

export async function createAccountsSubmissionEvent(args: {
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
