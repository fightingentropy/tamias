declare const queryContextBrand: unique symbol;

const queryCacheSymbol = Symbol("tamias.query-cache");
const cloudflareBindingsSymbol = Symbol("tamias.cloudflare-database-bindings");

type QueryCacheStore = Map<string, Promise<unknown>>;

export type CloudflareD1PreparedStatementBinding = {
  bind(...values: unknown[]): CloudflareD1PreparedStatementBinding;
  first<T = unknown>(columnName?: string): Promise<T | null>;
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

export type CloudflareDatabaseBindings = {
  d1?: CloudflareD1DatabaseBinding;
};

export type CreateDatabaseOptions = {
  cloudflare?: CloudflareDatabaseBindings;
};

export type Database = {
  readonly [queryContextBrand]: true;
  readonly [queryCacheSymbol]?: QueryCacheStore;
  readonly [cloudflareBindingsSymbol]?: CloudflareDatabaseBindings;
};

export type TransactionClient = Database;
export type DatabaseOrTransaction = Database;
export type QueryClient = Database;

let runtimeOptions: CreateDatabaseOptions = {};

export function configureDatabaseRuntime(options: CreateDatabaseOptions | null | undefined) {
  runtimeOptions = options ?? {};
}

export function createDatabase(options: CreateDatabaseOptions = {}): Database {
  const resolvedOptions: CreateDatabaseOptions = {
    ...runtimeOptions,
    ...options,
    cloudflare: {
      ...runtimeOptions.cloudflare,
      ...options.cloudflare,
    },
  };

  return {
    [queryCacheSymbol]: new Map(),
    [cloudflareBindingsSymbol]: resolvedOptions.cloudflare,
  } as Database;
}

export function getCloudflareDatabaseBindings(db: Database): CloudflareDatabaseBindings {
  return db[cloudflareBindingsSymbol] ?? {};
}

export function requireCloudflareD1Database(db: Database): CloudflareD1DatabaseBinding {
  const binding = getCloudflareDatabaseBindings(db).d1;

  if (!binding) {
    throw new Error("Cloudflare D1 database binding is not configured");
  }

  return binding;
}

export function createQueryCacheKey(namespace: string, input: unknown): string {
  return `${namespace}:${JSON.stringify(input)}`;
}

export async function getOrSetQueryCacheValue<T>(
  db: Database,
  key: string,
  load: () => Promise<T>,
): Promise<T> {
  const store = db[queryCacheSymbol];

  if (!store) {
    return load();
  }

  const existing = store.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const pending = load().catch((error) => {
    store.delete(key);
    throw error;
  });

  store.set(key, pending);
  return pending;
}

export const db = Object.freeze({}) as Database;
