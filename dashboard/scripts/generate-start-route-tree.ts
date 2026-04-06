import { Generator, getConfig } from "@tanstack/router-generator";

// Overwrites `src/start/routeTree.gen.ts` only. TanStack Start `Register` types live in
// `src/start/tanstack-react-start-register.ts` so they are not erased here.

const root = process.cwd();
const config = getConfig(
  {
    routesDirectory: "./src/start/routes",
    generatedRouteTree: "./src/start/routeTree.gen.ts",
  },
  root,
);

const generator = new Generator({
  config,
  root,
});

await generator.run();
