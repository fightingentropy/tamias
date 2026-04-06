/**
 * Git-based affected detection for CI (diff vs base ref).
 * Writes GitHub Actions outputs: has_affected, api, dashboard, worker.
 *
 * Env:
 * - CI_AFFECTED_BASE: merge-base ref or commit (e.g. origin/main, github.event.before)
 * - CI_AFFECTED_HEAD: default HEAD
 */

import { execSync } from "node:child_process";
import { appendFileSync } from "node:fs";

function setOutput(name: string, value: string): void {
  const path = process.env.GITHUB_OUTPUT;
  if (path) {
    appendFileSync(path, `${name}=${value}\n`, { encoding: "utf-8" });
  } else {
    console.log(`${name}=${value}`);
  }
}

function commitExists(ref: string): boolean {
  try {
    execSync(`git rev-parse --verify "${ref}^{commit}"`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function gitDiffNameOnly(base: string, head: string): string[] {
  try {
    const out = execSync(`git diff --name-only "${base}" "${head}"`, {
      encoding: "utf-8",
      maxBuffer: 64 * 1024 * 1024,
    });
    return out
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function resolveDiffRange(): { base: string; head: string } {
  let head = process.env.CI_AFFECTED_HEAD ?? "HEAD";
  let base = process.env.CI_AFFECTED_BASE ?? "origin/main";

  if (!base || /^0+$/.test(base)) {
    try {
      base = execSync("git rev-parse HEAD~1", { encoding: "utf-8" }).trim();
    } catch {
      base = "HEAD~1";
    }
  }

  if (!commitExists(head)) {
    head = "HEAD";
  }
  if (!commitExists(base)) {
    for (const candidate of ["origin/main", "main", "HEAD~1"]) {
      if (commitExists(candidate)) {
        base = candidate;
        break;
      }
    }
  }

  return { base, head };
}

function isIgnorablePath(f: string): boolean {
  if (f.endsWith(".md")) {
    return true;
  }
  if (f.startsWith(".github/")) {
    return true;
  }
  if (f === "LICENSE" || f === "SECURITY.md") {
    return true;
  }
  return false;
}

function classify(files: string[]): {
  hasAffected: boolean;
  api: boolean;
  dashboard: boolean;
  worker: boolean;
} {
  if (files.length === 0) {
    return {
      hasAffected: false,
      api: false,
      dashboard: false,
      worker: false,
    };
  }

  const nonIgnorable = files.filter((f) => !isIgnorablePath(f));
  if (nonIgnorable.length === 0) {
    return {
      hasAffected: false,
      api: false,
      dashboard: false,
      worker: false,
    };
  }

  let api = false;
  let dashboard = false;
  let worker = false;

  const markAllDeployTargets = (): void => {
    api = true;
    dashboard = true;
    worker = true;
  };

  const rootDepPattern =
    /^(package\.json|bun\.lock|eslint\.config\.mjs|\.prettierignore|\.prettierrc|bunfig\.toml|tsconfig\.json|wrangler\.jsonc)/;

  let sharedSurfaceTouched = false;
  for (const f of nonIgnorable) {
    if (f.startsWith("packages/") || f.startsWith("scripts/")) {
      sharedSurfaceTouched = true;
      break;
    }
    if (f.startsWith("config/")) {
      sharedSurfaceTouched = true;
      break;
    }
    if (rootDepPattern.test(f)) {
      sharedSurfaceTouched = true;
      break;
    }
  }

  if (sharedSurfaceTouched) {
    markAllDeployTargets();
  } else {
    for (const f of nonIgnorable) {
      if (f === "api" || f.startsWith("api/")) {
        api = true;
        dashboard = true;
      }
      if (f === "dashboard" || f.startsWith("dashboard/")) {
        dashboard = true;
      }
      if (f === "worker" || f.startsWith("worker/")) {
        worker = true;
        dashboard = true;
      }
    }
  }

  return {
    hasAffected: true,
    api,
    dashboard,
    worker,
  };
}

const { base, head } = resolveDiffRange();
const files = gitDiffNameOnly(base, head);
const result = classify(files);

console.log(`ci-affected: base=${base} head=${head} files=${files.length}`);
if (files.length > 0 && files.length <= 40) {
  for (const f of files) {
    console.log(`  ${f}`);
  }
}

setOutput("has_affected", result.hasAffected ? "true" : "false");
setOutput("api", result.api ? "true" : "false");
setOutput("dashboard", result.dashboard ? "true" : "false");
setOutput("worker", result.worker ? "true" : "false");
