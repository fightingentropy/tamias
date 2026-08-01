import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadRuntimeEnvironment } from "./lib/runtime-env";

const repositoryRoot = path.resolve(import.meta.dir, "..");
const persistenceDirectory = await mkdtemp(path.join(tmpdir(), "tamias-d1-migrations-"));

try {
  const processHandle = Bun.spawn(
    [
      path.join(repositoryRoot, "node_modules", ".bin", "wrangler"),
      "d1",
      "migrations",
      "apply",
      "APP_DB",
      "--local",
      "--config",
      path.join(repositoryRoot, "wrangler.jsonc"),
      "--persist-to",
      persistenceDirectory,
      "--env-file",
      "/dev/null",
    ],
    {
      cwd: repositoryRoot,
      env: {
        ...loadRuntimeEnvironment(repositoryRoot, ["localOnly"], {
          includeLocalOverrides: true,
        }),
        CI: "1",
      },
      stdout: "inherit",
      stderr: "inherit",
    },
  );

  const exitCode = await processHandle.exited;
  if (exitCode !== 0) process.exit(exitCode);
  console.log("All D1 migrations applied successfully to a fresh local database.");
} finally {
  await rm(persistenceDirectory, { recursive: true, force: true });
}
