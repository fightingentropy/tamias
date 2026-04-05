import type { Database } from "../../../client";
import { getYearEndContext, rebuildYearEndPack } from "../pack";

export async function getYearEndMutationContext(
  db: Database,
  teamId: string,
  periodKey?: string,
) {
  return getYearEndContext(db, teamId, periodKey);
}

export function rebuildYearEndMutationPack(args: {
  db: Database;
  teamId: string;
  periodKey?: string;
}) {
  return rebuildYearEndPack(args.db, {
    teamId: args.teamId,
    periodKey: args.periodKey,
  });
}
