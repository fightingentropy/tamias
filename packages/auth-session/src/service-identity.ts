import { decodeJwt, decodeProtectedHeader, jwtVerify, SignJWT } from "jose";

export const SERVICE_AUTH_HEADER = "x-tamias-service-authorization";
export const SERVICE_TOKEN_AUDIENCE = "api";

const serviceScopes = {
  dashboard: ["dashboard.session"],
  worker: ["banking.read", "banking.write", "jobs.dispatch"],
  documents: ["documents.process", "jobs.dispatch"],
} as const;

export type ServiceId = keyof typeof serviceScopes;
export type ServiceIdentity = {
  id: ServiceId;
  audience: string;
  keyId: string;
  scopes: string[];
  tokenId: string;
};

export type ServiceSigningCredential = {
  keyId: string;
  secret: string;
};

export type ServiceVerificationCredential = ServiceSigningCredential & {
  previous?: ServiceSigningCredential | null;
};

function encodeSecret(secret: string) {
  if (secret.length < 32) {
    throw new Error("Service identity keys must contain at least 32 characters");
  }

  return new TextEncoder().encode(secret);
}

function isServiceId(value: unknown): value is ServiceId {
  return typeof value === "string" && value in serviceScopes;
}

export async function createServiceIdentityToken(args: {
  serviceId: ServiceId;
  audience: string;
  credential: ServiceSigningCredential;
  now?: number;
}) {
  const issuedAt = args.now ?? Math.floor(Date.now() / 1000);

  return new SignJWT({ scopes: [...serviceScopes[args.serviceId]] })
    .setProtectedHeader({ alg: "HS256", kid: args.credential.keyId, typ: "JWT" })
    .setIssuer(`tamias-service:${args.serviceId}`)
    .setSubject(args.serviceId)
    .setAudience(args.audience)
    .setJti(crypto.randomUUID())
    .setIssuedAt(issuedAt)
    .setNotBefore(issuedAt - 5)
    .setExpirationTime(issuedAt + 60)
    .sign(encodeSecret(args.credential.secret));
}

export async function verifyServiceIdentityToken(args: {
  token: string;
  audience: string;
  credentials: Partial<Record<ServiceId, ServiceVerificationCredential>>;
  now?: number;
}): Promise<ServiceIdentity | null> {
  try {
    const untrustedPayload = decodeJwt(args.token);
    const untrustedHeader = decodeProtectedHeader(args.token);
    const serviceId = untrustedPayload.sub;

    if (!isServiceId(serviceId) || typeof untrustedHeader.kid !== "string") {
      return null;
    }

    const configured = args.credentials[serviceId];
    if (!configured) {
      return null;
    }

    const selected =
      configured.keyId === untrustedHeader.kid
        ? configured
        : configured.previous?.keyId === untrustedHeader.kid
          ? configured.previous
          : null;
    if (!selected) {
      return null;
    }

    const { payload, protectedHeader } = await jwtVerify(
      args.token,
      encodeSecret(selected.secret),
      {
        algorithms: ["HS256"],
        audience: args.audience,
        issuer: `tamias-service:${serviceId}`,
        subject: serviceId,
        clockTolerance: 5,
        currentDate: args.now === undefined ? undefined : new Date(args.now * 1000),
        maxTokenAge: "65s",
      },
    );
    const scopes = Array.isArray(payload.scopes)
      ? payload.scopes.filter((value): value is string => typeof value === "string")
      : [];
    const allowedScopes = new Set<string>(serviceScopes[serviceId]);

    if (
      protectedHeader.kid !== selected.keyId ||
      typeof payload.jti !== "string" ||
      scopes.length === 0 ||
      scopes.some((scope) => !allowedScopes.has(scope))
    ) {
      return null;
    }

    return {
      id: serviceId,
      audience: args.audience,
      keyId: selected.keyId,
      scopes,
      tokenId: payload.jti,
    };
  } catch {
    return null;
  }
}

function optionalPreviousCredential(prefix: string): ServiceSigningCredential | null {
  const keyId = process.env[`${prefix}_PREVIOUS_KEY_ID`];
  const secret = process.env[`${prefix}_PREVIOUS_KEY`];

  return keyId && secret ? { keyId, secret } : null;
}

export function getServiceVerificationCredentialsFromEnvironment() {
  return Object.fromEntries(
    (Object.keys(serviceScopes) as ServiceId[]).flatMap((serviceId) => {
      const prefix = `TAMIAS_SERVICE_${serviceId.toUpperCase()}`;
      const keyId = process.env[`${prefix}_KEY_ID`];
      const secret = process.env[`${prefix}_KEY`];

      return keyId && secret
        ? [
            [
              serviceId,
              {
                keyId,
                secret,
                previous: optionalPreviousCredential(prefix),
              },
            ],
          ]
        : [];
    }),
  ) as Partial<Record<ServiceId, ServiceVerificationCredential>>;
}

export async function createServiceIdentityTokenFromEnvironment(audience = SERVICE_TOKEN_AUDIENCE) {
  const serviceId = process.env.TAMIAS_SERVICE_ID;
  const keyId = process.env.TAMIAS_SERVICE_KEY_ID;
  const secret = process.env.TAMIAS_SERVICE_KEY;

  if (!isServiceId(serviceId) || !keyId || !secret) {
    throw new Error(
      "TAMIAS_SERVICE_ID, TAMIAS_SERVICE_KEY_ID, and TAMIAS_SERVICE_KEY are required",
    );
  }

  return createServiceIdentityToken({
    serviceId,
    audience,
    credential: { keyId, secret },
  });
}

export async function verifyServiceIdentityTokenFromEnvironment(
  token: string,
  audience = SERVICE_TOKEN_AUDIENCE,
) {
  return verifyServiceIdentityToken({
    token,
    audience,
    credentials: getServiceVerificationCredentialsFromEnvironment(),
  });
}
