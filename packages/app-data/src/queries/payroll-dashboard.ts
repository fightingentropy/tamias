import { listPayrollRunsFromConvex } from "@tamias/app-data-convex";
import type { Database } from "../client";
import { reuseQueryResult } from "../utils/request-cache";
import { getFilingProfile } from "./compliance";
import {
  buildEmptyPayrollDashboard,
  buildLiabilitySummary,
  getPayrollContext,
  getTeamContext,
} from "./payroll-shared";

async function getPayrollDashboardImpl(
  db: Database,
  params: { teamId: string },
) {
  const team = await getTeamContext(db, params.teamId);
  const profile = await getFilingProfile(db, params.teamId);

  if (!profile) {
    return buildEmptyPayrollDashboard({
      team,
      profile,
    });
  }

  const context = await getPayrollContext(db, params.teamId);
  const runs = await listPayrollRunsFromConvex({
    teamId: params.teamId,
  });

  return {
    enabled: true,
    team: context.team,
    profile: context.profile,
    summary: buildLiabilitySummary(
      runs,
      context.profile.baseCurrency ?? context.team.baseCurrency ?? "GBP",
    ),
    latestRun: runs[0] ?? null,
  };
}

export const getPayrollDashboard = reuseQueryResult({
  keyPrefix: "payroll-dashboard",
  keyFn: (params: { teamId: string }) => params.teamId,
  load: getPayrollDashboardImpl,
});

export async function listPayrollRuns(
  db: Database,
  params: { teamId: string },
) {
  void db;

  return listPayrollRunsFromConvex({
    teamId: params.teamId,
  });
}
