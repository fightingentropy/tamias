type CacheEntry<T> = {
  value: T;
  expiresAt: number | null;
};

export class LocalCache<T> {
  readonly #entries = new Map<string, CacheEntry<T>>();

  constructor(private readonly defaultTtlSeconds: number = 0) {}

  get(key: string): T | undefined {
    const entry = this.#entries.get(key);

    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.#entries.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: T, ttlSeconds: number = this.defaultTtlSeconds) {
    const expiresAt = ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;

    this.#entries.set(key, {
      value,
      expiresAt,
    });
  }

  delete(key: string) {
    this.#entries.delete(key);
  }
}
