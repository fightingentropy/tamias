import type { Database } from "../client";
import {
  getSuggestedActionUsageD1,
  getSuggestedActionUsageFromD1,
  incrementSuggestedActionUsageInD1,
} from "./suggested-actions/d1";

export type SuggestedActionUsage = {
  actionId: string;
  count: number;
  lastUsed: string;
};

export type SuggestedActionUsageMap = Readonly<Record<string, SuggestedActionUsage | undefined>>;

export type SuggestedActionUsageParams = {
  userId: string;
  teamId: string;
};

function requireSuggestedActionUsageD1(db: Database) {
  const d1 = getSuggestedActionUsageD1(db);

  if (!d1) {
    throw new Error("Suggested action usage requires Cloudflare D1");
  }

  return d1;
}

export async function getSuggestedActionUsage(
  db: Database,
  params: SuggestedActionUsageParams,
): Promise<SuggestedActionUsageMap> {
  return getSuggestedActionUsageFromD1(requireSuggestedActionUsageD1(db), params);
}

export async function incrementSuggestedActionUsage(
  db: Database,
  params: SuggestedActionUsageParams & { actionId: string },
) {
  await incrementSuggestedActionUsageInD1(requireSuggestedActionUsageD1(db), params);

  return { success: true };
}
