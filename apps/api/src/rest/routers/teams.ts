import type { Context } from "../types";
import {
  getTeamByPublicTeamIdFromConvexIdentity,
  getTeamMembersFromConvex,
  listTeamsForUserFromConvex,
} from "@tamias/app-services/identity";
import {
  getTeamByIdSchema,
  teamMembersResponseSchema,
  teamResponseSchema,
  teamsResponseSchema,
  updateTeamByIdSchema,
} from "../../schemas/team";
import { validateResponse } from "../../utils/validate-response";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { updateTeamById } from "@tamias/app-data/queries";
import { withRequiredScope } from "../middleware";

const app = new OpenAPIHono<Context>();

function canAccessTeam(
  session: Context["Variables"]["session"],
  teamId: string,
) {
  if (session.teamMembershipIds) {
    return session.teamMembershipIds.includes(teamId);
  }

  return session.teamId === teamId;
}

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    summary: "List all teams",
    operationId: "listTeams",
    "x-speakeasy-name-override": "list",
    description: "Retrieve a list of teams for the authenticated user.",
    tags: ["Teams"],
    responses: {
      200: {
        description: "Retrieve a list of teams for the authenticated user.",
        content: {
          "application/json": {
            schema: teamsResponseSchema,
          },
        },
      },
    },
    middleware: [withRequiredScope("teams.read")],
  }),
  async (c) => {
    const session = c.get("session");

    const result = await listTeamsForUserFromConvex({
      userId: session.user.convexId,
      email: session.user.email ?? null,
    });

    return c.json(validateResponse({ data: result }, teamsResponseSchema));
  },
);

app.openapi(
  createRoute({
    method: "get",
    path: "/{id}",
    summary: "Retrieve a team",
    operationId: "getTeamById",
    "x-speakeasy-name-override": "get",
    description: "Retrieve a team by its ID for the authenticated team.",
    tags: ["Teams"],
    request: {
      params: getTeamByIdSchema,
    },
    responses: {
      200: {
        description: "Team details",
        content: {
          "application/json": {
            schema: teamResponseSchema,
          },
        },
      },
    },
    middleware: [withRequiredScope("teams.read")],
  }),
  async (c) => {
    const session = c.get("session");
    const teamId = c.req.param("id");

    if (!canAccessTeam(session, teamId)) {
      throw new Error("Team not found or access denied");
    }

    const result = await getTeamByPublicTeamIdFromConvexIdentity(teamId);

    return c.json(validateResponse(result, teamResponseSchema));
  },
);

app.openapi(
  createRoute({
    method: "patch",
    path: "/{id}",
    summary: "Update a team",
    operationId: "updateTeamById",
    "x-speakeasy-name-override": "update",
    description:
      "Update a team for the authenticated workspace. If there’s no change, returns it as it is.",
    tags: ["Teams"],
    request: {
      params: getTeamByIdSchema,
      body: {
        content: {
          "application/json": {
            schema: updateTeamByIdSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Team updated",
        content: {
          "application/json": {
            schema: teamResponseSchema,
          },
        },
      },
    },
    middleware: [withRequiredScope("teams.write")],
  }),
  async (c) => {
    const db = c.get("db");
    const session = c.get("session");
    const teamId = c.req.param("id");
    const params = c.req.valid("json");

    if (!canAccessTeam(session, teamId)) {
      throw new Error("Team not found or access denied");
    }

    const result = await updateTeamById(db, {
      id: teamId,
      data: params,
    });

    return c.json(validateResponse(result, teamResponseSchema));
  },
);

app.openapi(
  createRoute({
    method: "get",
    path: "/{id}/members",
    summary: "List all team members",
    operationId: "listTeamMembers",
    "x-speakeasy-name-override": "members",
    description: "List all team members for the authenticated team.",
    tags: ["Teams"],
    request: {
      params: getTeamByIdSchema,
    },
    responses: {
      200: {
        description: "Team members",
        content: {
          "application/json": {
            schema: teamMembersResponseSchema,
          },
        },
      },
    },
    middleware: [withRequiredScope("teams.read")],
  }),
  async (c) => {
    const session = c.get("session");
    const teamId = c.req.param("id");

    if (!canAccessTeam(session, teamId)) {
      throw new Error("Team not found or access denied");
    }

    const result = await getTeamMembersFromConvex(teamId);

    return c.json(
      validateResponse(
        {
          data: result.map((member) => ({
            id: member.user?.id,
            role: member.role,
            fullName: member.user?.fullName,
            avatarUrl: member.user?.avatarUrl,
          })),
        },
        teamMembersResponseSchema,
      ),
    );
  },
);

export const teamsRouter = app;
