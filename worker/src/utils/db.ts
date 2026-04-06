import type { Database } from "@tamias/app-data/client";
import { getWorkerDb } from "@tamias/app-data/worker-client";
import { createLoggerWithContext } from "@tamias/logger";

const logger = createLoggerWithContext("worker:db");

/**
 * Get the shared query context for worker jobs.
 */
let dbInstance: Database | null = null;

/**
 * Initialize lazily so worker startup only pays the cost on first use.
 */
export function getDb(): Database {
  if (!dbInstance) {
    try {
      dbInstance = getWorkerDb();
    } catch (error) {
      logger.error("Failed to initialize worker query context", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
  return dbInstance;
}
