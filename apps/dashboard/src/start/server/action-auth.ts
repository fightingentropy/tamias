import { resolveTamiasUserSession } from "@tamias/app-services/auth";
import { getCurrentUserFromConvex } from "@tamias/app-services/identity";
import { setupAnalytics } from "@tamias/events/server";
import { configureDashboardAsyncWorkerRuntime } from "@/server/cloudflare-async-worker";
import { getConvexAuthToken } from "@/start/auth/server";

type ActionTrackMetadata = {
  event: string;
  channel: string;
};

export async function requireAuthenticatedActionUser() {
  await configureDashboardAsyncWorkerRuntime();

  const token = await getConvexAuthToken();
  const session = await resolveTamiasUserSession(token ?? undefined);

  if (!session) {
    throw unauthorizedResponse();
  }

  const user = await getCurrentUserFromConvex({
    userId: session.user.convexId,
    email: session.user.email ?? null,
  });

  if (!user) {
    throw unauthorizedResponse();
  }

  return {
    token,
    session,
    user,
    teamId: user.teamId,
  };
}

export async function trackAction(metadata?: ActionTrackMetadata) {
  if (!metadata) {
    return;
  }

  const analytics = await setupAnalytics();
  analytics.track(metadata);
}

function unauthorizedResponse() {
  return Response.json(
    {
      error: "Unauthorized",
    },
    {
      status: 401,
    },
  );
}
