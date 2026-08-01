import { Generator, getConfig } from "@tanstack/router-generator";

// Match the footer TanStack Start's Vite plugin adds so standalone generation and builds
// produce byte-for-byte identical output.

const root = process.cwd();
const config = getConfig(
  {
    routesDirectory: "./src/start/routes",
    generatedRouteTree: "./src/start/routeTree.gen.ts",
    quoteStyle: "double",
    semicolons: true,
    routeTreeFileFooter: [
      `import type { getRouter } from "./router.tsx"
import type { startInstance } from "./start.ts"
declare module "@tanstack/react-start" {
  interface Register {
    ssr: true
    router: Awaited<ReturnType<typeof getRouter>>
    config: Awaited<ReturnType<typeof startInstance.getOptions>>
  }
}`,
    ],
  },
  root,
);

const generator = new Generator({
  config,
  root,
});

await generator.run();
