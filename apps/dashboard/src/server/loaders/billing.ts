import "server-only";

import {
  getActiveSubscriptionForTeam,
  getBillingOrdersPageForTeam,
} from "@tamias/app-services/billing";
import { cache } from "react";
import { getCurrentSession } from "./context";

export const getBillingOrdersLocally = cache(
  async (cursor?: string, pageSize = 25) => {
    const session = await getCurrentSession();

    if (!session?.teamId) {
      return {
        data: [],
        meta: {
          hasNextPage: false,
          cursor: undefined,
        },
      };
    }

    return getBillingOrdersPageForTeam({
      teamId: session.teamId,
      cursor,
      pageSize,
    });
  },
);

export const getActiveSubscriptionLocally = cache(async () => {
  const session = await getCurrentSession();

  if (!session?.teamId) {
    return null;
  }

  return getActiveSubscriptionForTeam(session.teamId);
});
