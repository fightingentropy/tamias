import { DurableObject } from "cloudflare:workers";
import {
  consumeRateLimit,
  isRateLimitRequest,
  pruneStoredRateLimitBucket,
  type RateLimitOutcome,
  type RateLimitRequest,
  type StoredRateLimitBucket,
} from "./shared";

const STORAGE_KEY = "rate-limit";

export class RateLimitCoordinator extends DurableObject<Env> {
  async consume(payload: RateLimitRequest): Promise<RateLimitOutcome> {
    if (!isRateLimitRequest(payload)) {
      throw new Error("Invalid rate limit request payload");
    }

    return this.ctx.storage.transaction(async (txn) => {
      const bucket = await txn.get<StoredRateLimitBucket>(STORAGE_KEY);
      const nextState = consumeRateLimit(bucket, payload);

      await this.persistBucket(txn, nextState.bucket, nextState.alarmAt);

      return nextState.outcome;
    });
  }

  async alarm() {
    const bucket = await this.ctx.storage.get<StoredRateLimitBucket>(
      STORAGE_KEY,
    );
    const { bucket: nextBucket, alarmAt } = pruneStoredRateLimitBucket(
      bucket,
      Date.now(),
    );

    await this.persistBucket(this.ctx.storage, nextBucket, alarmAt);
  }

  private async persistBucket(
    storage: DurableObjectStorage | DurableObjectTransaction,
    bucket: StoredRateLimitBucket | null,
    alarmAt: number | null,
  ) {
    if (!bucket || alarmAt === null) {
      await storage.delete(STORAGE_KEY);
      await storage.deleteAlarm();
      return;
    }

    await storage.put(STORAGE_KEY, bucket);
    await storage.setAlarm(alarmAt);
  }
}
