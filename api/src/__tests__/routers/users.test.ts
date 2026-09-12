import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { verifyFileKey } from "@tamias/encryption";
import { usersRouter } from "../../rest/routers/users";
import { createTestApp } from "../helpers";
import { mocks } from "../setup";

const userId = "d1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const authenticatedTeamId = "a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const selectedTeamId = "b1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const selectedUser = {
  id: userId,
  fullName: "Test User",
  email: "test@example.com",
  avatarUrl: null,
  locale: "en-GB",
  weekStartsOnMonday: true,
  timezone: "Europe/London",
  timezoneAutoSync: true,
  timeFormat: 24,
  dateFormat: "dd/MM/yyyy",
  aiProvider: "openai",
  teamId: selectedTeamId,
  team: { id: selectedTeamId, name: "Selected team B", logoUrl: null, plan: "pro" },
};
const authenticatedTeam = {
  id: authenticatedTeamId,
  name: "API key team A",
  logoUrl: null,
  plan: "pro",
};
const originalSecret = process.env.FILE_KEY_SECRET;
afterAll(() => {
  if (originalSecret === undefined) delete process.env.FILE_KEY_SECRET;
  else process.env.FILE_KEY_SECRET = originalSecret;
});

function createApp() {
  const app = createTestApp({
    userId,
    teamId: authenticatedTeamId,
    scopes: ["users.read", "users.write"],
  });
  app.route("/users", usersRouter);
  return app;
}

beforeEach(() => {
  process.env.FILE_KEY_SECRET = "users-test-secret-not-for-production";
  mocks.hasTeamAccess.mockReset();
  mocks.hasTeamAccess.mockResolvedValue(true);
  mocks.getTeamById.mockReset();
  mocks.getTeamById.mockResolvedValue(authenticatedTeam);
  mocks.getCurrentUser.mockReset();
  mocks.getCurrentUser.mockResolvedValue(selectedUser);
  mocks.updateCurrentUser.mockReset();
  mocks.updateCurrentUser.mockResolvedValue({ ...selectedUser, fullName: "Updated User" });
});

describe("current user authenticated team", () => {
  test("reports the API key team and file key when the user selected another team", async () => {
    const response = await createApp().request("/users/me");
    expect(response.status).toBe(200);
    const result = (await response.json()) as typeof selectedUser & { fileKey: string };
    expect(result).toMatchObject({
      id: userId,
      fullName: selectedUser.fullName,
      teamId: authenticatedTeamId,
      team: authenticatedTeam,
    });
    expect(await verifyFileKey(result.fileKey)).toBe(authenticatedTeamId);
    expect(mocks.hasTeamAccess).toHaveBeenCalledWith({
      userId,
      teamId: authenticatedTeamId,
      db: expect.anything(),
    });
    expect(mocks.getTeamById).toHaveBeenCalledWith(authenticatedTeamId, expect.anything());
  });

  test("keeps updated profile responses scoped to the authenticated team", async () => {
    const response = await createApp().request("/users/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fullName: "Updated User" }),
    });
    expect(response.status).toBe(200);
    const result = (await response.json()) as typeof selectedUser & { fileKey: string };
    expect(result).toMatchObject({
      fullName: "Updated User",
      teamId: authenticatedTeamId,
      team: authenticatedTeam,
    });
    expect(await verifyFileKey(result.fileKey)).toBe(authenticatedTeamId);
  });

  test("refuses a revoked membership before exposing a user or updating a profile", async () => {
    mocks.hasTeamAccess.mockResolvedValue(false);
    expect((await createApp().request("/users/me")).status).toBe(403);
    expect(
      (
        await createApp().request("/users/me", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ fullName: "Updated User" }),
        })
      ).status,
    ).toBe(403);
    expect(mocks.getTeamById).not.toHaveBeenCalled();
    expect(mocks.getCurrentUser).not.toHaveBeenCalled();
    expect(mocks.updateCurrentUser).not.toHaveBeenCalled();
  });

  test("does not fall back to the selected team when the authenticated team is missing", async () => {
    mocks.getTeamById.mockResolvedValue(null);
    expect((await createApp().request("/users/me")).status).toBe(404);
    expect(mocks.getCurrentUser).not.toHaveBeenCalled();
  });
});
