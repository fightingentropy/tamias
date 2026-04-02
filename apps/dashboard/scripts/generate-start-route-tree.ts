import { Generator, getConfig } from "@tanstack/router-generator";

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
