import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

type ConvexFileRecord = {
  storageId: string;
  contentType?: string | null;
  size?: number | null;
};

type RegisterUploadArgs = {
  pathTokens: string[];
  storageId: string;
  teamId?: string;
  bucket?: string;
  contentType?: string | null;
  size?: number | null;
  internalKey?: string;
};

type UploadBlobArgs = {
  pathTokens: string[];
  blob: Blob | ArrayBuffer | Uint8Array;
  teamId?: string;
  bucket?: string;
  contentType?: string | null;
  size?: number | null;
  internalKey?: string;
};

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

const generateUploadUrlRef = makeFunctionReference<"mutation", { internalKey?: string }, string>(
  "files:generateUploadUrl",
);

const registerUploadRef = makeFunctionReference<
  "mutation",
  RegisterUploadArgs,
  { path: string; storageId: string; url: string | null }
>("files:registerUpload");

const getByPathRef = makeFunctionReference<"query", { path: string }, ConvexFileRecord | null>(
  "files:getByPath",
);

const getUrlByPathRef = makeFunctionReference<"query", { path: string }, string | null>(
  "files:getUrlByPath",
);

const deleteByPathRef = makeFunctionReference<
  "mutation",
  { path: string; internalKey?: string },
  boolean
>("files:deleteByPath");

function getConvexUrl() {
  return (
    process.env.CONVEX_URL ||
    process.env.TAMIAS_CONVEX_URL ||
    process.env.CONVEX_SITE_URL
  )?.replace(/\/$/, "");
}

function getInternalKey() {
  return process.env.INTERNAL_API_KEY;
}

let client: ConvexHttpClient | null = null;

function getClient() {
  const url = getConvexUrl();

  if (!url) {
    throw new Error("CONVEX_URL not set");
  }

  if (!client || client.url !== url) {
    client = new ConvexHttpClient(url, { logger: false });
  }

  return client;
}

function pathToKey(pathTokens: string[]) {
  return pathTokens.join("/");
}

function normalizePath(path: string | string[]) {
  return Array.isArray(path) ? path : path.split("/").filter(Boolean);
}

function getPathKey(path: string | string[]) {
  return normalizePath(path).join("/");
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

async function uploadBlobToUrl({
  uploadUrl,
  blob,
  contentType,
}: {
  uploadUrl: string;
  blob: Blob;
  contentType?: string | null;
}) {
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: contentType ? { "Content-Type": contentType } : undefined,
    body: blob,
  });

  if (!response.ok) {
    throw new Error(`Convex upload failed with status ${response.status}`);
  }

  const data = (await response.json()) as { storageId?: string };

  if (!data.storageId) {
    throw new Error("Convex upload did not return a storageId");
  }

  return data.storageId;
}

async function fetchConvexBlob(convexUrl: string) {
  const response = await fetch(convexUrl);

  if (!response.ok) {
    return {
      data: null,
      error: new Error(`File download failed with status ${response.status}`),
    };
  }

  return {
    data: await response.blob(),
    error: null,
  };
}

export async function getConvexFileByPath(pathTokens: string[]) {
  const convex = getClient();

  return convex.query(getByPathRef, {
    path: pathToKey(pathTokens),
  });
}

export async function getConvexFileUrlByPath(pathTokens: string[]) {
  const convex = getClient();

  return convex.query(getUrlByPathRef, {
    path: pathToKey(pathTokens),
  });
}

export async function deleteConvexFileByPath(pathTokens: string[]) {
  const convex = getClient();

  return convex.mutation(deleteByPathRef, {
    path: pathToKey(pathTokens),
    internalKey: getInternalKey(),
  });
}

export async function registerConvexUpload(args: RegisterUploadArgs) {
  const convex = getClient();

  return convex.mutation(registerUploadRef, {
    ...args,
    internalKey: args.internalKey ?? getInternalKey(),
  });
}

export async function uploadBlobToConvexStorage({
  pathTokens,
  blob,
  teamId,
  bucket,
  contentType,
  size,
  internalKey,
}: UploadBlobArgs) {
  const convex = getClient();

  const uploadUrl = await convex.mutation(generateUploadUrlRef, {
    internalKey: internalKey ?? getInternalKey(),
  });

  const normalizedBlob = toBlob(blob, contentType);
  const storageId = await uploadBlobToUrl({
    uploadUrl,
    blob: normalizedBlob,
    contentType: contentType ?? normalizedBlob.type,
  });

  return registerConvexUpload({
    pathTokens,
    storageId,
    teamId,
    bucket,
    contentType: (contentType ?? normalizedBlob.type) || undefined,
    size: size ?? normalizedBlob.size,
    internalKey,
  });
}

export async function getVaultSignedUrl(params: {
  path: string | string[];
  expireIn: number;
  options?: SignedUrlOptions;
}) {
  try {
    const pathTokens = normalizePath(params.path);
    const convexUrl = await getConvexFileUrlByPath(pathTokens);

    if (!convexUrl) {
      return {
        data: null,
        error: new Error(`Convex storage file not found: ${getPathKey(params.path)}`),
      };
    }

    return {
      data: {
        signedUrl: convexUrl,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: toStorageError(error, "Failed to create Convex storage signed URL"),
    };
  }
}

export async function downloadVaultFile(path: string | string[]) {
  try {
    const pathTokens = normalizePath(path);
    const convexUrl = await getConvexFileUrlByPath(pathTokens);

    if (!convexUrl) {
      return {
        data: null,
        error: new Error(`Convex storage file not found: ${getPathKey(path)}`),
      };
    }

    return fetchConvexBlob(convexUrl);
  } catch (error) {
    return {
      data: null,
      error: toStorageError(error, "Failed to download Convex storage file"),
    };
  }
}

export async function removeVaultFile(path: string | string[]) {
  try {
    const pathTokens = normalizePath(path);
    await deleteConvexFileByPath(pathTokens);

    return {
      data: [{ name: pathTokens.join("/") }],
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: toStorageError(error, "Failed to delete Convex storage file"),
    };
  }
}

export async function uploadVaultFile({ path, blob, contentType, size }: UploadVaultFileArgs) {
  try {
    const pathTokens = normalizePath(path);
    const registered = await uploadBlobToConvexStorage({
      pathTokens,
      blob,
      teamId: pathTokens[0],
      bucket: "vault",
      contentType,
      size,
    });

    return {
      data: {
        path: pathTokens.join("/"),
        fullPath: pathTokens.join("/"),
        id: registered.storageId,
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: toStorageError(error, "Failed to upload Convex storage file"),
    };
  }
}
