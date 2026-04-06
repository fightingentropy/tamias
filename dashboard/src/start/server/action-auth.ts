import { setupAnalytics } from "@/lib/telemetry/server";
import { canResolveConvexSessionLocally } from "@/start/auth/runtime";
import { getConvexAuthToken } from "@/start/auth/server";
import {
  getCurrentUserFromConvex,
  resolveConvexUserSession,
} from "@tamias/auth-session/convex";

type ActionTrackMetadata = {
  event: string;
  channel: string;
};

export async function requireAuthenticatedActionUser() {
  const token = await getConvexAuthToken();

  if (!token) {
    throw unauthorizedResponse();
  }

  if (!canResolveConvexSessionLocally()) {
    return { token };
  }

  const session = await resolveConvexUserSession(token);

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
