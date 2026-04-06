import type { ConvexUserId } from "./base";
import { api, convexApi, createClient, serviceArgs } from "./base";

export type EvidencePackRecord = {
  id: string;
  teamId: string;
  filingProfileId: string;
  vatReturnId: string;
  checksum: string;
  payload: Record<string, unknown>;
  createdBy: ConvexUserId | null;
  createdAt: string;
};

export type SubmissionEventRecord = {
  id: string;
  teamId: string;
  filingProfileId: string;
  provider: string;
  obligationType: string;
  vatReturnId: string | null;
  status: string;
  eventType: string;
  correlationId: string | null;
  requestPayload?: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
  errorMessage: string | null;
  createdAt: string;
};

export async function upsertEvidencePackInConvex(args: {
  teamId: string;
  id?: string;
  filingProfileId: string;
  vatReturnId: string;
  checksum: string;
  payload: Record<string, unknown>;
  createdBy?: ConvexUserId | null;
}) {
  return createClient().mutation(
    api.evidencePacks.serviceUpsertEvidencePack,
    serviceArgs({
      publicTeamId: args.teamId,
      evidencePackId: args.id,
      filingProfileId: args.filingProfileId,
      vatReturnId: args.vatReturnId,
      checksum: args.checksum,
      payload: args.payload,
      createdBy: args.createdBy,
    }),
  ) as Promise<EvidencePackRecord>;
}

export async function getEvidencePackByIdFromConvex(args: {
  teamId: string;
  id: string;
}) {
  return createClient().query(
    api.evidencePacks.serviceGetEvidencePackById,
    serviceArgs({
      publicTeamId: args.teamId,
      evidencePackId: args.id,
    }),
  ) as Promise<EvidencePackRecord | null>;
}

export async function createSubmissionEventInConvex(args: {
  teamId: string;
  filingProfileId: string;
  provider: string;
  obligationType: string;
  vatReturnId?: string | null;
  status: string;
  eventType: string;
  correlationId?: string | null;
  requestPayload?: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
  errorMessage?: string | null;
}) {
  return createClient().mutation(
    convexApi.submissionEvents.serviceCreateSubmissionEvent as any,
    serviceArgs({
      publicTeamId: args.teamId,
      filingProfileId: args.filingProfileId,
      provider: args.provider,
      obligationType: args.obligationType,
      vatReturnId: args.vatReturnId,
      status: args.status,
      eventType: args.eventType,
      correlationId: args.correlationId,
      requestPayload: args.requestPayload,
      responsePayload: args.responsePayload,
      errorMessage: args.errorMessage,
    }),
  ) as Promise<SubmissionEventRecord | null>;
}

export async function listSubmissionEventsFromConvex(args: {
  teamId: string;
  provider?: string;
  obligationType?: string;
}) {
  return createClient().query(
    convexApi.submissionEvents.serviceListSubmissionEvents as any,
    serviceArgs({
      publicTeamId: args.teamId,
      provider: args.provider,
      obligationType: args.obligationType,
    }),
  ) as Promise<SubmissionEventRecord[]>;
}

export async function allocateFilingSequenceInConvex(args: { scope: string }) {
  return createClient().mutation(
    convexApi.filingSequences.serviceAllocateFilingSequence,
    serviceArgs({
      scope: args.scope,
    }),
  ) as Promise<number>;
}
