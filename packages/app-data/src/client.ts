declare const queryContextBrand: unique symbol;

const queryCacheSymbol = Symbol("tamias.query-cache");

type QueryCacheStore = Map<string, Promise<unknown>>;

export type Database = {
  readonly [queryContextBrand]: true;
  readonly [queryCacheSymbol]?: QueryCacheStore;
};

export type TransactionClient = Database;
export type DatabaseOrTransaction = Database;
export type QueryClient = Database;

export function createDatabase(): Database {
  return {
    [queryCacheSymbol]: new Map(),
  } as Database;
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
