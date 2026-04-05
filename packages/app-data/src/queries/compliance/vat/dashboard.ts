import { isUkComplianceVisible } from "@tamias/compliance";
import type { Database } from "../../../client";
import { reuseQueryResult } from "../../../utils/request-cache";
import { getFilingProfile, getHmrcVatApp, getTeamContext } from "../shared";
import { getVatDraft } from "./draft";
import { listVatObligations } from "./obligations";
import { listVatSubmissions } from "./submissions";

async function getVatDashboardImpl(db: Database, params: { teamId: string }) {
  const team = await getTeamContext(db, params.teamId);
  const profile = await getFilingProfile(db, params.teamId);
  const app = await getHmrcVatApp(db, params.teamId);
  const obligations = profile
    ? await listVatObligations(db, { teamId: params.teamId })
    : [];
  const latestDraft = await getVatDraft(db, { teamId: params.teamId });
  const submissions = await listVatSubmissions(db, params);
  const latestSubmission =
    submissions.find((submission) => submission.submittedAt) ?? null;

  return {
    enabled: isUkComplianceVisible({
      countryCode: team.countryCode,
      profileEnabled: profile?.enabled,
    }),
    team,
    profile,
    connected: Boolean(app?.config),
    obligations,
    latestDraft,
    latestSubmission,
  };
}

export const getVatDashboard = reuseQueryResult({
  keyPrefix: "vat-dashboard",
  keyFn: (params: { teamId: string }) => params.teamId,
  load: getVatDashboardImpl,
});
