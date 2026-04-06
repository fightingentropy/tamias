/**
 * TanStack Start `Register` typing for SSR router + start config.
 * Kept out of `routeTree.gen.ts` so `routes:generate:start` does not erase it.
 */
import type { getRouter } from "./router.tsx";
import type { startInstance } from "./start.ts";

declare module "@tanstack/react-start" {
  interface Register {
    ssr: true;
    router: Awaited<ReturnType<typeof getRouter>>;
    config: Awaited<ReturnType<typeof startInstance.getOptions>>;
  }
}
