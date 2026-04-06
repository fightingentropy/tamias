import { ConvexError, v } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { rebuildDerivedComplianceJournalEntriesForTeam } from "./complianceLedger";
import { getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";
import { nowIso } from "../../packages/domain/src/identity";

type FilingProfileRecord = {
  _id: string;
  publicFilingProfileId?: string;
  provider: string;
  legalEntityType: string;
  enabled: boolean;
  countryCode: string;
  companyName?: string;
  companyNumber?: string;
  companyAuthenticationCode?: string;
  utr?: string;
  vrn?: string;
  vatScheme?: string;
  accountingBasis: string;
  filingMode: string;
  agentReferenceNumber?: string;
  yearEndMonth?: number;
  yearEndDay?: number;
  baseCurrency?: string;
  principalActivity?: string;
  directors?: string[];
  signingDirectorName?: string;
  approvalDate?: string;
  averageEmployeeCount?: number;
  ordinaryShareCount?: number;
  ordinaryShareNominalValue?: number;
  dormant?: boolean;
  auditExemptionClaimed?: boolean;
  membersDidNotRequireAudit?: boolean;
  directorsAcknowledgeResponsibilities?: boolean;
  accountsPreparedUnderSmallCompaniesRegime?: boolean;
  createdAt: string;
  updatedAt: string;
};

type ComplianceObligationRecord = {
  _id: string;
  publicComplianceObligationId?: string;
  filingProfileId: string;
  provider: string;
  obligationType: string;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  status: string;
  externalId?: string;
  raw?: unknown;
  createdAt: string;
  updatedAt: string;
};

type VatReturnLine = {
  code: string;
  label: string;
  amount: number;
  meta?: unknown;
};

type VatReturnRecord = {
  _id: string;
  publicVatReturnId?: string;
  filingProfileId: string;
  obligationId?: string;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  currency: string;
  netVatDue: number;
  submittedAt?: string;
  externalSubmissionId?: string;
  declarationAccepted?: boolean;
  lines: VatReturnLine[];
  createdAt: string;
  updatedAt: string;
};

type ComplianceStateCtx = QueryCtx | MutationCtx;

function serializeFilingProfile(
  publicTeamId: string,
  record: FilingProfileRecord,
) {
  return {
    id: record.publicFilingProfileId ?? record._id,
    teamId: publicTeamId,
    provider: record.provider,
    legalEntityType: record.legalEntityType,
    enabled: record.enabled,
    countryCode: record.countryCode,
    companyName: record.companyName ?? null,
    companyNumber: record.companyNumber ?? null,
    companyAuthenticationCode: record.companyAuthenticationCode ?? null,
    utr: record.utr ?? null,
    vrn: record.vrn ?? null,
    vatScheme: record.vatScheme ?? null,
    accountingBasis: record.accountingBasis,
    filingMode: record.filingMode,
    agentReferenceNumber: record.agentReferenceNumber ?? null,
    yearEndMonth: record.yearEndMonth ?? null,
    yearEndDay: record.yearEndDay ?? null,
    baseCurrency: record.baseCurrency ?? null,
    principalActivity: record.principalActivity ?? null,
    directors: record.directors ?? [],
    signingDirectorName: record.signingDirectorName ?? null,
    approvalDate: record.approvalDate ?? null,
    averageEmployeeCount: record.averageEmployeeCount ?? null,
    ordinaryShareCount: record.ordinaryShareCount ?? null,
    ordinaryShareNominalValue: record.ordinaryShareNominalValue ?? null,
    dormant: record.dormant ?? null,
    auditExemptionClaimed: record.auditExemptionClaimed ?? null,
    membersDidNotRequireAudit: record.membersDidNotRequireAudit ?? null,
    directorsAcknowledgeResponsibilities:
      record.directorsAcknowledgeResponsibilities ?? null,
    accountsPreparedUnderSmallCompaniesRegime:
      record.accountsPreparedUnderSmallCompaniesRegime ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function serializeComplianceObligation(
  publicTeamId: string,
  record: ComplianceObligationRecord,
) {
  return {
    id: record.publicComplianceObligationId ?? record._id,
    teamId: publicTeamId,
    filingProfileId: record.filingProfileId,
    provider: record.provider,
    obligationType: record.obligationType,
    periodKey: record.periodKey,
    periodStart: record.periodStart,
    periodEnd: record.periodEnd,
    dueDate: record.dueDate,
    status: record.status,
    externalId: record.externalId ?? null,
    raw: record.raw ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function serializeVatReturn(publicTeamId: string, record: VatReturnRecord) {
  return {
    id: record.publicVatReturnId ?? record._id,
    teamId: publicTeamId,
    filingProfileId: record.filingProfileId,
    obligationId: record.obligationId ?? null,
    periodKey: record.periodKey,
    periodStart: record.periodStart,
    periodEnd: record.periodEnd,
    status: record.status,
    currency: record.currency,
    netVatDue: record.netVatDue,
    submittedAt: record.submittedAt ?? null,
    externalSubmissionId: record.externalSubmissionId ?? null,
    declarationAccepted: record.declarationAccepted ?? false,
    lines: record.lines.map((line) => ({
      code: line.code,
      label: line.label,
      amount: line.amount,
      meta: line.meta ?? null,
    })),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

async function getTeamOrThrow(ctx: ComplianceStateCtx, publicTeamId: string) {
  const team = await getTeamByPublicTeamId(ctx, publicTeamId);

  if (!team) {
    throw new ConvexError("Convex compliance team not found");
  }

  return team;
}

export const serviceGetFilingProfile = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    provider: v.optional(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return null;
    }

    const record = await ctx.db
      .query("filingProfiles")
      .withIndex("by_team_and_provider", (q) =>
        q.eq("teamId", team._id).eq("provider", args.provider ?? "hmrc-vat"),
      )
      .unique();

    if (!record) {
      return null;
    }

    return serializeFilingProfile(args.publicTeamId, {
      _id: record._id,
      publicFilingProfileId: record.publicFilingProfileId,
      provider: record.provider,
      legalEntityType: record.legalEntityType,
      enabled: record.enabled,
      countryCode: record.countryCode,
      companyName: record.companyName,
      companyNumber: record.companyNumber,
      companyAuthenticationCode: record.companyAuthenticationCode,
      utr: record.utr,
      vrn: record.vrn,
      vatScheme: record.vatScheme,
      accountingBasis: record.accountingBasis,
      filingMode: record.filingMode,
      agentReferenceNumber: record.agentReferenceNumber,
      yearEndMonth: record.yearEndMonth,
      yearEndDay: record.yearEndDay,
      baseCurrency: record.baseCurrency,
      principalActivity: record.principalActivity,
      directors: record.directors,
      signingDirectorName: record.signingDirectorName,
      approvalDate: record.approvalDate,
      averageEmployeeCount: record.averageEmployeeCount,
      ordinaryShareCount: record.ordinaryShareCount,
      ordinaryShareNominalValue: record.ordinaryShareNominalValue,
      dormant: record.dormant,
      auditExemptionClaimed: record.auditExemptionClaimed,
      membersDidNotRequireAudit: record.membersDidNotRequireAudit,
      directorsAcknowledgeResponsibilities:
        record.directorsAcknowledgeResponsibilities,
      accountsPreparedUnderSmallCompaniesRegime:
        record.accountsPreparedUnderSmallCompaniesRegime,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  },
});

export const serviceUpsertFilingProfile = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    filingProfileId: v.optional(v.string()),
    provider: v.string(),
    legalEntityType: v.string(),
    enabled: v.boolean(),
    countryCode: v.string(),
    companyName: v.optional(v.union(v.string(), v.null())),
    companyNumber: v.optional(v.union(v.string(), v.null())),
    companyAuthenticationCode: v.optional(v.union(v.string(), v.null())),
    utr: v.optional(v.union(v.string(), v.null())),
    vrn: v.optional(v.union(v.string(), v.null())),
    vatScheme: v.optional(v.union(v.string(), v.null())),
    accountingBasis: v.string(),
    filingMode: v.string(),
    agentReferenceNumber: v.optional(v.union(v.string(), v.null())),
    yearEndMonth: v.optional(v.union(v.number(), v.null())),
    yearEndDay: v.optional(v.union(v.number(), v.null())),
    baseCurrency: v.optional(v.union(v.string(), v.null())),
    principalActivity: v.optional(v.union(v.string(), v.null())),
    directors: v.optional(v.array(v.string())),
    signingDirectorName: v.optional(v.union(v.string(), v.null())),
    approvalDate: v.optional(v.union(v.string(), v.null())),
    averageEmployeeCount: v.optional(v.union(v.number(), v.null())),
    ordinaryShareCount: v.optional(v.union(v.number(), v.null())),
    ordinaryShareNominalValue: v.optional(v.union(v.number(), v.null())),
    dormant: v.optional(v.union(v.boolean(), v.null())),
    auditExemptionClaimed: v.optional(v.union(v.boolean(), v.null())),
    membersDidNotRequireAudit: v.optional(v.union(v.boolean(), v.null())),
    directorsAcknowledgeResponsibilities: v.optional(
      v.union(v.boolean(), v.null()),
    ),
    accountsPreparedUnderSmallCompaniesRegime: v.optional(
      v.union(v.boolean(), v.null()),
    ),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamOrThrow(ctx, args.publicTeamId);
    const existing = await ctx.db
      .query("filingProfiles")
      .withIndex("by_team_and_provider", (q) =>
        q.eq("teamId", team._id).eq("provider", args.provider),
      )
      .unique();
    const timestamp = nowIso();

    if (existing) {
      await ctx.db.patch(existing._id, {
        publicFilingProfileId:
          existing.publicFilingProfileId ?? args.filingProfileId ?? undefined,
        legalEntityType: args.legalEntityType,
        enabled: args.enabled,
        countryCode: args.countryCode,
        companyName: args.companyName ?? undefined,
        companyNumber: args.companyNumber ?? undefined,
        companyAuthenticationCode: args.companyAuthenticationCode ?? undefined,
        utr: args.utr ?? undefined,
        vrn: args.vrn ?? undefined,
        vatScheme: args.vatScheme ?? undefined,
        accountingBasis: args.accountingBasis,
        filingMode: args.filingMode,
        agentReferenceNumber: args.agentReferenceNumber ?? undefined,
        yearEndMonth: args.yearEndMonth ?? undefined,
        yearEndDay: args.yearEndDay ?? undefined,
        baseCurrency: args.baseCurrency ?? undefined,
        principalActivity: args.principalActivity ?? undefined,
        directors: args.directors?.length ? args.directors : undefined,
        signingDirectorName: args.signingDirectorName ?? undefined,
        approvalDate: args.approvalDate ?? undefined,
        averageEmployeeCount: args.averageEmployeeCount ?? undefined,
        ordinaryShareCount: args.ordinaryShareCount ?? undefined,
        ordinaryShareNominalValue: args.ordinaryShareNominalValue ?? undefined,
        dormant: args.dormant ?? undefined,
        auditExemptionClaimed: args.auditExemptionClaimed ?? undefined,
        membersDidNotRequireAudit: args.membersDidNotRequireAudit ?? undefined,
        directorsAcknowledgeResponsibilities:
          args.directorsAcknowledgeResponsibilities ?? undefined,
        accountsPreparedUnderSmallCompaniesRegime:
          args.accountsPreparedUnderSmallCompaniesRegime ?? undefined,
        updatedAt: timestamp,
      });

      const updated = await ctx.db.get(existing._id);

      if (!updated) {
        throw new ConvexError("Failed to update filing profile");
      }

      await rebuildDerivedComplianceJournalEntriesForTeam(ctx, team);

      return serializeFilingProfile(args.publicTeamId, {
        _id: updated._id,
        publicFilingProfileId: updated.publicFilingProfileId,
        provider: updated.provider,
        legalEntityType: updated.legalEntityType,
        enabled: updated.enabled,
        countryCode: updated.countryCode,
        companyName: updated.companyName,
        companyNumber: updated.companyNumber,
        companyAuthenticationCode: updated.companyAuthenticationCode,
        utr: updated.utr,
        vrn: updated.vrn,
        vatScheme: updated.vatScheme,
        accountingBasis: updated.accountingBasis,
        filingMode: updated.filingMode,
        agentReferenceNumber: updated.agentReferenceNumber,
        yearEndMonth: updated.yearEndMonth,
        yearEndDay: updated.yearEndDay,
        baseCurrency: updated.baseCurrency,
        principalActivity: updated.principalActivity,
        directors: updated.directors,
        signingDirectorName: updated.signingDirectorName,
        approvalDate: updated.approvalDate,
        averageEmployeeCount: updated.averageEmployeeCount,
        ordinaryShareCount: updated.ordinaryShareCount,
        ordinaryShareNominalValue: updated.ordinaryShareNominalValue,
        dormant: updated.dormant,
        auditExemptionClaimed: updated.auditExemptionClaimed,
        membersDidNotRequireAudit: updated.membersDidNotRequireAudit,
        directorsAcknowledgeResponsibilities:
          updated.directorsAcknowledgeResponsibilities,
        accountsPreparedUnderSmallCompaniesRegime:
          updated.accountsPreparedUnderSmallCompaniesRegime,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      });
    }

    const insertedId = await ctx.db.insert("filingProfiles", {
      publicFilingProfileId: args.filingProfileId ?? crypto.randomUUID(),
      teamId: team._id,
      provider: args.provider,
      legalEntityType: args.legalEntityType,
      enabled: args.enabled,
      countryCode: args.countryCode,
      companyName: args.companyName ?? undefined,
      companyNumber: args.companyNumber ?? undefined,
      companyAuthenticationCode: args.companyAuthenticationCode ?? undefined,
      utr: args.utr ?? undefined,
      vrn: args.vrn ?? undefined,
      vatScheme: args.vatScheme ?? undefined,
      accountingBasis: args.accountingBasis,
      filingMode: args.filingMode,
      agentReferenceNumber: args.agentReferenceNumber ?? undefined,
      yearEndMonth: args.yearEndMonth ?? undefined,
      yearEndDay: args.yearEndDay ?? undefined,
      baseCurrency: args.baseCurrency ?? undefined,
      principalActivity: args.principalActivity ?? undefined,
      directors: args.directors?.length ? args.directors : undefined,
      signingDirectorName: args.signingDirectorName ?? undefined,
      approvalDate: args.approvalDate ?? undefined,
      averageEmployeeCount: args.averageEmployeeCount ?? undefined,
      ordinaryShareCount: args.ordinaryShareCount ?? undefined,
      ordinaryShareNominalValue: args.ordinaryShareNominalValue ?? undefined,
      dormant: args.dormant ?? undefined,
      auditExemptionClaimed: args.auditExemptionClaimed ?? undefined,
      membersDidNotRequireAudit: args.membersDidNotRequireAudit ?? undefined,
      directorsAcknowledgeResponsibilities:
        args.directorsAcknowledgeResponsibilities ?? undefined,
      accountsPreparedUnderSmallCompaniesRegime:
        args.accountsPreparedUnderSmallCompaniesRegime ?? undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const inserted = await ctx.db.get(insertedId);

    if (!inserted) {
      throw new ConvexError("Failed to create filing profile");
    }

    await rebuildDerivedComplianceJournalEntriesForTeam(ctx, team);

    return serializeFilingProfile(args.publicTeamId, {
      _id: inserted._id,
      publicFilingProfileId: inserted.publicFilingProfileId,
      provider: inserted.provider,
      legalEntityType: inserted.legalEntityType,
      enabled: inserted.enabled,
      countryCode: inserted.countryCode,
      companyName: inserted.companyName,
      companyNumber: inserted.companyNumber,
      companyAuthenticationCode: inserted.companyAuthenticationCode,
      utr: inserted.utr,
      vrn: inserted.vrn,
      vatScheme: inserted.vatScheme,
      accountingBasis: inserted.accountingBasis,
      filingMode: inserted.filingMode,
      agentReferenceNumber: inserted.agentReferenceNumber,
      yearEndMonth: inserted.yearEndMonth,
      yearEndDay: inserted.yearEndDay,
      baseCurrency: inserted.baseCurrency,
      principalActivity: inserted.principalActivity,
      directors: inserted.directors,
      signingDirectorName: inserted.signingDirectorName,
      approvalDate: inserted.approvalDate,
      averageEmployeeCount: inserted.averageEmployeeCount,
      ordinaryShareCount: inserted.ordinaryShareCount,
      ordinaryShareNominalValue: inserted.ordinaryShareNominalValue,
      dormant: inserted.dormant,
      auditExemptionClaimed: inserted.auditExemptionClaimed,
      membersDidNotRequireAudit: inserted.membersDidNotRequireAudit,
      directorsAcknowledgeResponsibilities:
        inserted.directorsAcknowledgeResponsibilities,
      accountsPreparedUnderSmallCompaniesRegime:
        inserted.accountsPreparedUnderSmallCompaniesRegime,
      createdAt: inserted.createdAt,
      updatedAt: inserted.updatedAt,
    });
  },
});

export const serviceUpsertVatObligation = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    obligationId: v.optional(v.string()),
    filingProfileId: v.string(),
    provider: v.string(),
    obligationType: v.string(),
    periodKey: v.string(),
    periodStart: v.string(),
    periodEnd: v.string(),
    dueDate: v.string(),
    status: v.string(),
    externalId: v.optional(v.union(v.string(), v.null())),
    raw: v.optional(v.any()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamOrThrow(ctx, args.publicTeamId);
    const existing = await ctx.db
      .query("complianceObligations")
      .withIndex("by_team_and_filing_profile_period_key", (q) =>
        q
          .eq("teamId", team._id)
          .eq("filingProfileId", args.filingProfileId)
          .eq("provider", args.provider)
          .eq("obligationType", args.obligationType)
          .eq("periodKey", args.periodKey),
      )
      .unique();
    const timestamp = nowIso();

    if (existing) {
      await ctx.db.patch(existing._id, {
        publicComplianceObligationId:
          existing.publicComplianceObligationId ??
          args.obligationId ??
          undefined,
        periodStart: args.periodStart,
        periodEnd: args.periodEnd,
        dueDate: args.dueDate,
        status: args.status,
        externalId: args.externalId ?? undefined,
        raw: args.raw,
        updatedAt: timestamp,
      });

      const updated = await ctx.db.get(existing._id);

      if (!updated) {
        throw new ConvexError("Failed to update VAT obligation");
      }

      return serializeComplianceObligation(args.publicTeamId, {
        _id: updated._id,
        publicComplianceObligationId: updated.publicComplianceObligationId,
        filingProfileId: updated.filingProfileId,
        provider: updated.provider,
        obligationType: updated.obligationType,
        periodKey: updated.periodKey,
        periodStart: updated.periodStart,
        periodEnd: updated.periodEnd,
        dueDate: updated.dueDate,
        status: updated.status,
        externalId: updated.externalId,
        raw: updated.raw,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      });
    }

    const insertedId = await ctx.db.insert("complianceObligations", {
      publicComplianceObligationId: args.obligationId ?? crypto.randomUUID(),
      teamId: team._id,
      filingProfileId: args.filingProfileId,
      provider: args.provider,
      obligationType: args.obligationType,
      periodKey: args.periodKey,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      dueDate: args.dueDate,
      status: args.status,
      externalId: args.externalId ?? undefined,
      raw: args.raw,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const inserted = await ctx.db.get(insertedId);

    if (!inserted) {
      throw new ConvexError("Failed to create VAT obligation");
    }

    return serializeComplianceObligation(args.publicTeamId, {
      _id: inserted._id,
      publicComplianceObligationId: inserted.publicComplianceObligationId,
      filingProfileId: inserted.filingProfileId,
      provider: inserted.provider,
      obligationType: inserted.obligationType,
      periodKey: inserted.periodKey,
      periodStart: inserted.periodStart,
      periodEnd: inserted.periodEnd,
      dueDate: inserted.dueDate,
      status: inserted.status,
      externalId: inserted.externalId,
      raw: inserted.raw,
      createdAt: inserted.createdAt,
      updatedAt: inserted.updatedAt,
    });
  },
});

export const serviceListVatObligations = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    const records = await ctx.db
      .query("complianceObligations")
      .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
      .collect();

    return records
      .sort((a, b) => a.periodStart.localeCompare(b.periodStart))
      .map((record) =>
        serializeComplianceObligation(args.publicTeamId, {
          _id: record._id,
          publicComplianceObligationId: record.publicComplianceObligationId,
          filingProfileId: record.filingProfileId,
          provider: record.provider,
          obligationType: record.obligationType,
          periodKey: record.periodKey,
          periodStart: record.periodStart,
          periodEnd: record.periodEnd,
          dueDate: record.dueDate,
          status: record.status,
          externalId: record.externalId,
          raw: record.raw,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        }),
      );
  },
});

export const serviceGetVatObligationById = query({
  args: {
    serviceKey: v.string(),
    obligationId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const record = await ctx.db
      .query("complianceObligations")
      .withIndex("by_public_compliance_obligation_id", (q) =>
        q.eq("publicComplianceObligationId", args.obligationId),
      )
      .unique();

    if (!record) {
      return null;
    }

    const team = await ctx.db.get(record.teamId);

    if (!team?.publicTeamId) {
      return null;
    }

    return serializeComplianceObligation(team.publicTeamId, {
      _id: record._id,
      publicComplianceObligationId: record.publicComplianceObligationId,
      filingProfileId: record.filingProfileId,
      provider: record.provider,
      obligationType: record.obligationType,
      periodKey: record.periodKey,
      periodStart: record.periodStart,
      periodEnd: record.periodEnd,
      dueDate: record.dueDate,
      status: record.status,
      externalId: record.externalId,
      raw: record.raw,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  },
});

export const serviceGetVatReturnById = query({
  args: {
    serviceKey: v.string(),
    vatReturnId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const record = await ctx.db
      .query("vatReturns")
      .withIndex("by_public_vat_return_id", (q) =>
        q.eq("publicVatReturnId", args.vatReturnId),
      )
      .unique();

    if (!record) {
      return null;
    }

    const team = await ctx.db.get(record.teamId);

    if (!team?.publicTeamId) {
      return null;
    }

    return serializeVatReturn(team.publicTeamId, {
      _id: record._id,
      publicVatReturnId: record.publicVatReturnId,
      filingProfileId: record.filingProfileId,
      obligationId: record.obligationId,
      periodKey: record.periodKey,
      periodStart: record.periodStart,
      periodEnd: record.periodEnd,
      status: record.status,
      currency: record.currency,
      netVatDue: record.netVatDue,
      submittedAt: record.submittedAt,
      externalSubmissionId: record.externalSubmissionId,
      declarationAccepted: record.declarationAccepted,
      lines: record.lines,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  },
});

export const serviceGetVatReturnByObligationId = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    obligationId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return null;
    }

    const record = await ctx.db
      .query("vatReturns")
      .withIndex("by_team_and_obligation_id", (q) =>
        q.eq("teamId", team._id).eq("obligationId", args.obligationId),
      )
      .unique();

    if (!record) {
      return null;
    }

    return serializeVatReturn(args.publicTeamId, {
      _id: record._id,
      publicVatReturnId: record.publicVatReturnId,
      filingProfileId: record.filingProfileId,
      obligationId: record.obligationId,
      periodKey: record.periodKey,
      periodStart: record.periodStart,
      periodEnd: record.periodEnd,
      status: record.status,
      currency: record.currency,
      netVatDue: record.netVatDue,
      submittedAt: record.submittedAt,
      externalSubmissionId: record.externalSubmissionId,
      declarationAccepted: record.declarationAccepted,
      lines: record.lines,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  },
});

export const serviceGetLatestVatReturn = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return null;
    }

    const records = await ctx.db
      .query("vatReturns")
      .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
      .collect();
    const latest = records.sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    )[0];

    if (!latest) {
      return null;
    }

    return serializeVatReturn(args.publicTeamId, {
      _id: latest._id,
      publicVatReturnId: latest.publicVatReturnId,
      filingProfileId: latest.filingProfileId,
      obligationId: latest.obligationId,
      periodKey: latest.periodKey,
      periodStart: latest.periodStart,
      periodEnd: latest.periodEnd,
      status: latest.status,
      currency: latest.currency,
      netVatDue: latest.netVatDue,
      submittedAt: latest.submittedAt,
      externalSubmissionId: latest.externalSubmissionId,
      declarationAccepted: latest.declarationAccepted,
      lines: latest.lines,
      createdAt: latest.createdAt,
      updatedAt: latest.updatedAt,
    });
  },
});

