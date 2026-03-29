import type { Database } from "@tamias/app-data/client";
import { getTags } from "@tamias/app-data/queries/tags";

export async function getTagsForTeam(args: { db: Database; teamId: string }) {
  return getTags(args.db, {
    teamId: args.teamId,
  });
}
