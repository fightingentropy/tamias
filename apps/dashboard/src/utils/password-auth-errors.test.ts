import { describe, expect, it } from "bun:test";
import { getPasswordAuthErrorMessage } from "./password-auth-errors";

describe("getPasswordAuthErrorMessage", () => {
  it("maps invalid account ids to a generic credential error", () => {
    expect(
      getPasswordAuthErrorMessage(
        new Error(
          "[Request ID] Server Error\nUncaught Error: InvalidAccountId",
        ),
        "signIn",
      ),
    ).toBe("Incorrect email or password.");
  });

  it("maps invalid secrets to a generic credential error", () => {
    expect(
      getPasswordAuthErrorMessage(
        new Error("[Request ID] Server Error\nUncaught Error: InvalidSecret"),
        "signIn",
      ),
    ).toBe("Incorrect email or password.");
  });

  it("maps duplicate sign-up attempts to a sign-in suggestion", () => {
    expect(
      getPasswordAuthErrorMessage(
        new Error("Account marlowe.walker@example.com already exists"),
        "signUp",
      ),
    ).toBe("An account with this email already exists. Sign in instead.");
  });

  it("maps transport failures to a local auth service message", () => {
    expect(
      getPasswordAuthErrorMessage(new Error("fetch failed"), "signIn"),
    ).toBe(
      "Unable to reach the authentication service. Make sure the dashboard and API are running.",
    );
  });

  it("falls back to the mode-specific default message", () => {
    expect(
      getPasswordAuthErrorMessage(new Error("Unexpected failure"), "signUp"),
    ).toBe("Unable to create your account.");
  });
});
