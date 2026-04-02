
import {
  type GetDocumentsParams,
  getDocuments,
} from "@tamias/app-data/queries/documents";
import { cache } from "react";
import { getCurrentSession, getRequestDb } from "./context";

export const getDocumentsLocally = cache(
  async (input: Omit<GetDocumentsParams, "teamId"> = {}) => {
    const [session, requestDb] = await Promise.all([
      getCurrentSession(),
      getRequestDb(),
    ]);

    if (!session?.teamId) {
      return {
        meta: {
          cursor: null,
          hasPreviousPage: false,
          hasNextPage: false,
        },
        data: [],
      };
    }

    return getDocuments(requestDb, {
      teamId: session.teamId,
      ...input,
    });
  },
);
