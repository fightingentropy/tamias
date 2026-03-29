import { db, type Database } from "./client";

/**
 * Returns the shared query context for workers.
 */
export const getWorkerDb = (): Database => {
  return db;
};
