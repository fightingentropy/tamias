import { mockDb } from "../setup";

/**
 * Creates a test context for tRPC procedure calls.
 * Use this with createCallerFactory for tRPC integration tests.
 */
export interface TestContextOptions {
  teamId?: string;
  userId?: string;
}

// Note: This is intentionally using `any` to match the tRPC context type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createTestContext(options: TestContextOptions = {}): any {
  const { teamId = "test-team-id", userId = "test-user-id" } = options;

  return {
    session: {
      user: {
        id: userId,
        email: "test@example.com",
      },
    },
    db: mockDb,
    geo: {
      country: "US",
      city: "San Francisco",
      region: "CA",
    },
    teamId,
  };
}
