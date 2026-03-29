import { describe, expect, mock, test } from "bun:test";
import { TRPCError } from "@trpc/server";

const getTeamMembershipIdsFromConvex = mock(async () => [] as string[]);

mock.module("@tamias/app-services/identity", () => ({
  getTeamMembershipIdsFromConvex,
}));

const { withTeamPermission } = await import("./team-permission");

describe("withTeamPermission", () => {
  test("keeps the current team when the session already carries access", async () => {
    const result = await withTeamPermission({
      ctx: {
        db: {} as never,
        session: {
          teamId: "team_123",
          teamMembershipIds: ["team_123"],
          user: {
            id: "user_123" as never,
            convexId: "user_123" as never,
            email: "user@example.com",
          },
        },
      },
      next: async ({ ctx }) => ctx.teamId,
      procedurePath: "team.current",
    });

    expect(result).toBe("team_123");
  });

  test("rejects sessions that point at a team the user cannot access", async () => {
    try {
      await withTeamPermission({
        ctx: {
          db: {} as never,
          session: {
            teamId: "team_999",
            teamMembershipIds: ["team_123"],
            user: {
              id: "user_123" as never,
              convexId: "user_123" as never,
              email: "user@example.com",
            },
          },
        },
        next: async ({ ctx }) => ctx.teamId,
        procedurePath: "team.current",
      });
      throw new Error("Expected permission error");
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe("FORBIDDEN");
    }
  });

  test("rejects users without convex-confirmed access", async () => {
    getTeamMembershipIdsFromConvex.mockResolvedValueOnce([]);

    try {
      await withTeamPermission({
        ctx: {
          db: {} as never,
          session: {
            teamId: "team_123",
            user: {
              id: "user_123" as never,
              convexId: "user_123" as never,
              email: "user@example.com",
            },
          },
        },
        next: async ({ ctx }) => ctx.teamId,
        procedurePath: "team.current",
      });
      throw new Error("Expected permission error");
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe("FORBIDDEN");
      expect(getTeamMembershipIdsFromConvex).toHaveBeenCalled();
    }
  });
});
