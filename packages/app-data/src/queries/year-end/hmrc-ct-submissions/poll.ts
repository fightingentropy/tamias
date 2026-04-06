import { HmrcCtProvider } from "@tamias/compliance";
import { createSubmissionEventInConvex } from "@tamias/app-data-convex";
import type { Database } from "../../../client";
import { getYearEndContext } from "../pack";
import { getSubmissionEventResponseEndpoint } from "../submission-common";
import { listCtSubmissionEvents } from "./list";

function resolveCtSubmissionStatus(message: {
  status?: "submitted" | "accepted" | "rejected";
  qualifier: string | null;
}) {
  if (message.status) {
    return message.status;
  }

  switch (message.qualifier) {
    case "response":
      return "accepted";
    case "error":
      return "rejected";
    default:
      return "submitted";
  }
}

export async function pollCt600Submission(
  db: Database,
  params: {
    teamId: string;
    periodKey?: string;
    correlationId?: string;
    responseEndpoint?: string | null;
  },
) {
  const context = await getYearEndContext(db, params.teamId, params.periodKey);
  const events = await listCtSubmissionEvents(db, {
    teamId: params.teamId,
    periodKey: context.period.periodKey,
  });
  const targetEvent = params.correlationId
    ? (events.find((event) => event.correlationId === params.correlationId) ?? null)
    : (events.find((event) => Boolean(event.correlationId)) ?? null);

  if (!targetEvent?.correlationId) {
    throw new Error("No CT submission acknowledgement is available to poll");
  }

  const provider = HmrcCtProvider.fromEnvironment();
  const requestPayload = {
    periodKey: context.period.periodKey,
    correlationId: targetEvent.correlationId,
    responseEndpoint:
      params.responseEndpoint ?? getSubmissionEventResponseEndpoint(targetEvent) ?? null,
    environment: provider.environment,
  };

  try {
    const receipt = await provider.pollSubmission({
      correlationId: targetEvent.correlationId,
      responseEndpoint:
        params.responseEndpoint ?? getSubmissionEventResponseEndpoint(targetEvent) ?? undefined,
    });

    await createSubmissionEventInConvex({
      teamId: params.teamId,
      filingProfileId: context.profile.id,
      provider: "hmrc-ct",
      obligationType: "corporation_tax",
      status: resolveCtSubmissionStatus(receipt),
      eventType: "submission_polled",
      correlationId: receipt.correlationId ?? targetEvent.correlationId,
      requestPayload,
      responsePayload: receipt as unknown as Record<string, unknown>,
    });

    return {
      receipt,
      previousSubmission: targetEvent,
    };
  } catch (error) {
    await createSubmissionEventInConvex({
      teamId: params.teamId,
      filingProfileId: context.profile.id,
      provider: "hmrc-ct",
      obligationType: "corporation_tax",
      status: "failed",
      eventType: "submission_poll_failed",
      correlationId: targetEvent.correlationId,
      requestPayload,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
