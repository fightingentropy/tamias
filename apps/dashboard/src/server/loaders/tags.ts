
import { getTags } from "@tamias/app-data/queries/tags";
import { cache } from "react";
import { getCurrentSession, getRequestDb } from "./context";

export const getCurrentTeamTagsLocally = cache(async () => {
  const [session, requestDb] = await Promise.all([
    getCurrentSession(),
    getRequestDb(),
  ]);

  if (!session?.teamId) {
    return [];
  }

  return getTags(requestDb, {
    teamId: session.teamId,
  });
});
