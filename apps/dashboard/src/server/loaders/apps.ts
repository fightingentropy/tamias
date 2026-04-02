
import { getOAuthApplicationInfo } from "@tamias/app-services/oauth-application-info";
import {
  getApiKeysByTeamFromConvex,
  getOAuthApplicationsByTeamFromConvex,
  getUserAuthorizedApplicationsFromConvex,
} from "@tamias/app-services/foundation";
import { getTeamByPublicTeamIdFromConvexIdentity } from "@tamias/app-services/identity";
import { getApps } from "@tamias/app-data/queries";
import { cache } from "react";
import { measureServerRead } from "@/server/perf";
import { getCurrentSession, getRequestDb } from "./context";
import type {
  LocalApiKeys,
  LocalAuthorizedOAuthApplications,
  LocalInstalledApps,
  LocalOAuthApplicationInfo,
  LocalOAuthApplications,
  LocalStripeStatus,
} from "./types";

export const getInstalledAppsLocally = cache(
  async (): Promise<LocalInstalledApps> => {
    const [session, requestDb] = await Promise.all([
      getCurrentSession(),
      getRequestDb(),
    ]);

    if (!session?.teamId) {
      return [];
    }

    return getApps(requestDb, session.teamId);
  },
);

export const getApiKeysLocally = cache(async (): Promise<LocalApiKeys> => {
  const session = await getCurrentSession();

  if (!session?.teamId) {
    return [];
  }

  return getApiKeysByTeamFromConvex(session.teamId);
});

export const getOAuthApplicationsLocally = cache(
  async (): Promise<LocalOAuthApplications> => {
    const session = await getCurrentSession();

    if (!session?.teamId) {
      return { data: [] };
    }

    const applications = await getOAuthApplicationsByTeamFromConvex(
      session.teamId,
    );

    return {
      data: applications,
    };
  },
);

export const getAuthorizedOAuthApplicationsLocally = cache(
  async (): Promise<LocalAuthorizedOAuthApplications> => {
    const session = await getCurrentSession();

    if (!session?.teamId || !session.user.convexId) {
      return { data: [] };
    }

    const applications = await getUserAuthorizedApplicationsFromConvex({
      userId: session.user.convexId,
      publicTeamId: session.teamId,
    });

    return {
      data: applications,
    };
  },
);

export const getStripeStatusLocally = cache(
  async (): Promise<LocalStripeStatus> => {
    const session = await getCurrentSession();

    if (!session?.teamId) {
      return {
        connected: false,
        status: null,
        stripeAccountId: null,
      };
    }

    const team = await getTeamByPublicTeamIdFromConvexIdentity(session.teamId);

    return {
      connected: !!team?.stripeAccountId,
      status: team?.stripeConnectStatus || null,
      stripeAccountId: team?.stripeAccountId || null,
    };
  },
);

export const getOAuthApplicationInfoLocally = cache(
  async (
    input: Parameters<typeof getOAuthApplicationInfo>[0],
  ): Promise<LocalOAuthApplicationInfo> => {
    return measureServerRead("getOAuthApplicationInfoLocally", () =>
      getOAuthApplicationInfo(input),
    );
  },
);
