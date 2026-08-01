import { readdir } from "node:fs/promises";
import path from "node:path";

type JsonObject = Record<string, unknown>;

const repositoryRoot = path.resolve(import.meta.dir, "..");
const workflowsDirectory = path.join(repositoryRoot, ".github", "workflows");
const rootPackage = (await Bun.file(path.join(repositoryRoot, "package.json")).json()) as {
  scripts?: Record<string, string>;
};
const rootScripts = rootPackage.scripts ?? {};

function visit(value: unknown, onRun: (command: string) => void): void {
  if (Array.isArray(value)) {
    for (const item of value) visit(item, onRun);
    return;
  }

  if (!value || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value as JsonObject)) {
    if (key === "run" && typeof child === "string") {
      onRun(child);
    } else {
      visit(child, onRun);
    }
  }
}

const errors: string[] = [];
const workflowFiles = (await readdir(workflowsDirectory))
  .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
  .sort();

for (const workflowFile of workflowFiles) {
  const workflowPath = path.join(workflowsDirectory, workflowFile);
  const source = await Bun.file(workflowPath).text();
  let workflow: unknown;

  try {
    workflow = Bun.YAML.parse(source);
  } catch (error) {
    errors.push(`${workflowFile}: invalid YAML (${String(error)})`);
    continue;
  }

  visit(workflow, (command) => {
    for (const match of command.matchAll(/(?:^|[;&|]\s*)bun\s+run\s+([\w:.-]+)/gm)) {
      const scriptName = match[1];
      if (scriptName && !(scriptName in rootScripts)) {
        errors.push(`${workflowFile}: bun run ${scriptName} is not declared in root package.json`);
      }
    }
  });
}

if (errors.length > 0) {
  console.error("Workflow validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Validated ${workflowFiles.length} workflow file(s) and all referenced Bun scripts.`);
