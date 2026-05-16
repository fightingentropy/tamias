import { generateFileKey } from "@tamias/encryption";
import { getStorageRuntime, type CloudflareR2BucketBinding } from "./runtime";
import { deleteVaultFileIndex, upsertVaultFileIndex } from "./vault-files-d1";

type SignedUrlOptions = {
  download?: boolean;
};

type UploadVaultFileArgs = {
  path: string | string[];
  blob: Blob | ArrayBuffer | Uint8Array;
  contentType?: string | null;
  size?: number | null;
  upsert?: boolean;
};

function normalizePath(path: string | string[]) {
  return Array.isArray(path) ? path : path.split("/").filter(Boolean);
}

function toStorageError(error: unknown, fallbackMessage: string) {
  if (error instanceof Error) {
    return error;
  }

  return new Error(fallbackMessage);
}

function toBlob(value: Blob | ArrayBuffer | Uint8Array, contentType?: string | null) {
  if (value instanceof Blob) {
    return value;
  }

  if (value instanceof Uint8Array) {
    const buffer = new Uint8Array(value.byteLength);
    buffer.set(value);

    return new Blob([buffer.buffer], {
      type: contentType ?? undefined,
    });
  }

  return new Blob([new Uint8Array(value)], {
    type: contentType ?? undefined,
  });
}

function getBucket(): CloudflareR2BucketBinding {
  const bucket = getStorageRuntime().r2Bucket;

  if (!bucket) {
    throw new Error("Cloudflare R2 vault bucket binding is not configured");
  }

  return bucket;
}

function getApiUrl() {
  return getStorageRuntime().apiUrl ?? process.env.API_URL;
}

function encodePathForPublicUrl(pathTokens: string[]) {
  return pathTokens.map((token) => encodeURIComponent(token)).join("/");
}

async function getProxyUrl(pathTokens: string[]) {
  const teamId = pathTokens[0];
  const apiUrl = getApiUrl();

  if (!teamId || !apiUrl) {
    return null;
  }

  const fileKey = await generateFileKey(teamId);
  const url = new URL("/files/proxy", apiUrl);
  url.searchParams.set("filePath", pathTokens.join("/"));
  url.searchParams.set("fk", fileKey);

  return url.toString();
}

export async function getR2VaultSignedUrl(params: {
  path: string | string[];
  expireIn: number;
  options?: SignedUrlOptions;
}) {
  try {
    const pathTokens = normalizePath(params.path);
    const key = pathTokens.join("/");
    const bucket = getBucket();
    const object = bucket.head ? await bucket.head(key) : await bucket.get(key);

    if (!object) {
      return {
        data: null,
        error: new Error(`R2 vault file not found: ${key}`),
      };
    }

    await upsertVaultFileIndex({
      pathTokens,
      storageProvider: "r2",
      storageId: key,
      teamId: pathTokens[0],
      bucket: "vault",
      contentType: object.httpMetadata?.contentType,
      size: object.size,
    });

    const publicUrlBase = getStorageRuntime().publicUrlBase?.replace(/\/$/, "");
    const signedUrl = publicUrlBase
      ? `${publicUrlBase}/${encodePathForPublicUrl(pathTokens)}`
      : await getProxyUrl(pathTokens);

    if (!signedUrl) {
      return {
        data: null,
        error: new Error("R2 vault signed URL requires API_URL or TAMIAS_R2_PUBLIC_URL"),
      };
    }

    return {
      data: {
        signedUrl,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: toStorageError(error, "Failed to create R2 vault signed URL"),
    };
  }
}

export async function downloadR2VaultFile(path: string | string[]) {
  try {
    const pathTokens = normalizePath(path);
    const key = pathTokens.join("/");
    const object = await getBucket().get(key);

    if (!object) {
      return {
        data: null,
        error: new Error(`R2 vault file not found: ${key}`),
      };
    }

    await upsertVaultFileIndex({
      pathTokens,
      storageProvider: "r2",
      storageId: key,
      teamId: pathTokens[0],
      bucket: "vault",
      contentType: object.httpMetadata?.contentType,
      size: object.size,
    });

    const blob = new Blob([await object.arrayBuffer()], {
      type: object.httpMetadata?.contentType,
    });

    return {
      data: blob,
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: toStorageError(error, "Failed to download R2 vault file"),
    };
  }
}

export async function removeR2VaultFile(path: string | string[]) {
  try {
    const pathTokens = normalizePath(path);
    const bucket = getBucket();
    const key = pathTokens.join("/");
    const existing = bucket.head ? await bucket.head(key) : await bucket.get(key);

    if (!existing) {
      await deleteVaultFileIndex(pathTokens);

      return {
        data: [{ name: key }],
        error: null,
      };
    }

    await bucket.delete(key);
    await deleteVaultFileIndex(pathTokens);

    return {
      data: [{ name: pathTokens.join("/") }],
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: toStorageError(error, "Failed to delete R2 vault file"),
    };
  }
}

export async function uploadR2VaultFile({ path, blob, contentType }: UploadVaultFileArgs) {
  try {
    const pathTokens = normalizePath(path);
    const key = pathTokens.join("/");
    const normalizedBlob = toBlob(blob, contentType);
    const resolvedContentType = (contentType ?? normalizedBlob.type) || undefined;

    await getBucket().put(key, normalizedBlob, {
      httpMetadata: resolvedContentType ? { contentType: resolvedContentType } : undefined,
    });

    await upsertVaultFileIndex({
      pathTokens,
      storageProvider: "r2",
      storageId: key,
      teamId: pathTokens[0],
      bucket: "vault",
      contentType: resolvedContentType,
      size: normalizedBlob.size,
    });

    const signedUrl = await getR2VaultSignedUrl({
      path: pathTokens,
      expireIn: 60 * 60,
    });

    return {
      data: {
        path: key,
        fullPath: key,
        id: key,
        url: signedUrl.data?.signedUrl ?? null,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: toStorageError(error, "Failed to upload R2 vault file"),
    };
  }
}

export async function registerUploadedR2VaultFile(args: {
  pathTokens: string[];
  storageId: string;
  contentType?: string | null;
  size?: number | null;
}) {
  try {
    const bucket = getBucket();
    const pathTokens = args.pathTokens;
    const finalKey = pathTokens.join("/");
    const object = await bucket.get(args.storageId);

    if (!object) {
      return {
        data: null,
        error: new Error(`R2 temporary upload not found: ${args.storageId}`),
      };
    }

    const contentType = args.contentType ?? object.httpMetadata?.contentType ?? undefined;
    await bucket.put(finalKey, await object.arrayBuffer(), {
      httpMetadata: contentType ? { contentType } : undefined,
    });

    if (args.storageId !== finalKey) {
      await bucket.delete(args.storageId);
    }

    await upsertVaultFileIndex({
      pathTokens,
      storageProvider: "r2",
      storageId: finalKey,
      teamId: pathTokens[0],
      bucket: "vault",
      contentType,
      size: args.size ?? object.size,
    });

    const signedUrl = await getR2VaultSignedUrl({
      path: pathTokens,
      expireIn: 60 * 60,
    });

    return {
      data: {
        path: finalKey,
        storageId: finalKey,
        url: signedUrl.data?.signedUrl ?? null,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: toStorageError(error, "Failed to register R2 vault upload"),
    };
  }
}
