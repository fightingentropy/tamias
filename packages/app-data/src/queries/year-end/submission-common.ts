import {
  listSubmissionEventsFromConvex,
  type YearEndPackRecord,
} from "@tamias/app-data-convex";

export function getSubmissionEventRequestPeriodKey(
  event: {
    requestPayload?: Record<string, unknown>;
  } | null,
) {
  const periodKey = event?.requestPayload?.periodKey;
  return typeof periodKey === "string" ? periodKey : null;
}

export function getSubmissionEventResponseEndpoint(
  event: {
    responsePayload?: Record<string, unknown>;
  } | null,
) {
  const responseEndpoint = event?.responsePayload?.responseEndpoint;
  return typeof responseEndpoint === "string" ? responseEndpoint : null;
}

export function getSubmissionEventRequestSubmissionNumber(
  event: {
    requestPayload?: Record<string, unknown>;
  } | null,
) {
  const submissionNumber = event?.requestPayload?.submissionNumber;
  return typeof submissionNumber === "string" ? submissionNumber : null;
}

export async function listYearEndSubmissionEvents(args: {
  teamId: string;
  provider: "hmrc-ct" | "companies-house";
  obligationType: "corporation_tax" | "accounts";
  periodKey?: string;
}) {
  const events = await listSubmissionEventsFromConvex({
    teamId: args.teamId,
    provider: args.provider,
    obligationType: args.obligationType,
  });

  return args.periodKey
    ? events.filter(
        (event) =>
          getSubmissionEventRequestPeriodKey(event) === args.periodKey,
      )
    : events;
}

export function requireReadyYearEndPack(pack: YearEndPackRecord | null) {
  if (!pack) {
    throw new Error("Build the current year-end pack before submission");
  }

  if (pack.status === "draft") {
    throw new Error(
      "The current year-end pack is still draft. Rebuild and resolve any imbalance before CT submission.",
    );
  }

  return pack;
}
