import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { createTestContext } from "../helpers/test-context";
import { mocks } from "../setup";

const fallbackModulePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../trpc/lib/institution-fallback.ts",
);

const sandboxRow = {
  id: "ins_sandbox",
  name: "First Sandbox Bank",
  logo: null,
  popularity: 0,
  availableHistory: null,
  maximumConsentValidity: null,
  provider: "truelayer" as const,
  type: null,
  country: "GB",
};

const mockFetchLive = mock((input: { excludeProviders?: "truelayer"[]; countryCode: string }) => {
  if (input.excludeProviders?.includes("truelayer")) {
    return Promise.resolve([]);
  }

  return Promise.resolve([sandboxRow]);
});

mock.module(fallbackModulePath, () => ({
  fetchLiveInstitutionsForSearch: mockFetchLive,
}));

const { createCallerFactory } = await import("../../trpc/init");
const { institutionsRouter } = await import("../../trpc/routers/institutions");

const createCaller = createCallerFactory(institutionsRouter);

describe("tRPC: institutions.get", () => {
  beforeEach(() => {
    mocks.getInstitutions.mockReset();
    mocks.getInstitutions.mockImplementation(() => Promise.resolve([]));
    mockFetchLive.mockClear();
  });

  test("uses live provider fallback when D1 returns no rows", async () => {
    const caller = createCaller(createTestContext());
    const result = await caller.get({
      countryCode: "GB",
      limit: 50,
    });

    expect(mockFetchLive).toHaveBeenCalled();
    expect(result.length).toBe(1);
    expect(result[0]?.id).toBe("ins_sandbox");
    expect(result[0]?.name).toBe("First Sandbox Bank");
  });

  test("skips live fallback when D1 returns rows", async () => {
    mocks.getInstitutions.mockImplementation(() =>
      Promise.resolve([
        {
          id: "from_d1",
          name: "Local Bank",
          logo: null,
          popularity: 1,
          availableHistory: null,
          maximumConsentValidity: null,
          provider: "truelayer" as const,
          type: null,
          countries: ["GB"],
        },
      ]),
    );

    const caller = createCaller(createTestContext());
    const result = await caller.get({ countryCode: "GB", limit: 50 });

    expect(mockFetchLive).not.toHaveBeenCalled();
    expect(result[0]?.id).toBe("from_d1");
  });

  test("live fallback returns no rows when the active provider is excluded", async () => {
    const caller = createCaller(createTestContext());
    const result = await caller.get({
      countryCode: "GB",
      limit: 50,
      excludeProviders: ["truelayer"],
    });

    expect(mockFetchLive).toHaveBeenCalled();
    expect(result.length).toBe(0);
  });
});

describe("tRPC: institutions.updateUsage", () => {
  beforeEach(() => {
    mocks.updateInstitutionUsage.mockReset();
    mocks.updateInstitutionUsage.mockImplementation(() => Promise.resolve(null));
  });

  test("returns data null when institution is not in D1 (live-fallback picks)", async () => {
    const caller = createCaller(createTestContext());
    const result = await caller.updateUsage({ id: "ins_only_from_live_provider" });

    expect(result.data).toBeNull();
  });
});
