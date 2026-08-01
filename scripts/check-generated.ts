import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadRuntimeEnvironment, type RuntimeEnvName } from "./lib/runtime-env";

const repositoryRoot = path.resolve(import.meta.dir, "..");
const generatedFiles = [
  "api/src/trpc/routers/_cluster-map.gen.ts",
  "dashboard/src/start/routeTree.gen.ts",
  "types/cloudflare-env.d.ts",
];
const beforeGeneration = new Map(
  await Promise.all(
    generatedFiles.map(async (file) => [
      file,
      await readFile(path.join(repositoryRoot, file), "utf8"),
    ]),
  ),
);

function run(command: string[], runtimes: RuntimeEnvName[], cwd = repositoryRoot): void {
  const result = spawnSync(command[0]!, command.slice(1), {
    cwd,
    stdio: "inherit",
    env: loadRuntimeEnvironment(repositoryRoot, runtimes, {
      includeLocalOverrides: true,
    }),
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(["bun", "--no-env-file", "run", "scripts/generate-cluster-map.ts"], ["localOnly"]);
run(
  ["bun", "--no-env-file", "run", "routes:generate:start"],
  ["dashboard"],
  path.join(repositoryRoot, "dashboard"),
);
run(["bun", "--no-env-file", "run", "types:cloudflare"], ["localOnly"]);
run(
  [path.join(repositoryRoot, "node_modules", ".bin", "prettier"), "--write", ...generatedFiles],
  ["localOnly"],
);

const staleFiles: string[] = [];
for (const file of generatedFiles) {
  const afterGeneration = await readFile(path.join(repositoryRoot, file), "utf8");
  if (afterGeneration !== beforeGeneration.get(file)) staleFiles.push(file);
}

if (staleFiles.length > 0) {
  console.error("Generated files are stale. Regenerate and commit these changes:");
  for (const file of staleFiles) console.error(`- ${file}`);
  process.exit(1);
}

console.log("Generated Cloudflare types, route tree, and router cluster map are current.");
