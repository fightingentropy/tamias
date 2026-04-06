// Types
export type { AppRouter, RouterInputs, RouterOutputs } from "@tamias/api/trpc/routers/_app";

// Internal client
export { createInternalClient, getInternalClient } from "./internal";

/**
 * Pre-configured internal tRPC client singleton.
 * Usage: import { trpc } from "@tamias/trpc";
 *        await trpc.banking.rates.query();
 */
// Re-use the re-exported getInternalClient to avoid duplicate import
import { getInternalClient as _getClient } from "./internal";
export const trpc = _getClient();
