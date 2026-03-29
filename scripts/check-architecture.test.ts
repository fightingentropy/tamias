import { describe, expect, test } from "bun:test";
import {
  findAiSdkMajorVersionViolations,
  findAiSdkNonCatalogReferences,
  findForbiddenAppDataSelfImports,
  findForbiddenApiAliasReferences,
  findForbiddenConvexGeneratedImports,
} from "./check-architecture";

describe("architecture boundaries", () => {
  test("does not reference @api/* outside apps/api", () => {
    expect(findForbiddenApiAliasReferences(process.cwd())).toEqual([]);
  });

  test("does not import convex generated modules outside convex-model", () => {
    expect(findForbiddenConvexGeneratedImports(process.cwd())).toEqual([]);
  });

  test("does not self-import app-data package aliases inside app-data", () => {
    expect(findForbiddenAppDataSelfImports(process.cwd())).toEqual([]);
  });

  test("keeps AI SDK majors aligned with the root catalog", () => {
    expect(findAiSdkMajorVersionViolations(process.cwd())).toEqual([]);
  });

  test("uses the root AI SDK catalog across the workspace", () => {
    expect(findAiSdkNonCatalogReferences(process.cwd())).toEqual([]);
  });
});
