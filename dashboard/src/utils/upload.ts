"use client";

import { stripSpecialCharacters } from "@tamias/utils";

type UploadProgress = (bytesUploaded: number, bytesTotal: number) => void;
type StorageId = string;

type RegisterUploadResult = {
  storageId: StorageId;
  url: string | null;
};

type UploadMutationArgs = {
  internalKey?: string;
};

type RegisterUploadArgs = {
  pathTokens: string[];
  storageId: StorageId;
  teamId?: string;
  bucket?: string;
  contentType?: string;
  size?: number;
  internalKey?: string;
};

type UploadTransport = {
  generateUploadUrl: (args: UploadMutationArgs) => Promise<string>;
  registerUpload: (args: RegisterUploadArgs) => Promise<RegisterUploadResult>;
};

type UploadParams = {
  bucket: string;
  file: File;
  onProgress?: UploadProgress;
  path: string[];
};

export type UploadResult = {
  filename: string;
  file: File;
  path: string[];
  storageId: StorageId;
  url: string;
};

export function buildUploadedFilePath(path: string[], fileName: string) {
  return [...path, stripSpecialCharacters(fileName)];
}

function buildStoragePath(bucket: string, path: string[]) {
  return bucket === "vault" ? path : [bucket, ...path];
}

function uploadFileWithProgress(
  uploadUrl: string,
  file: File,
  onProgress?: UploadProgress,
): Promise<StorageId> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open("POST", uploadUrl);

    if (file.type) {
      request.setRequestHeader("Content-Type", file.type);
    }

    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) {
        return;
      }

      onProgress?.(event.loaded, event.total);
    });

    request.addEventListener("load", () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(`Upload failed with status ${request.status}`));
        return;
      }

      try {
        const response = JSON.parse(request.responseText) as {
          storageId?: string;
        };

        if (!response.storageId) {
          reject(new Error("Upload did not return a storageId"));
          return;
        }

        resolve(response.storageId);
      } catch (error) {
        reject(error instanceof Error ? error : new Error("Failed to parse upload response"));
      }
    });

    request.addEventListener("error", () => {
      reject(new Error("Upload request failed"));
    });

    request.send(file);
  });
}

export async function uploadFileToStorage(
  transport: UploadTransport,
  { bucket, file, onProgress, path }: UploadParams,
): Promise<UploadResult> {
  const filename = stripSpecialCharacters(file.name);
  const storagePath = buildStoragePath(bucket, path);
  const uploadUrl = await transport.generateUploadUrl({});
  const storageId = await uploadFileWithProgress(uploadUrl, file, onProgress);

  const result = await transport.registerUpload({
    pathTokens: storagePath,
    storageId,
    teamId: bucket === "vault" ? path[0] : undefined,
    bucket,
    contentType: file.type || undefined,
    size: file.size,
  });

  if (!result.url) {
    throw new Error("Uploaded file URL could not be created");
  }

  onProgress?.(file.size, file.size);

  return {
    filename,
    file,
    path: storagePath,
    storageId,
    url: result.url,
  };
}
