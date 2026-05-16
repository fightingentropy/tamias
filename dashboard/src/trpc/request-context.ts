import { getLocationHeaders } from "@tamias/location";
import { headers } from "@tamias/utils/request-runtime";
import { cache } from "react";
import { getAuthToken } from "@/start/auth/server";
import { getRequestTraceHeaders } from "@/utils/request-trace";

export const getServerRequestContext = cache(async () => {
  const [token, headersList] = await Promise.all([getAuthToken(), headers()]);

  return {
    token,
    getTrustedSessionHeaderValue() {
      return null;
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

  if (opts.traceHeaders.cfRay) {
    requestHeaders["cf-ray"] = opts.traceHeaders.cfRay;
  }

  return requestHeaders;
}
