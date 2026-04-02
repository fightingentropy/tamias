import {
  DASHBOARD_AUTH_HEADER,
  serializeTrustedSessionHeaderValue,
  TRUSTED_SESSION_HEADER,
} from "@tamias/auth-session";
import { resolveTamiasUserSession } from "@tamias/app-services/auth";
import { getLocationHeaders } from "@tamias/location";
import { headers } from "@tamias/utils/request-runtime";
import { cache } from "react";
import { measureAuthResolution } from "@/server/perf";
import { getConvexAuthToken } from "@/start/auth/server";
import { getRequestTraceHeaders } from "@/utils/request-trace";

export const getServerRequestContext = cache(async () => {
  const [token, headersList] = await Promise.all([
    getConvexAuthToken(),
    headers(),
  ]);
  const session = await measureAuthResolution("resolve-session", () =>
    resolveTamiasUserSession(token ?? undefined),
  );

  return {
    token,
    session,
    getTrustedSessionHeaderValue() {
      return serializeTrustedSessionHeaderValue(session);
    },
    location: getLocationHeaders(headersList),
    traceHeaders: getRequestTraceHeaders(headersList),
  };
});

export function buildTRPCRequestHeaders(opts: {
  token?: string | null;
  trustedSession?: string | null;
  location: ReturnType<typeof getLocationHeaders>;
  traceHeaders: ReturnType<typeof getRequestTraceHeaders>;
}) {
  const requestHeaders: Record<string, string> = {
    "x-user-timezone": opts.location.timezone,
    "x-user-locale": opts.location.locale,
    "x-user-country": opts.location.country,
    "x-request-id": opts.traceHeaders.requestId,
  };

  if (opts.token) {
    requestHeaders.Authorization = `Bearer ${opts.token}`;
  }

  if (opts.trustedSession && process.env.INTERNAL_API_KEY) {
    requestHeaders[DASHBOARD_AUTH_HEADER] = process.env.INTERNAL_API_KEY;
    requestHeaders[TRUSTED_SESSION_HEADER] = opts.trustedSession;
  }

  if (opts.traceHeaders.cfRay) {
    requestHeaders["cf-ray"] = opts.traceHeaders.cfRay;
  }

  return requestHeaders;
}
