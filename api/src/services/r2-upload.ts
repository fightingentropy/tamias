import type { CloudflareR2BucketBinding } from "@tamias/storage";
import { jwtVerify, SignJWT } from "jose";

type R2UploadEnv = {
  VAULT_BUCKET?: CloudflareR2BucketBinding;
  API_URL?: string;
};

const uploadTokenAudience = "tamias:r2-upload";
const uploadTokenExpiration = "15m";
export const maxReceiptUploadBytes = 20 * 1024 * 1024;

export type ReceiptUploadClaims = {
  teamId: string;
  storageId: string;
  fileName: string;
  contentType: string;
  size: number;
};

function getUploadTokenSecret() {
  const secret = process.env.FILE_KEY_SECRET;

  if (!secret) {
    throw new Error("FILE_KEY_SECRET is required for R2 upload URLs");
  }

  return new TextEncoder().encode(secret);
}

export async function createR2UploadUrl(apiUrl?: string) {
  const resolvedApiUrl = apiUrl ?? process.env.API_URL;

  if (!resolvedApiUrl) {
    throw new Error("API_URL is required for R2 upload URLs");
  }

  const storageId = `tmp/uploads/${crypto.randomUUID()}`;
  const token = await new SignJWT({ storageId })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(uploadTokenAudience)
    .setExpirationTime(uploadTokenExpiration)
    .sign(getUploadTokenSecret());
  const url = new URL("/uploads/r2", resolvedApiUrl);
  url.searchParams.set("token", token);

  return url.toString();
}

export async function createReceiptUploadUrl(
  input: Omit<ReceiptUploadClaims, "storageId">,
  apiUrl?: string,
) {
  const resolvedApiUrl = apiUrl ?? process.env.API_URL;
  if (!resolvedApiUrl) throw new Error("API_URL is required for R2 upload URLs");
  const storageId = `tmp/uploads/${crypto.randomUUID()}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const uploadToken = await new SignJWT({ ...input, storageId, purpose: "receipt" })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(uploadTokenAudience)
    .setExpirationTime(Math.floor(new Date(expiresAt).getTime() / 1000))
    .sign(getUploadTokenSecret());
  const url = new URL("/uploads/r2", resolvedApiUrl);
  url.searchParams.set("token", uploadToken);
  return { uploadUrl: url.toString(), uploadToken, storageId, expiresAt };
}

async function verifyR2UploadToken(token: string) {
  const { payload } = await jwtVerify(token, getUploadTokenSecret(), {
    audience: uploadTokenAudience,
  });

  if (typeof payload.storageId !== "string" || !payload.storageId.startsWith("tmp/uploads/")) {
    throw new Error("Invalid upload token");
  }

  return payload;
}

export async function verifyReceiptUploadToken(
  token: string,
  teamId: string,
): Promise<ReceiptUploadClaims> {
  const payload = await verifyR2UploadToken(token);
  if (
    payload.purpose !== "receipt" ||
    payload.teamId !== teamId ||
    typeof payload.storageId !== "string" ||
    typeof payload.fileName !== "string" ||
    typeof payload.contentType !== "string" ||
    typeof payload.size !== "number" ||
    !Number.isInteger(payload.size) ||
    payload.size < 1 ||
    payload.size > maxReceiptUploadBytes
  ) {
    throw new Error("Invalid receipt upload token");
  }
  return {
    teamId,
    storageId: payload.storageId,
    fileName: payload.fileName,
    contentType: payload.contentType,
    size: payload.size,
  };
}

async function readExactReceiptBody(request: Request, size: number) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing receipt body");
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > size) throw new Error("Receipt size does not match upload ticket");
      chunks.push(new Uint8Array(value));
    }
    if (received !== size) throw new Error("Receipt size does not match upload ticket");
    return new Blob(chunks);
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
}

export async function handleR2UploadRequest(request: Request, env: R2UploadEnv) {
  const bucket = env.VAULT_BUCKET;

  if (!bucket) {
    return Response.json({ error: "R2 vault bucket binding is not configured" }, { status: 500 });
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return Response.json({ error: "Missing upload token" }, { status: 401 });
  }

  let claims: Awaited<ReturnType<typeof verifyR2UploadToken>>;

  try {
    claims = await verifyR2UploadToken(token);
  } catch {
    return Response.json({ error: "Invalid upload token" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? undefined;
  const storageId = claims.storageId as string;
  let body: ReadableStream | ArrayBuffer | Blob = request.body ?? new ArrayBuffer(0);
  if (claims.purpose === "receipt") {
    if (
      typeof claims.size !== "number" ||
      claims.size < 1 ||
      claims.size > maxReceiptUploadBytes ||
      contentType !== claims.contentType
    ) {
      return Response.json(
        { error: "Receipt content type or size does not match upload ticket" },
        { status: 400 },
      );
    }
    try {
      body = await readExactReceiptBody(request, claims.size);
    } catch {
      return Response.json({ error: "Receipt size does not match upload ticket" }, { status: 400 });
    }
  }
  await bucket.put(storageId, body, {
    httpMetadata: contentType ? { contentType } : undefined,
  });

  return Response.json({ storageId });
}
