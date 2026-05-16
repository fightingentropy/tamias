import { createDatabase, type Database } from "./client";

/**
 * Returns the shared query context for workers.
 */
let workerDb: Database | null = null;

export const getWorkerDb = (): Database => {
  workerDb ??= createDatabase();
  return workerDb;
};
