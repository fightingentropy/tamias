import { describe, expect, test } from "bun:test";
import path from "node:path";

describe("workflow script validation", () => {
  test("all workflow Bun scripts resolve", async () => {
    const processHandle = Bun.spawn(["bun", "run", "scripts/check-workflows.ts"], {
      cwd: path.resolve(import.meta.dir, ".."),
      stdout: "pipe",
      stderr: "pipe",
    });

    const [exitCode, stdout, stderr] = await Promise.all([
      processHandle.exited,
      new Response(processHandle.stdout).text(),
      new Response(processHandle.stderr).text(),
    ]);

    expect(exitCode, `${stdout}\n${stderr}`).toBe(0);
  });
});
