import type { CloudflareR2BucketBinding } from "@tamias/storage";
import { jwtVerify, SignJWT } from "jose";

type R2UploadEnv = {
  VAULT_BUCKET?: CloudflareR2BucketBinding;
  API_URL?: string;
};

const uploadTokenAudience = "tamias:r2-upload";
const uploadTokenExpiration = "15m";

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

async function verifyR2UploadToken(token: string) {
  const { payload } = await jwtVerify(token, getUploadTokenSecret(), {
    audience: uploadTokenAudience,
  });

  if (typeof payload.storageId !== "string" || !payload.storageId.startsWith("tmp/uploads/")) {
    throw new Error("Invalid upload token");
  }

  return payload.storageId;
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

  let storageId: string;

  try {
    storageId = await verifyR2UploadToken(token);
  } catch {
    return Response.json({ error: "Invalid upload token" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? undefined;
  const body = request.body ?? (await request.arrayBuffer());
  await bucket.put(storageId, body, {
    httpMetadata: contentType ? { contentType } : undefined,
  });

  return Response.json({ storageId });
}
