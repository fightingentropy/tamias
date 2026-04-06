import { convexApi, createClient, serviceArgs } from "./base";

export type ComplianceObligationRecord = {
  id: string;
  teamId: string;
  filingProfileId: string;
  provider: string;
  obligationType: string;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  status: string;
  externalId: string | null;
  raw: unknown;
  createdAt: string;
  updatedAt: string;
};

export type VatReturnLineRecord = {
  code: string;
  label: string;
  amount: number;
  meta: unknown;
};

export type VatReturnRecord = {
  id: string;
  teamId: string;
  filingProfileId: string;
  obligationId: string | null;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  status: "draft" | "ready" | "submitted" | "accepted" | "rejected";
  currency: string;
  netVatDue: number;
  submittedAt: string | null;
  externalSubmissionId: string | null;
  declarationAccepted: boolean;
  lines: VatReturnLineRecord[];
  createdAt: string;
  updatedAt: string;
};

export async function upsertVatObligationInConvex(args: {
  id?: string;
  teamId: string;
  filingProfileId: string;
  provider: string;
  obligationType: string;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  status: string;
  externalId?: string | null;
  raw?: unknown;
}) {
  return createClient().mutation(
    convexApi.complianceState.serviceUpsertVatObligation,
    serviceArgs({
      publicTeamId: args.teamId,
      obligationId: args.id,
      filingProfileId: args.filingProfileId,
      provider: args.provider,
      obligationType: args.obligationType,
      periodKey: args.periodKey,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      dueDate: args.dueDate,
      status: args.status,
      externalId: args.externalId,
      raw: args.raw,
    }),
  ) as Promise<ComplianceObligationRecord>;
}

export async function upsertComplianceObligationInConvex(args: {
  id?: string;
  teamId: string;
  filingProfileId: string;
  provider: string;
  obligationType: string;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  status: string;
  externalId?: string | null;
  raw?: unknown;
}) {
  return upsertVatObligationInConvex(args);
}

export async function listVatObligationsFromConvex(args: { teamId: string }) {
  return createClient().query(
    convexApi.complianceState.serviceListVatObligations,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<ComplianceObligationRecord[]>;
}

export async function listComplianceObligationsFromConvex(args: {
  teamId: string;
  provider?: string;
  obligationType?: string;
}) {
  const obligations = await listVatObligationsFromConvex({
    teamId: args.teamId,
  });

  return obligations.filter((obligation) => {
    if (args.provider && obligation.provider !== args.provider) {
      return false;
    }

    if (args.obligationType && obligation.obligationType !== args.obligationType) {
      return false;
    }

    return true;
  });
}

export async function getVatObligationByIdFromConvex(args: { id: string }) {
  return createClient().query(
    convexApi.complianceState.serviceGetVatObligationById,
    serviceArgs({
      obligationId: args.id,
    }),
  ) as Promise<ComplianceObligationRecord | null>;
}

export async function getComplianceObligationByIdFromConvex(args: { id: string }) {
  return getVatObligationByIdFromConvex(args);
}

export async function getVatReturnByIdFromConvex(args: { id: string }) {
  return createClient().query(
    convexApi.complianceState.serviceGetVatReturnById,
    serviceArgs({
      vatReturnId: args.id,
    }),
  ) as Promise<VatReturnRecord | null>;
}

export async function getVatReturnByObligationIdFromConvex(args: {
  teamId: string;
  obligationId: string;
}) {
  return createClient().query(
    convexApi.complianceState.serviceGetVatReturnByObligationId,
    serviceArgs({
      publicTeamId: args.teamId,
      obligationId: args.obligationId,
    }),
  ) as Promise<VatReturnRecord | null>;
}

export async function getLatestVatReturnFromConvex(args: { teamId: string }) {
  return createClient().query(
    convexApi.complianceState.serviceGetLatestVatReturn,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<VatReturnRecord | null>;
}

export async function upsertVatReturnInConvex(args: {
  id?: string;
  teamId: string;
  filingProfileId: string;
  obligationId?: string | null;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  currency: string;
  netVatDue: number;
  submittedAt?: string | null;
  externalSubmissionId?: string | null;
  declarationAccepted?: boolean | null;
  lines: Array<{
    code: string;
    label: string;
    amount: number;
    meta?: unknown;
  }>;
}) {
  return createClient().mutation(
    convexApi.complianceState.serviceUpsertVatReturn,
    serviceArgs({
      publicTeamId: args.teamId,
      vatReturnId: args.id,
      filingProfileId: args.filingProfileId,
      obligationId: args.obligationId,
      periodKey: args.periodKey,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      status: args.status,
      currency: args.currency,
      netVatDue: args.netVatDue,
      submittedAt: args.submittedAt,
      externalSubmissionId: args.externalSubmissionId,
      declarationAccepted: args.declarationAccepted,
      lines: args.lines,
    }),
  ) as Promise<VatReturnRecord>;
}

export async function markVatReturnAcceptedInConvex(args: {
  vatReturnId: string;
  submittedAt: string;
  externalSubmissionId?: string | null;
}) {
  return createClient().mutation(
    convexApi.complianceState.serviceMarkVatReturnAccepted,
    serviceArgs({
      vatReturnId: args.vatReturnId,
      submittedAt: args.submittedAt,
      externalSubmissionId: args.externalSubmissionId,
    }),
  ) as Promise<VatReturnRecord>;
}

export async function listVatSubmissionsFromConvex(args: { teamId: string }) {
  return createClient().query(
    convexApi.complianceState.serviceListVatSubmissions,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<VatReturnRecord[]>;
}