export const serviceUpsertVatReturn = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    vatReturnId: v.optional(v.string()),
    filingProfileId: v.string(),
    obligationId: v.optional(v.union(v.string(), v.null())),
    periodKey: v.string(),
    periodStart: v.string(),
    periodEnd: v.string(),
    status: v.string(),
    currency: v.string(),
    netVatDue: v.number(),
    submittedAt: v.optional(v.union(v.string(), v.null())),
    externalSubmissionId: v.optional(v.union(v.string(), v.null())),
    declarationAccepted: v.optional(v.union(v.boolean(), v.null())),
    lines: v.array(
      v.object({
        code: v.string(),
        label: v.string(),
        amount: v.number(),
        meta: v.optional(v.any()),
      }),
    ),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamOrThrow(ctx, args.publicTeamId);
    const existing = await ctx.db
      .query("vatReturns")
      .withIndex("by_team_and_filing_profile_period_key", (q) =>
        q
          .eq("teamId", team._id)
          .eq("filingProfileId", args.filingProfileId)
          .eq("periodKey", args.periodKey),
      )
      .unique();
    const timestamp = nowIso();

    if (existing) {
      await ctx.db.patch(existing._id, {
        publicVatReturnId:
          existing.publicVatReturnId ?? args.vatReturnId ?? undefined,
        obligationId: args.obligationId ?? undefined,
        periodStart: args.periodStart,
        periodEnd: args.periodEnd,
        status: args.status,
        currency: args.currency,
        netVatDue: args.netVatDue,
        submittedAt: args.submittedAt ?? undefined,
        externalSubmissionId: args.externalSubmissionId ?? undefined,
        declarationAccepted: args.declarationAccepted ?? undefined,
        lines: args.lines,
        updatedAt: timestamp,
      });

      const updated = await ctx.db.get(existing._id);

      if (!updated) {
        throw new ConvexError("Failed to update VAT return");
      }

      return serializeVatReturn(args.publicTeamId, {
        _id: updated._id,
        publicVatReturnId: updated.publicVatReturnId,
        filingProfileId: updated.filingProfileId,
        obligationId: updated.obligationId,
        periodKey: updated.periodKey,
        periodStart: updated.periodStart,
        periodEnd: updated.periodEnd,
        status: updated.status,
        currency: updated.currency,
        netVatDue: updated.netVatDue,
        submittedAt: updated.submittedAt,
        externalSubmissionId: updated.externalSubmissionId,
        declarationAccepted: updated.declarationAccepted,
        lines: updated.lines,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      });
    }

    const insertedId = await ctx.db.insert("vatReturns", {
      publicVatReturnId: args.vatReturnId ?? crypto.randomUUID(),
      teamId: team._id,
      filingProfileId: args.filingProfileId,
      obligationId: args.obligationId ?? undefined,
      periodKey: args.periodKey,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      status: args.status,
      currency: args.currency,
      netVatDue: args.netVatDue,
      submittedAt: args.submittedAt ?? undefined,
      externalSubmissionId: args.externalSubmissionId ?? undefined,
      declarationAccepted: args.declarationAccepted ?? undefined,
      lines: args.lines,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const inserted = await ctx.db.get(insertedId);

    if (!inserted) {
      throw new ConvexError("Failed to create VAT return");
    }

    return serializeVatReturn(args.publicTeamId, {
      _id: inserted._id,
      publicVatReturnId: inserted.publicVatReturnId,
      filingProfileId: inserted.filingProfileId,
      obligationId: inserted.obligationId,
      periodKey: inserted.periodKey,
      periodStart: inserted.periodStart,
      periodEnd: inserted.periodEnd,
      status: inserted.status,
      currency: inserted.currency,
      netVatDue: inserted.netVatDue,
      submittedAt: inserted.submittedAt,
      externalSubmissionId: inserted.externalSubmissionId,
      declarationAccepted: inserted.declarationAccepted,
      lines: inserted.lines,
      createdAt: inserted.createdAt,
      updatedAt: inserted.updatedAt,
    });
  },
});

