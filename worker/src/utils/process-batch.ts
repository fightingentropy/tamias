import { createLoggerWithContext } from "@tamias/logger";

const logger = createLoggerWithContext("worker:batch");

/**
 * Process items in sequential batches.
 * Logs and re-throws on failure — use `processBatchWithErrorIsolation` if
 * you need error isolation (one failed batch shouldn't stop the rest).
 */
export async function processBatch<T, R>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<R[]>,
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    try {
      const batchResults = await processor(batch);
      results.push(...batchResults);
    } catch (error) {
      logger.error(`Batch processing failed at index ${i}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  return results;
}

/**
 * Process items in batches with error isolation using Promise.allSettled
 * Returns results and errors separately for better error handling
 */
export async function processBatchWithErrorIsolation<T, R>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<R[]>,
): Promise<{
  results: R[];
  errors: Array<{ index: number; error: unknown }>;
}> {
  const results: R[] = [];
  const errors: Array<{ index: number; error: unknown }> = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchIndex = Math.floor(i / batchSize);

    try {
      const batchResults = await processor(batch);
      results.push(...batchResults);
    } catch (error) {
      errors.push({ index: batchIndex, error });
      // Continue processing remaining batches
    }
  }

  return { results, errors };
}

/**
 * Process items in parallel batches with concurrency limit
 * Useful for I/O-bound operations where you want parallelism but need to limit concurrency
 */
export async function processBatchParallel<T, R>(
  items: T[],
  batchSize: number,
  concurrency: number,
  processor: (batch: T[]) => Promise<R[]>,
): Promise<R[]> {
  const results: R[] = [];
  const batches: T[][] = [];

  // Split items into batches
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  // Process batches with concurrency limit
  for (let i = 0; i < batches.length; i += concurrency) {
    const concurrentBatches = batches.slice(i, i + concurrency);
    const batchResults = await Promise.all(concurrentBatches.map((batch) => processor(batch)));
    results.push(...batchResults.flat());
  }

  return results;
}

/**
 * Map items with bounded concurrency while preserving result order.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  processor: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);

  for (let i = 0; i < items.length; i += concurrency) {
    const concurrentItems = items.slice(i, i + concurrency);
    const concurrentResults = await Promise.all(
      concurrentItems.map((item, offset) => processor(item, i + offset)),
    );

    concurrentResults.forEach((result, offset) => {
      results[i + offset] = result;
    });
  }

  return results;
}
