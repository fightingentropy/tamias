import { describe, expect, test } from "bun:test";
import {
  getPostAuthRedirectPath,
  hasCompletedOnboarding,
} from "./auth-routing";

describe("auth routing", () => {
  test("treats fully onboarded users as dashboard-ready", () => {
    const user = {
      fullName: "Codex User",
      teamId: "team_123",
    };

    expect(hasCompletedOnboarding(user)).toBe(true);
    expect(getPostAuthRedirectPath(user)).toBe("/dashboard");
  });

  test("routes missing profile details to onboarding", () => {
    expect(
      getPostAuthRedirectPath({
        fullName: "",
        teamId: "team_123",
      }),
    ).toBe("/onboarding");

    expect(
      getPostAuthRedirectPath({
        fullName: "Codex User",
        teamId: null,
      }),
    ).toBe("/onboarding");
  });
});
