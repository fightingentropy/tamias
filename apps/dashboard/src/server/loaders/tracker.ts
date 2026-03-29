import "server-only";

import { getTrackerProjectsPage } from "@tamias/app-services/tracker";
import type { GetTrackerProjectsParams } from "@tamias/app-data/queries/tracker-projects";
import { cache } from "react";
import { getCurrentSession, getRequestDb } from "./context";

export const getTrackerProjectsLocally = cache(
  async (input: Omit<GetTrackerProjectsParams, "teamId"> = {}) => {
    const [session, requestDb] = await Promise.all([
      getCurrentSession(),
      getRequestDb(),
    ]);

    if (!session?.teamId) {
      return {
        meta: {
          cursor: undefined,
          hasPreviousPage: false,
          hasNextPage: false,
        },
        data: [],
      };
    }

    return getTrackerProjectsPage({
      db: requestDb,
      teamId: session.teamId,
      input,
    });
  },
);
