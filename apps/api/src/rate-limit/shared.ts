export type RateLimitRequest = {
  key: string;
  limit: number;
  windowMs: number;
  nowMs?: number;
};

export type RateLimitOutcome = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterMs: number;
};

export type StoredRateLimitBucket = {
  limit: number;
  windowMs: number;
  timestamps: number[];
};

export function isRateLimitRequest(value: unknown): value is RateLimitRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.key === "string" &&
    typeof candidate.limit === "number" &&
    Number.isFinite(candidate.limit) &&
    candidate.limit > 0 &&
    typeof candidate.windowMs === "number" &&
    Number.isFinite(candidate.windowMs) &&
    candidate.windowMs > 0 &&
    (typeof candidate.nowMs === "number" ||
      typeof candidate.nowMs === "undefined")
  );
}

export function createRateLimitBucketName(name: string, key: string) {
  return `${name}:${key}`;
}

export function pruneStoredRateLimitBucket(
  bucket: StoredRateLimitBucket | null | undefined,
  nowMs: number,
) {
  if (!bucket) {
    return {
      bucket: null,
      alarmAt: null,
    };
  }

  const timestamps = bucket.timestamps.filter(
    (timestamp) => timestamp > nowMs - bucket.windowMs,
  );

  if (timestamps.length === 0) {
    return {
      bucket: null,
      alarmAt: null,
    };
  }

  return {
    bucket: {
      ...bucket,
      timestamps,
    },
    alarmAt: timestamps[0]! + bucket.windowMs,
  };
}

export function consumeRateLimit(
  existingBucket: StoredRateLimitBucket | null | undefined,
  request: RateLimitRequest,
) {
  const nowMs = request.nowMs ?? Date.now();
  const compatibleBucket =
    existingBucket &&
    existingBucket.limit === request.limit &&
    existingBucket.windowMs === request.windowMs
      ? existingBucket
      : null;
  const { bucket: prunedBucket } = pruneStoredRateLimitBucket(
    compatibleBucket,
    nowMs,
  );
  const currentBucket =
    prunedBucket ??
    ({
      limit: request.limit,
      windowMs: request.windowMs,
      timestamps: [],
    } satisfies StoredRateLimitBucket);

  if (currentBucket.timestamps.length >= request.limit) {
    const resetAt = currentBucket.timestamps[0]! + request.windowMs;
    return {
      bucket: currentBucket,
      alarmAt: resetAt,
      outcome: {
        allowed: false,
        limit: request.limit,
        remaining: 0,
        resetAt,
        retryAfterMs: Math.max(resetAt - nowMs, 0),
      } satisfies RateLimitOutcome,
    };
  }

  const timestamps = [...currentBucket.timestamps, nowMs];
  const resetAt = timestamps[0]! + request.windowMs;

  return {
    bucket: {
      limit: request.limit,
      windowMs: request.windowMs,
      timestamps,
    } satisfies StoredRateLimitBucket,
    alarmAt: resetAt,
    outcome: {
      allowed: true,
      limit: request.limit,
      remaining: Math.max(request.limit - timestamps.length, 0),
      resetAt,
      retryAfterMs: 0,
    } satisfies RateLimitOutcome,
  };
}
