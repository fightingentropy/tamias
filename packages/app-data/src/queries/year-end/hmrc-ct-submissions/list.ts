import { listSubmissionEventsFromConvex } from "@tamias/app-data-convex";
import type { Database } from "../../../client";
import { getSubmissionEventRequestPeriodKey } from "../submission-common";

export async function listCtSubmissionEvents(
  db: Database,
  params: { teamId: string; periodKey?: string },
) {
  void db;

  const events = await listSubmissionEventsFromConvex({
    teamId: params.teamId,
    provider: "hmrc-ct",
    obligationType: "corporation_tax",
  });

  return params.periodKey
    ? events.filter((event) => getSubmissionEventRequestPeriodKey(event) === params.periodKey)
    : events;
}
