import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const ENV_FILE_PATHS = [path.join(repoRoot, ".env"), path.join(repoRoot, ".env.local")];

function parseEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) {
    return {};
  }

  const contents = readFileSync(filePath, "utf8");
  const values: Record<string, string> = {};

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");

    values[key] = value;
  }

  return values;
}

export function getLocalEnvValue(key: string): string | undefined {
  const runtimeValue = process.env[key];

  if (runtimeValue) {
    return runtimeValue;
  }

  for (const filePath of ENV_FILE_PATHS) {
    const parsed = parseEnvFile(filePath);

    if (parsed[key]) {
      return parsed[key];
    }
  }

  return undefined;
}
