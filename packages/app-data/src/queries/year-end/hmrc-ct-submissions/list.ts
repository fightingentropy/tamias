import type { Database } from "../../../client";
import { listSubmissionEvents } from "../../filing-events";
import { getSubmissionEventRequestPeriodKey } from "../submission-common";

export async function listCtSubmissionEvents(
  db: Database,
  params: { teamId: string; periodKey?: string },
) {
  const events = await listSubmissionEvents(db, {
    teamId: params.teamId,
    provider: "hmrc-ct",
    obligationType: "corporation_tax",
  });

  return params.periodKey
    ? events.filter((event) => getSubmissionEventRequestPeriodKey(event) === params.periodKey)
    : events;
}
