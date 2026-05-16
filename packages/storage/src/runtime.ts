export type CloudflareR2ObjectBodyBinding = {
  readonly size?: number;
  readonly httpMetadata?: {
    readonly contentType?: string;
  };
  arrayBuffer(): Promise<ArrayBuffer>;
};

export type CloudflareR2ObjectMetadataBinding = {
  readonly size?: number;
  readonly httpMetadata?: {
    readonly contentType?: string;
  };
};

export type CloudflareR2BucketBinding = {
  head?(key: string): Promise<CloudflareR2ObjectMetadataBinding | null>;
  get(key: string): Promise<CloudflareR2ObjectBodyBinding | null>;
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob,
    options?: {
      httpMetadata?: {
        contentType?: string;
      };
    },
  ): Promise<unknown>;
  delete(key: string | string[]): Promise<void>;
};

export type CloudflareD1PreparedStatementBinding = {
  bind(...values: unknown[]): CloudflareD1PreparedStatementBinding;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results?: T[]; success?: boolean; error?: string; meta?: unknown }>;
  run<T = unknown>(): Promise<{ results?: T[]; success?: boolean; error?: string; meta?: unknown }>;
  raw<T = unknown[]>(): Promise<T[]>;
};

export type CloudflareD1DatabaseBinding = {
  prepare(query: string): CloudflareD1PreparedStatementBinding;
  batch<T = unknown>(
    statements: CloudflareD1PreparedStatementBinding[],
  ): Promise<Array<{ results?: T[]; success?: boolean; error?: string; meta?: unknown }>>;
  exec(query: string): Promise<{ count: number; duration: number }>;
};

export type StorageRuntimeConfig = {
  d1?: CloudflareD1DatabaseBinding;
  r2Bucket?: CloudflareR2BucketBinding;
  apiUrl?: string;
  publicUrlBase?: string;
};

let runtimeConfig: StorageRuntimeConfig = {};

export function configureStorageRuntime(config: StorageRuntimeConfig | null | undefined) {
  runtimeConfig = config ?? {};
}

export function getStorageRuntime(): StorageRuntimeConfig {
  return runtimeConfig;
}
