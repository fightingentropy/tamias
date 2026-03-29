import { db, type Database } from "./client";

/**
 * Returns the shared query context for jobs.
 */
export const createJobDb = () => {
  return {
    db: db as Database,
    disconnect: async () => {},
  };
};
