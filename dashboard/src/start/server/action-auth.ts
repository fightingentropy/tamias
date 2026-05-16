import { setupAnalytics } from "@/lib/telemetry/server";
import { getAuthToken } from "@/start/auth/server";

type ActionTrackMetadata = {
  event: string;
  channel: string;
};

export async function requireAuthenticatedActionUser() {
  const token = await getAuthToken();

  if (!token) {
    throw unauthorizedResponse();
  }

  return { token };
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
