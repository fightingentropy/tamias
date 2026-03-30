import "server-only";

import {
  type GetTrackerProjectsParams,
  getTrackerProjects,
} from "@tamias/app-data/queries/tracker-projects";
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

    return getTrackerProjects(requestDb, {
      teamId: session.teamId,
      ...input,
    });
  },
);
