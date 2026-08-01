import {
  downloadR2VaultFile,
  getR2VaultSignedUrl,
  registerUploadedR2VaultFile,
  removeR2VaultFile,
  uploadR2VaultFile,
} from "./r2-storage";
import {
  configureStorageRuntime,
  getStorageRuntime,
  type CloudflareR2BucketBinding,
  type CloudflareD1DatabaseBinding,
  type StorageRuntimeConfig,
} from "./runtime";

export { configureStorageRuntime, getStorageRuntime, registerUploadedR2VaultFile };
export type { CloudflareD1DatabaseBinding, CloudflareR2BucketBinding, StorageRuntimeConfig };

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

export async function getVaultSignedUrl(params: {
  path: string | string[];
  expireIn: number;
  options?: SignedUrlOptions;
}) {
  return getR2VaultSignedUrl(params);
}

export async function downloadVaultFile(path: string | string[]) {
  return downloadR2VaultFile(path);
}

export async function removeVaultFile(path: string | string[]) {
  return removeR2VaultFile(path);
}

export async function uploadVaultFile(args: UploadVaultFileArgs) {
  return uploadR2VaultFile(args);
}