export const serviceMarkVatReturnAccepted = mutation({
  args: {
    serviceKey: v.string(),
    vatReturnId: v.string(),
    submittedAt: v.string(),
    externalSubmissionId: v.optional(v.union(v.string(), v.null())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const record = await ctx.db
      .query("vatReturns")
      .withIndex("by_public_vat_return_id", (q) =>
        q.eq("publicVatReturnId", args.vatReturnId),
      )
      .unique();

    if (!record) {
      throw new ConvexError("VAT return not found");
    }

    await ctx.db.patch(record._id, {
      status: "accepted",
      submittedAt: args.submittedAt,
      externalSubmissionId: args.externalSubmissionId ?? undefined,
      declarationAccepted: true,
      updatedAt: nowIso(),
    });

    const updated = await ctx.db.get(record._id);

    if (!updated) {
      throw new ConvexError("Failed to update VAT return");
    }

    const team = await ctx.db.get(updated.teamId);

    if (!team?.publicTeamId) {
      throw new ConvexError("VAT return team not found");
    }

    return serializeVatReturn(team.publicTeamId, {
      _id: updated._id,
      publicVatReturnId: updated.publicVatReturnId,
      filingProfileId: updated.filingProfileId,
      obligationId: updated.obligationId,
      periodKey: updated.periodKey,
      periodStart: updated.periodStart,
      periodEnd: updated.periodEnd,
      status: updated.status,
      currency: updated.currency,
      netVatDue: updated.netVatDue,
      submittedAt: updated.submittedAt,
      externalSubmissionId: updated.externalSubmissionId,
      declarationAccepted: updated.declarationAccepted,
      lines: updated.lines,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  },
});

export const serviceListVatSubmissions = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    const records = await ctx.db
      .query("vatReturns")
      .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
      .collect();

    return records
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((record) =>
        serializeVatReturn(args.publicTeamId, {
          _id: record._id,
          publicVatReturnId: record.publicVatReturnId,
          filingProfileId: record.filingProfileId,
          obligationId: record.obligationId,
          periodKey: record.periodKey,
          periodStart: record.periodStart,
          periodEnd: record.periodEnd,
          status: record.status,
          currency: record.currency,
          netVatDue: record.netVatDue,
          submittedAt: record.submittedAt,
          externalSubmissionId: record.externalSubmissionId,
          declarationAccepted: record.declarationAccepted,
          lines: record.lines,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        }),
      );
  },
});
