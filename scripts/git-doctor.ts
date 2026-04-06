/**
 * Diagnose common reasons api/dashboard changes do not appear in Git or pushes.
 * Run from anywhere inside the repo: bun run git:doctor
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function sh(cmd: string, opts?: { ignoreError?: true }): string {
  try {
    return execSync(cmd, {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 8 * 1024 * 1024,
    }).trimEnd();
  } catch {
    if (opts?.ignoreError) {
      return "";
    }
    throw new Error(`Command failed: ${cmd}`);
  }
}

function main(): void {
  let topLevel: string;
  try {
    topLevel = sh("git rev-parse --show-toplevel");
  } catch {
    console.error("Not inside a Git repository.");
    process.exit(1);
  }

  const cwd = process.cwd();
  const cwdReal = path.resolve(cwd);
  const topReal = path.resolve(topLevel);

  console.log(`Git top-level: ${topReal}`);
  console.log(`Current cwd:   ${cwdReal}`);

  let exit = 0;

  if (cwdReal !== topReal) {
    console.warn(
      "\n[!] You are not at the repository root. Run Git and Bun from:\n    cd " +
        JSON.stringify(topReal),
    );
    console.warn(
      "    Or open tamias.code-workspace / the tamias folder so Source Control uses the root repo.",
    );
    exit = 1;
  }

  const sparse = sh("git config --bool core.sparseCheckout 2>/dev/null", {
    ignoreError: true,
  });
  if (sparse === "true") {
    const apiPkg = path.join(topLevel, "api/package.json");
    const dashPkg = path.join(topLevel, "dashboard/package.json");
    const sparsePath = path.join(topLevel, ".git/info/sparse-checkout");
    let patterns = "(could not read .git/info/sparse-checkout)";
    try {
      if (existsSync(sparsePath)) {
        patterns = readFileSync(sparsePath, "utf-8").trim() || "(empty)";
      }
    } catch {
      /* keep default message */
    }
    console.warn("\n[!] Sparse checkout is enabled. Patterns:\n" + patterns);
    const list = sh("git sparse-checkout list 2>/dev/null", { ignoreError: true });
    if (list) {
      console.warn("\nSparse-checkout list:\n" + list);
    }
    if (!existsSync(apiPkg) || !existsSync(dashPkg)) {
      console.warn(
        "\n[!] api/ or dashboard/ are missing from the working tree. Restore them with:\n" +
          "    git sparse-checkout add api dashboard",
      );
      exit = 1;
    }
  }

  for (const dir of ["api", "dashboard", "worker"]) {
    const gitMarker = path.join(topLevel, dir, ".git");
    if (existsSync(gitMarker)) {
      console.warn(
        `\n[!] Nested Git repo at ${dir}/.git — remove it so ${dir} is part of the monorepo:` +
          `\n    rm -rf ${path.join(dir, ".git")}   # only if this is not an intentional submodule`,
      );
      exit = 1;
    }
  }

  const tagged = sh("git ls-files -t 2>/dev/null", { ignoreError: true });
  const skipLines = tagged
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("S "));
  if (skipLines.length > 0) {
    console.warn(
      `\n[!] ${skipLines.length} path(s) have skip-worktree set (Git may omit them from commits).` +
        `\n    Inspect: git ls-files -t | rg '^S'` +
        `\n    Clear one path: git update-index --no-skip-worktree -- <path>`,
    );
    exit = 1;
  }

  const remote = sh("git remote get-url origin 2>/dev/null", { ignoreError: true });
  const branch = sh("git rev-parse --abbrev-ref HEAD 2>/dev/null", {
    ignoreError: true,
  });
  const head = sh("git rev-parse HEAD 2>/dev/null", { ignoreError: true });
  console.log(`\nBranch: ${branch || "?"}`);
  console.log(`HEAD:   ${head || "?"}`);
  if (remote) {
    console.log(`origin: ${remote}`);
  }

  if (exit === 0) {
    console.log("\nOK — no common monorepo/Git attachment issues detected.");
    console.log("To stage everything from the root: git add -A && git status");
  } else {
    console.log("\nFix the issues above, then: git add -A && git commit && git push");
  }

  process.exit(exit);
}

main();
