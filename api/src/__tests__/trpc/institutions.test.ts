import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { createTestContext } from "../helpers/test-context";
import { mocks } from "../setup";

const fallbackModulePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../trpc/lib/plaid-institution-fallback.ts",
);

const sandboxRow = {
  id: "ins_sandbox",
  name: "First Platypus Bank",
  logo: null,
  popularity: 0,
  availableHistory: null,
  maximumConsentValidity: null,
  provider: "plaid" as const,
  type: null,
  country: "US",
};

const mockFetchPlaid = mock(
  (input: { excludeProviders?: ("plaid" | "teller")[]; countryCode: string }) => {
    if (input.excludeProviders?.includes("plaid")) {
      return Promise.resolve([]);
    }

    return Promise.resolve([sandboxRow]);
  },
);

mock.module(fallbackModulePath, () => ({
  fetchPlaidInstitutionsForSearch: mockFetchPlaid,
}));

const { createCallerFactory } = await import("../../trpc/init");
const { institutionsRouter } = await import("../../trpc/routers/institutions");

const createCaller = createCallerFactory(institutionsRouter);

describe("tRPC: institutions.get", () => {
  beforeEach(() => {
    mocks.getInstitutions.mockReset();
    mocks.getInstitutions.mockImplementation(() => Promise.resolve([]));
    mockFetchPlaid.mockClear();
  });

  test("uses live Plaid fallback when Convex returns no rows", async () => {
    const caller = createCaller(createTestContext());
    const result = await caller.get({
      countryCode: "US",
      limit: 50,
    });

    expect(mockFetchPlaid).toHaveBeenCalled();
    expect(result.length).toBe(1);
    expect(result[0]?.id).toBe("ins_sandbox");
    expect(result[0]?.name).toBe("First Platypus Bank");
  });

  test("skips live fallback when Convex returns rows", async () => {
    mocks.getInstitutions.mockImplementation(() =>
      Promise.resolve([
        {
          id: "from_convex",
          name: "Local Bank",
          logo: null,
          popularity: 1,
          availableHistory: null,
          maximumConsentValidity: null,
          provider: "plaid" as const,
          type: null,
          countries: ["US"],
        },
      ]),
    );

    const caller = createCaller(createTestContext());
    const result = await caller.get({ countryCode: "US", limit: 50 });

    expect(mockFetchPlaid).not.toHaveBeenCalled();
    expect(result[0]?.id).toBe("from_convex");
  });

  test("live fallback returns no plaid rows when excludeProviders includes plaid", async () => {
    const caller = createCaller(createTestContext());
    const result = await caller.get({
      countryCode: "US",
      limit: 50,
      excludeProviders: ["plaid"],
    });

    expect(mockFetchPlaid).toHaveBeenCalled();
    expect(result.length).toBe(0);
  });
});

describe("tRPC: institutions.updateUsage", () => {
  beforeEach(() => {
    mocks.updateInstitutionUsage.mockReset();
    mocks.updateInstitutionUsage.mockImplementation(() => Promise.resolve(null));
  });

  test("returns data null when institution is not in Convex (live-fallback picks)", async () => {
    const caller = createCaller(createTestContext());
    const result = await caller.updateUsage({ id: "ins_only_from_plaid" });

    expect(result.data).toBeNull();
  });
});
