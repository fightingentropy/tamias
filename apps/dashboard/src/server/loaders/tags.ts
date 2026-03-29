import "server-only";

import { getTagsForTeam } from "@tamias/app-services/tags";
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

  return getTagsForTeam({
    db: requestDb,
    teamId: session.teamId,
  });
});
