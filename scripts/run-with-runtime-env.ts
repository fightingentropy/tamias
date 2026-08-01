import path from "node:path";
import { loadRuntimeEnvironment, type RuntimeEnvName } from "./lib/runtime-env";

const separatorIndex = Bun.argv.indexOf("--");
if (separatorIndex < 3 || separatorIndex === Bun.argv.length - 1) {
  throw new Error(
    "Usage: bun --no-env-file scripts/run-with-runtime-env.ts <runtime[,runtime...]> -- <command> [...args]",
  );
}

const runtimes = Bun.argv
  .slice(2, separatorIndex)
  .flatMap((value) => value.split(","))
  .map((value) => value.trim())
  .filter(Boolean) as RuntimeEnvName[];
const command = Bun.argv.slice(separatorIndex + 1);
const repoRoot = path.resolve(import.meta.dir, "..");
const environment = loadRuntimeEnvironment(repoRoot, runtimes, { includeLocalOverrides: true });
const child = Bun.spawn(command, {
  cwd: repoRoot,
  env: environment,
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});

process.exit(await child.exited);
