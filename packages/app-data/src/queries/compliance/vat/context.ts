import type { FilingProfileRecord } from "../../../convex";
import type { Database } from "../../../client";
import {
  assertUkComplianceEnabled,
  getFilingProfile,
  getTeamContext,
} from "../shared";

export type VatTeamContext = Awaited<ReturnType<typeof getTeamContext>>;

export type VatTeamAndProfileContext = {
  team: VatTeamContext;
  profile: FilingProfileRecord | null;
};

export type RequiredVatContext = {
  team: VatTeamContext;
  profile: FilingProfileRecord;
};

export async function getVatTeamAndProfile(
  db: Database,
  teamId: string,
): Promise<VatTeamAndProfileContext> {
  const [team, profile] = await Promise.all([
    getTeamContext(db, teamId),
    getFilingProfile(db, teamId),
  ]);

  return { team, profile };
}

export async function getRequiredVatContext(
  db: Database,
  teamId: string,
): Promise<RequiredVatContext> {
  const { team, profile } = await getVatTeamAndProfile(db, teamId);

  if (!profile) {
    throw new Error("Filing profile not configured");
  }

  assertUkComplianceEnabled(team, profile);

  return { team, profile };
}
