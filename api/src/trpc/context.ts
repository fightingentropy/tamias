import type { Database } from "@tamias/app-data/client";
import { createDatabase } from "@tamias/app-data/client";
import { getRequestAuthDependencies } from "@tamias/app-services/auth";
import { resolveRequestAuth, type Session } from "@tamias/auth-session";

export type GeoContext = {
  country: string | null;
  city: string | null;
  region: string | null;
  continent: string | null;
  locale: string | null;
  timezone: string | null;
  ip: string | null;
};

export type TRPCContext = {
  session: Session | null;
  db: Database;
  geo: GeoContext;
  accessToken?: string;
  teamId?: string;
  isInternalRequest?: boolean;
  requestId: string;
  cfRay?: string;
  setResponseHeader?: (name: string, value: string) => void;
};

type HeaderSource = Headers | Record<string, string | undefined>;

function getHeader(headers: HeaderSource, name: string) {
  if (headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }

  const normalizedName = name.toLowerCase();

  for (const [headerName, value] of Object.entries(headers)) {
    if (headerName.toLowerCase() === normalizedName) {
      return value;
    }
  }

  return undefined;
}

function getRequestTrace(headers: HeaderSource) {
  const cfRay = getHeader(headers, "cf-ray") ?? undefined;
  const requestId =
    getHeader(headers, "x-request-id") ?? cfRay ?? crypto.randomUUID();

  return { requestId, cfRay };
}

function getGeoContext(headers: HeaderSource): GeoContext {
  return {
    country:
      getHeader(headers, "x-user-country")?.toUpperCase() ??
      getHeader(headers, "cf-ipcountry") ??
      null,
    city: getHeader(headers, "cf-ipcity") ?? null,
    region: getHeader(headers, "cf-region") ?? null,
    continent: getHeader(headers, "cf-ipcontinent") ?? null,
    locale: getHeader(headers, "x-user-locale") ?? null,
    timezone:
      getHeader(headers, "x-user-timezone") ??
      getHeader(headers, "cf-timezone") ??
      null,
    ip:
      getHeader(headers, "cf-connecting-ip") ??
      getHeader(headers, "x-forwarded-for") ??
      null,
  };
}

export async function createTRPCContextFromHeaders(
  headers: HeaderSource,
  options?: {
    setResponseHeader?: (name: string, value: string) => void;
  },
): Promise<TRPCContext> {
  const { requestId, cfRay } = getRequestTrace(headers);
  const auth = await resolveRequestAuth(headers, getRequestAuthDependencies());
  const authorizationHeader = getHeader(headers, "authorization");
  const accessToken = authorizationHeader?.startsWith("Bearer ")
    ? authorizationHeader.slice("Bearer ".length).trim()
    : undefined;

  return {
    session: auth.session,
    db: createDatabase(),
    geo: getGeoContext(headers),
    accessToken,
    teamId: auth.teamId,
    isInternalRequest: auth.isInternalRequest,
    requestId,
    cfRay,
    setResponseHeader: options?.setResponseHeader,
  };
}
