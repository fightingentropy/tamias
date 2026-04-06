import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const SKIPPED_DIRECTORIES = new Set([
  ".git",
  ".wrangler",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
]);

const SOURCE_FILE_PATTERN = /\.(?:[cm]?[jt]sx?|json)$/;
const FORBIDDEN_API_ALIAS_PATTERNS = [
  /from\s+["']@api\/[^"']+["']/,
  /import\(\s*["']@api\/[^"']+["']\s*\)/,
  /"@api\/\*"\s*:/,
];
const FORBIDDEN_API_PACKAGE_IMPORT_PATTERNS = [
  /from\s+["']@tamias\/api(?:\/[^"']*)?["']/,
  /import\(\s*["']@tamias\/api(?:\/[^"']*)?["']\s*\)/,
  /require\(\s*["']@tamias\/api(?:\/[^"']*)?["']\s*\)/,
];
const FORBIDDEN_CONVEX_GENERATED_PATTERNS = [
  /from\s+["'][^"']*convex\/_generated\/[^"']+["']/,
  /import\(\s*["'][^"']*convex\/_generated\/[^"']+["']\s*\)/,
];
const FORBIDDEN_APP_DATA_SELF_IMPORT_PATTERNS = [
  /from\s+["']@tamias\/app-data(?:\/client|\/queries)?["']/,
  /import\(\s*["']@tamias\/app-data(?:\/client|\/queries)?["']\s*\)/,
];
const FORBIDDEN_APP_DATA_ROOT_IMPORT_PATTERNS = [
  /from\s+["']@tamias\/app-data["']/,
  /import\(\s*["']@tamias\/app-data["']\s*\)/,
  /require\(\s*["']@tamias\/app-data["']\s*\)/,
];
const FORBIDDEN_APP_DATA_CONVEX_COMPAT_IMPORT_PATTERNS = [
  /from\s+["']@tamias\/app-data\/convex["']/,
  /import\(\s*["']@tamias\/app-data\/convex["']\s*\)/,
  /require\(\s*["']@tamias\/app-data\/convex["']\s*\)/,
];
const IMPORT_SPECIFIER_PATTERNS = [
  /from\s+["']([^"']+)["']/g,
  /import\(\s*["']([^"']+)["']\s*\)/g,
  /require\(\s*["']([^"']+)["']\s*\)/g,
];
const AI_SDK_PACKAGES = [
  "ai",
  "@ai-sdk/anthropic",
  "@ai-sdk/google",
  "@ai-sdk/mistral",
  "@ai-sdk/openai",
  "@ai-sdk/react",
  "@ai-sdk/rsc",
] as const;

type PackageJson = {
  exports?: unknown;
  name?: string;
  catalog?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

type WorkspacePackage = {
  directory: string;
  manifestPath: string;
  name: string;
  packageJson: PackageJson;
};

function shouldSkipDirectory(pathname: string) {
  return SKIPPED_DIRECTORIES.has(pathname);
}

function walkFiles(rootDir: string, currentDir = rootDir): string[] {
  const entries = readdirSync(currentDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (shouldSkipDirectory(entry.name)) {
        continue;
      }

      files.push(...walkFiles(rootDir, join(currentDir, entry.name)));
      continue;
    }

    if (!entry.isFile() || !SOURCE_FILE_PATTERN.test(entry.name)) {
      continue;
    }

    files.push(join(currentDir, entry.name));
  }

  return files;
}

function walkPackageJsonFiles(rootDir: string, currentDir = rootDir): string[] {
  const entries = readdirSync(currentDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (shouldSkipDirectory(entry.name)) {
        continue;
      }

      files.push(
        ...walkPackageJsonFiles(rootDir, join(currentDir, entry.name)),
      );
      continue;
    }

    if (entry.isFile() && entry.name === "package.json") {
      files.push(join(currentDir, entry.name));
    }
  }

  return files;
}

function walkSourceFiles(rootDir: string, currentDir = rootDir): string[] {
  const entries = readdirSync(currentDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (shouldSkipDirectory(entry.name)) {
        continue;
      }

      files.push(...walkSourceFiles(rootDir, join(currentDir, entry.name)));
      continue;
    }

    if (!entry.isFile() || !/\.(?:[cm]?[jt]sx?)$/.test(entry.name)) {
      continue;
    }

    files.push(join(currentDir, entry.name));
  }

  return files;
}

function normalizePath(rootDir: string, pathname: string) {
  return relative(rootDir, pathname).replaceAll("\\", "/");
}

function isInside(relativePath: string, directory: string) {
  return relativePath === directory || relativePath.startsWith(`${directory}/`);
}

function fileContainsAny(content: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(content));
}

function readPackageJson(pathname: string) {
  return JSON.parse(readFileSync(pathname, "utf8")) as PackageJson;
}

function listWorkspacePackages(rootDir: string): WorkspacePackage[] {
  return walkPackageJsonFiles(rootDir)
    .map((manifestPath) => {
      const relativePath = normalizePath(rootDir, manifestPath);
      if (
        relativePath === "package.json" ||
        (!isInside(relativePath, "apps") && !isInside(relativePath, "packages"))
      ) {
        return null;
      }

      const packageJson = readPackageJson(manifestPath);
      if (!packageJson.name) {
        return null;
      }

      return {
        directory: dirname(relativePath),
        manifestPath,
        name: packageJson.name,
        packageJson,
      } satisfies WorkspacePackage;
    })
    .filter((value): value is WorkspacePackage => value !== null)
    .sort((left, right) => right.name.length - left.name.length);
}

function getDependencyVersion(
  packageJson: PackageJson,
  dependencyName: string,
): string | null {
  return (
    packageJson.dependencies?.[dependencyName] ??
    packageJson.devDependencies?.[dependencyName] ??
    packageJson.optionalDependencies?.[dependencyName] ??
    packageJson.peerDependencies?.[dependencyName] ??
    null
  );
}

function parseMajor(version: string) {
  const match = version.match(/(\d+)(?:\.\d+)?(?:\.\d+)?/);
  return match ? Number(match[1]) : null;
}

function getImportSpecifiers(content: string) {
  const specifiers = new Set<string>();

  for (const pattern of IMPORT_SPECIFIER_PATTERNS) {
    pattern.lastIndex = 0;
    let match = pattern.exec(content);

    while (match) {
      const specifier = match[1]?.trim();
      if (specifier) {
        specifiers.add(specifier);
      }
      match = pattern.exec(content);
    }
  }

  return [...specifiers].sort();
}

function getWorkspacePackageForFile(
  rootDir: string,
  workspaces: WorkspacePackage[],
  pathname: string,
) {
  const relativePath = normalizePath(rootDir, pathname);
  return (
    workspaces.find((workspace) =>
      isInside(relativePath, workspace.directory),
    ) ?? null
  );
}

function resolveWorkspacePackageName(
  specifier: string,
  workspaces: WorkspacePackage[],
) {
  for (const workspace of workspaces) {
    if (
      specifier === workspace.name ||
      specifier.startsWith(`${workspace.name}/`)
    ) {
      return workspace.name;
    }
  }

  return null;
}

export function findForbiddenApiAliasReferences(rootDir: string): string[] {
  return walkFiles(rootDir)
    .map((pathname) => {
      const relativePath = normalizePath(rootDir, pathname);
      if (isInside(relativePath, "api")) {
        return null;
      }

      const content = readFileSync(pathname, "utf8");
      return fileContainsAny(content, FORBIDDEN_API_ALIAS_PATTERNS)
        ? relativePath
        : null;
    })
    .filter((value): value is string => value !== null)
    .sort();
}

export function findForbiddenApiPackageImports(rootDir: string): string[] {
  return walkSourceFiles(rootDir)
    .map((pathname) => {
      const relativePath = normalizePath(rootDir, pathname);
      if (
        isInside(relativePath, "api") ||
        isInside(relativePath, "dashboard") ||
        isInside(relativePath, "packages/trpc")
      ) {
        return null;
      }

      const content = readFileSync(pathname, "utf8");
      return fileContainsAny(content, FORBIDDEN_API_PACKAGE_IMPORT_PATTERNS)
        ? relativePath
        : null;
    })
    .filter((value): value is string => value !== null)
    .sort();
}

export function findForbiddenConvexGeneratedImports(rootDir: string): string[] {
  return walkFiles(rootDir)
    .map((pathname) => {
      const relativePath = normalizePath(rootDir, pathname);
      if (
        isInside(relativePath, "packages/convex-model") ||
        isInside(relativePath, "packages/app-data-convex") ||
        !fileContainsAny(
          readFileSync(pathname, "utf8"),
          FORBIDDEN_CONVEX_GENERATED_PATTERNS,
        )
      ) {
        return null;
      }

      return relativePath;
    })
    .filter((value): value is string => value !== null)
    .sort();
}

export function findForbiddenAppDataSelfImports(rootDir: string): string[] {
  return walkFiles(join(rootDir, "packages/app-data/src"))
    .map((pathname) => {
      const relativePath = normalizePath(rootDir, pathname);
      const content = readFileSync(pathname, "utf8");

      return fileContainsAny(content, FORBIDDEN_APP_DATA_SELF_IMPORT_PATTERNS)
        ? relativePath
        : null;
    })
    .filter((value): value is string => value !== null)
    .sort();
}

export function findForbiddenAppDataRootImports(rootDir: string): string[] {
  return walkSourceFiles(rootDir)
    .map((pathname) => {
      const relativePath = normalizePath(rootDir, pathname);
      if (isInside(relativePath, "packages/app-data")) {
        return null;
      }

      const content = readFileSync(pathname, "utf8");
      return fileContainsAny(content, FORBIDDEN_APP_DATA_ROOT_IMPORT_PATTERNS)
        ? relativePath
        : null;
    })
    .filter((value): value is string => value !== null)
    .sort();
}

export function findForbiddenAppDataConvexCompatImports(
  rootDir: string,
): string[] {
  return walkSourceFiles(rootDir)
    .map((pathname) => {
      const relativePath = normalizePath(rootDir, pathname);
      const content = readFileSync(pathname, "utf8");

      return fileContainsAny(
        content,
        FORBIDDEN_APP_DATA_CONVEX_COMPAT_IMPORT_PATTERNS,
      )
        ? relativePath
        : null;
    })
    .filter((value): value is string => value !== null)
    .sort();
}

export function findMissingInternalWorkspaceDependencies(
  rootDir: string,
): string[] {
  const workspaces = listWorkspacePackages(rootDir);

  return walkSourceFiles(rootDir)
    .flatMap((pathname) => {
      const owner = getWorkspacePackageForFile(rootDir, workspaces, pathname);
      if (!owner) {
        return [];
      }

      const content = readFileSync(pathname, "utf8");
      const missingDependencies = getImportSpecifiers(content)
        .map((specifier) => resolveWorkspacePackageName(specifier, workspaces))
        .filter(
          (dependencyName): dependencyName is string =>
            dependencyName !== null && dependencyName !== owner.name,
        )
        .filter(
          (dependencyName) =>
            getDependencyVersion(owner.packageJson, dependencyName) === null,
        )
        .map(
          (dependencyName) =>
            `${normalizePath(rootDir, pathname)} -> ${dependencyName}`,
        );

      return missingDependencies;
    })
    .sort();
}

function collectExportTargets(
  exportsValue: unknown,
  exportKey: string,
  onTarget: (exportKey: string, target: string) => void,
): void {
  if (typeof exportsValue === "string") {
    onTarget(exportKey, exportsValue);
    return;
  }

  if (Array.isArray(exportsValue)) {
    for (const item of exportsValue) {
      collectExportTargets(item, exportKey, onTarget);
    }
    return;
  }

  if (exportsValue && typeof exportsValue === "object") {
    for (const [nestedKey, nestedValue] of Object.entries(exportsValue)) {
      collectExportTargets(
        nestedValue,
        `${exportKey} (${nestedKey})`,
        onTarget,
      );
    }
  }
}

export function findBrokenWorkspaceExports(rootDir: string): string[] {
  const workspaces = listWorkspacePackages(rootDir);
  const violations = new Set<string>();

  for (const workspace of workspaces) {
    const exportsValue = workspace.packageJson.exports;
    if (!exportsValue || typeof exportsValue !== "object") {
      continue;
    }

    for (const [exportKey, targetValue] of Object.entries(exportsValue)) {
      collectExportTargets(
        targetValue,
        exportKey,
        (resolvedExportKey, target) => {
          if (
            typeof target !== "string" ||
            target.includes("*") ||
            target.startsWith("./dist/")
          ) {
            return;
          }

          const resolvedTarget = resolve(
            dirname(workspace.manifestPath),
            target,
          );
          if (existsSync(resolvedTarget)) {
            return;
          }

          violations.add(
            `${normalizePath(rootDir, workspace.manifestPath)}: export "${resolvedExportKey}" points to missing file ${normalizePath(rootDir, resolvedTarget)}`,
          );
        },
      );
    }
  }

  return [...violations].sort();
}

export function findAiSdkMajorVersionViolations(rootDir: string): string[] {
  const rootPackageJson = readPackageJson(join(rootDir, "package.json"));

  return walkPackageJsonFiles(rootDir)
    .map((pathname) => {
      const relativePath = normalizePath(rootDir, pathname);
      const packageJson = readPackageJson(pathname);
      const violations = AI_SDK_PACKAGES.flatMap((dependencyName) => {
        const expectedVersion = rootPackageJson.catalog?.[dependencyName];
        if (!expectedVersion) {
          return [];
        }

        const expectedMajor = parseMajor(expectedVersion);
        const actualVersion = getDependencyVersion(packageJson, dependencyName);
        if (!actualVersion || actualVersion === "catalog:") {
          return [];
        }

        const actualMajor = parseMajor(actualVersion);
        if (expectedMajor === null || actualMajor === null) {
          return [
            `${dependencyName} has an unreadable version specifier "${actualVersion}"`,
          ];
        }

        if (actualMajor === expectedMajor) {
          return [];
        }

        return [
          `${dependencyName} uses major ${actualMajor} (expected ${expectedMajor})`,
        ];
      });

      return violations.length === 0
        ? null
        : `${relativePath}: ${violations.join(", ")}`;
    })
    .filter((value): value is string => value !== null)
    .sort();
}

export function findAiSdkNonCatalogReferences(rootDir: string): string[] {
  const rootPackageJson = readPackageJson(join(rootDir, "package.json"));

  return walkPackageJsonFiles(rootDir)
    .map((pathname) => {
      const relativePath = normalizePath(rootDir, pathname);
      if (relativePath === "package.json") {
        return null;
      }

      const packageJson = readPackageJson(pathname);
      const violations = AI_SDK_PACKAGES.flatMap((dependencyName) => {
        const expectedVersion = rootPackageJson.catalog?.[dependencyName];
        if (!expectedVersion) {
          return [];
        }

        const actualVersion = getDependencyVersion(packageJson, dependencyName);
        if (!actualVersion || actualVersion === "catalog:") {
          return [];
        }

        return [
          `${dependencyName} should use catalog: (found "${actualVersion}")`,
        ];
      });

      return violations.length === 0
        ? null
        : `${relativePath}: ${violations.join(", ")}`;
    })
    .filter((value): value is string => value !== null)
    .sort();
}

function formatViolations(label: string, violations: string[]) {
  if (violations.length === 0) {
    return "";
  }

  return [label, ...violations.map((violation) => `- ${violation}`)].join("\n");
}

function main() {
  const rootDir = process.cwd();
  const apiAliasViolations = findForbiddenApiAliasReferences(rootDir);
  const apiPackageViolations = findForbiddenApiPackageImports(rootDir);
  const convexGeneratedViolations =
    findForbiddenConvexGeneratedImports(rootDir);
  const appDataSelfImportViolations = findForbiddenAppDataSelfImports(rootDir);
  const appDataRootImportViolations = findForbiddenAppDataRootImports(rootDir);
  const appDataConvexCompatImportViolations =
    findForbiddenAppDataConvexCompatImports(rootDir);
  const missingDependencyViolations =
    findMissingInternalWorkspaceDependencies(rootDir);
  const brokenExportViolations = findBrokenWorkspaceExports(rootDir);
  const aiSdkMajorViolations = findAiSdkMajorVersionViolations(rootDir);
  const aiSdkCatalogViolations = findAiSdkNonCatalogReferences(rootDir);
  const sections = [
    formatViolations(
      "Forbidden @api/* references found outside api:",
      apiAliasViolations,
    ),
    formatViolations(
      "Forbidden direct @tamias/api imports found outside api, dashboard, and packages/trpc:",
      apiPackageViolations,
    ),
    formatViolations(
      "Forbidden convex generated imports found outside packages/convex-model:",
      convexGeneratedViolations,
    ),
    formatViolations(
      "Forbidden @tamias/app-data self-imports found inside packages/app-data/src:",
      appDataSelfImportViolations,
    ),
    formatViolations(
      "Forbidden root @tamias/app-data imports found outside packages/app-data:",
      appDataRootImportViolations,
    ),
    formatViolations(
      "Forbidden legacy @tamias/app-data/convex imports found; use @tamias/app-data-convex instead:",
      appDataConvexCompatImportViolations,
    ),
    formatViolations(
      "Missing internal workspace dependency declarations found:",
      missingDependencyViolations,
    ),
    formatViolations(
      "Broken workspace source exports found:",
      brokenExportViolations,
    ),
    formatViolations(
      "AI SDK major version drift found against the root catalog:",
      aiSdkMajorViolations,
    ),
    formatViolations(
      "AI SDK dependencies should use the root catalog across the workspace:",
      aiSdkCatalogViolations,
    ),
  ].filter(Boolean);

  if (sections.length === 0) {
    return;
  }

  console.error(sections.join("\n\n"));
  process.exitCode = 1;
}

if (import.meta.main) {
  main();
}
