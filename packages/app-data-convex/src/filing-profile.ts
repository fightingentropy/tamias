import { convexApi, createClient, serviceArgs } from "./base";

export type FilingProfileRecord = {
  id: string;
  teamId: string;
  provider: string;
  legalEntityType: string;
  enabled: boolean;
  countryCode: string;
  companyName: string | null;
  companyNumber: string | null;
  companyAuthenticationCode: string | null;
  utr: string | null;
  vrn: string | null;
  vatScheme: string | null;
  accountingBasis: string;
  filingMode: string;
  agentReferenceNumber: string | null;
  yearEndMonth: number | null;
  yearEndDay: number | null;
  baseCurrency: string | null;
  principalActivity: string | null;
  directors: string[];
  signingDirectorName: string | null;
  approvalDate: string | null;
  averageEmployeeCount: number | null;
  ordinaryShareCount: number | null;
  ordinaryShareNominalValue: number | null;
  dormant: boolean | null;
  auditExemptionClaimed: boolean | null;
  membersDidNotRequireAudit: boolean | null;
  directorsAcknowledgeResponsibilities: boolean | null;
  accountsPreparedUnderSmallCompaniesRegime: boolean | null;
  createdAt: string;
  updatedAt: string;
};

export async function getFilingProfileFromConvex(args: { teamId: string; provider?: string }) {
  return createClient().query(
    convexApi.complianceState.serviceGetFilingProfile,
    serviceArgs({
      publicTeamId: args.teamId,
      provider: args.provider,
    }),
  ) as Promise<FilingProfileRecord | null>;
}

export async function upsertFilingProfileInConvex(args: {
  id?: string;
  teamId: string;
  provider: string;
  legalEntityType: string;
  enabled: boolean;
  countryCode: string;
  companyName?: string | null;
  companyNumber?: string | null;
  companyAuthenticationCode?: string | null;
  utr?: string | null;
  vrn?: string | null;
  vatScheme?: string | null;
  accountingBasis: string;
  filingMode: string;
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
}) {
  return createClient().mutation(
    convexApi.complianceState.serviceUpsertFilingProfile,
    serviceArgs({
      publicTeamId: args.teamId,
      filingProfileId: args.id,
      provider: args.provider,
      legalEntityType: args.legalEntityType,
      enabled: args.enabled,
      countryCode: args.countryCode,
      companyName: args.companyName,
      companyNumber: args.companyNumber,
      companyAuthenticationCode: args.companyAuthenticationCode,
      utr: args.utr,
      vrn: args.vrn,
      vatScheme: args.vatScheme,
      accountingBasis: args.accountingBasis,
      filingMode: args.filingMode,
      agentReferenceNumber: args.agentReferenceNumber,
      yearEndMonth: args.yearEndMonth,
      yearEndDay: args.yearEndDay,
      baseCurrency: args.baseCurrency,
      principalActivity: args.principalActivity,
      directors: args.directors,
      signingDirectorName: args.signingDirectorName,
      approvalDate: args.approvalDate,
      averageEmployeeCount: args.averageEmployeeCount,
      ordinaryShareCount: args.ordinaryShareCount,
      ordinaryShareNominalValue: args.ordinaryShareNominalValue,
      dormant: args.dormant,
      auditExemptionClaimed: args.auditExemptionClaimed,
      membersDidNotRequireAudit: args.membersDidNotRequireAudit,
      directorsAcknowledgeResponsibilities: args.directorsAcknowledgeResponsibilities,
      accountsPreparedUnderSmallCompaniesRegime: args.accountsPreparedUnderSmallCompaniesRegime,
    }),
  ) as Promise<FilingProfileRecord>;
}
