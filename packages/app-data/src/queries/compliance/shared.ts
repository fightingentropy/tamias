import {
  HmrcVatProvider,
  HmrcVatProviderConfigSchema,
  isUkComplianceVisible,
} from "@tamias/compliance";
import type { Database } from "../../client";
import {
  getFilingProfileFromConvex,
  getInstalledAppFromConvex,
  setInstalledAppConfigInConvex,
  type FilingProfileRecord,
  upsertFilingProfileInConvex,
} from "@tamias/app-data-convex";
import { getTeamById } from "../teams";

export type TeamContext = {
  id: string;
  name: string | null;
  countryCode: string | null;
  baseCurrency: string | null;
};

type UpsertFilingProfileParams = {
  teamId: string;
  provider?: "hmrc-vat";
  enabled: boolean;
  legalEntityType?: "uk_ltd";
  companyName?: string | null;
  companyNumber?: string | null;
  companyAuthenticationCode?: string | null;
  utr?: string | null;
  vrn?: string | null;
  vatScheme?: "standard_quarterly" | null;
  accountingBasis?: "cash" | "accrual";
  filingMode?: "client" | "agent";
  agentReferenceNumber?: string | null;
  yearEndMonth?: number | null;
  yearEndDay?: number | null;
  baseCurrency?: string | null;
  principalActivity?: string | null;
  directors?: string[];
  signingDirectorName?: string | null;
  approvalDate?: string | null;
  averageEmployeeCount?: number | null;
  ordinaryShareCount?: number | null;
  ordinaryShareNominalValue?: number | null;
  dormant?: boolean | null;
  auditExemptionClaimed?: boolean | null;
  membersDidNotRequireAudit?: boolean | null;
  directorsAcknowledgeResponsibilities?: boolean | null;
  accountsPreparedUnderSmallCompaniesRegime?: boolean | null;
};

export function assertUkComplianceEnabled(
  team: TeamContext,
  profile?: { enabled: boolean } | null,
) {
  const visible = isUkComplianceVisible({
    countryCode: team.countryCode,
    profileEnabled: profile?.enabled,
  });

  if (!visible) {
    throw new Error("UK compliance is not enabled for this team");
  }
}

export async function getTeamContext(
  db: Database,
  teamId: string,
): Promise<TeamContext> {
  const team = await getTeamById(db, teamId);

  if (!team) {
    throw new Error("Team not found");
  }

  return {
    id: team.id,
    name: team.name,
    countryCode: team.countryCode,
    baseCurrency: team.baseCurrency,
  };
}

export async function getHmrcVatApp(db: Database, teamId: string) {
  void db;
  return getInstalledAppFromConvex({
    teamId,
    appId: "hmrc-vat",
  });
}

export async function getHmrcProvider(
  db: Database,
  teamId: string,
  profile: FilingProfileRecord,
) {
  const app = await getHmrcVatApp(db, teamId);

  if (!app?.config) {
    return null;
  }

  let config = HmrcVatProviderConfigSchema.parse(app.config);
  if (profile.vrn && config.vrn !== profile.vrn) {
    config = { ...config, vrn: profile.vrn };
  }

  const provider = HmrcVatProvider.fromEnvironment(config);

  if (provider.isTokenExpired(new Date(config.expiresAt))) {
    const refreshed = await provider.refreshTokens(config.refreshToken);
    config = {
      ...refreshed,
      vrn: profile.vrn ?? refreshed.vrn,
      environment: refreshed.environment,
    };

    await setInstalledAppConfigInConvex({
      teamId,
      appId: "hmrc-vat",
      config,
    });
  }

  return { provider: HmrcVatProvider.fromEnvironment(config), config };
}

export async function getFilingProfile(db: Database, teamId: string) {
  void db;
  return getFilingProfileFromConvex({
    teamId,
    provider: "hmrc-vat",
  });
}

export async function upsertFilingProfile(
  db: Database,
  params: UpsertFilingProfileParams,
) {
  const team = await getTeamContext(db, params.teamId);

  if (
    (params.legalEntityType ?? "uk_ltd") === "uk_ltd" &&
    team.countryCode !== "GB"
  ) {
    throw new Error("UK compliance currently requires a GB team");
  }

  return upsertFilingProfileInConvex({
    teamId: params.teamId,
    provider: params.provider ?? "hmrc-vat",
    legalEntityType: params.legalEntityType ?? "uk_ltd",
    enabled: params.enabled,
    countryCode: "GB",
    companyName: params.companyName ?? team.name,
    companyNumber: params.companyNumber ?? null,
    companyAuthenticationCode: params.companyAuthenticationCode ?? null,
    utr: params.utr ?? null,
    vrn: params.vrn ?? null,
    vatScheme: params.vatScheme ?? "standard_quarterly",
    accountingBasis: params.accountingBasis ?? "cash",
    filingMode: params.filingMode ?? "client",
    agentReferenceNumber: params.agentReferenceNumber ?? null,
    yearEndMonth: params.yearEndMonth ?? 3,
    yearEndDay: params.yearEndDay ?? 31,
    baseCurrency: params.baseCurrency ?? team.baseCurrency ?? "GBP",
    principalActivity: params.principalActivity ?? null,
    directors: params.directors ?? [],
    signingDirectorName: params.signingDirectorName ?? null,
    approvalDate: params.approvalDate ?? null,
    averageEmployeeCount: params.averageEmployeeCount ?? null,
    ordinaryShareCount: params.ordinaryShareCount ?? null,
    ordinaryShareNominalValue: params.ordinaryShareNominalValue ?? null,
    dormant: params.dormant ?? null,
    auditExemptionClaimed: params.auditExemptionClaimed ?? null,
    membersDidNotRequireAudit: params.membersDidNotRequireAudit ?? null,
    directorsAcknowledgeResponsibilities:
      params.directorsAcknowledgeResponsibilities ?? null,
    accountsPreparedUnderSmallCompaniesRegime:
      params.accountsPreparedUnderSmallCompaniesRegime ?? null,
  });
}
