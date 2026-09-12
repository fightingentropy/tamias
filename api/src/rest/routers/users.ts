import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  getCurrentUser,
  getTeamById,
  hasTeamAccess,
  updateCurrentUser,
} from "@tamias/app-services/identity";
import { generateOptionalFileKey } from "@tamias/encryption";
import type { Context as HonoContext } from "hono";
import { HTTPException } from "hono/http-exception";
import { updateUserSchema, userSchema } from "../../schemas/users";
import { validateResponse } from "../../utils/validate-response";
import { withRequiredScope } from "../middleware";
import type { Context } from "../types";

const app = new OpenAPIHono<Context>();

async function getAuthenticatedTeam(c: HonoContext<Context>) {
  const teamId = c.get("teamId");
  const session = c.get("session");
  const db = c.get("db");
  if (!teamId || !(await hasTeamAccess({ userId: session.user.id, teamId, db }))) {
    throw new HTTPException(403, { message: "Authenticated team access denied" });
  }

  const team = await getTeamById(teamId, db);
  if (!team) {
    throw new HTTPException(404, { message: "Authenticated team not found" });
  }
  return team;
}

app.openapi(
  createRoute({
    method: "get",
    path: "/me",
    summary: "Retrieve the current user",
    operationId: "getCurrentUser",
    "x-speakeasy-name-override": "get",
    description: "Retrieve the current user for the authenticated team.",
    tags: ["Users"],
    responses: {
      200: {
        description: "Retrieve the current user for the authenticated team.",
        content: {
          "application/json": {
            schema: userSchema,
          },
        },
      },
    },
    middleware: [withRequiredScope("users.read")],
  }),
  async (c) => {
    const session = c.get("session");
    const team = await getAuthenticatedTeam(c);

    const result = await getCurrentUser({
      userId: session.user.id,
      email: session.user.email ?? null,
      db: c.get("db"),
    });

    // API credentials can be pinned to a different team from the user's selected team.
    const response = result
      ? {
          ...result,
          teamId: team.id,
          team,
          fileKey: await generateOptionalFileKey(team.id),
        }
      : null;

    return c.json(validateResponse(response, userSchema));
  },
);

app.openapi(
  createRoute({
    method: "patch",
    path: "/me",
    summary: "Update the current user",
    operationId: "updateCurrentUser",
    "x-speakeasy-name-override": "update",
    description: "Update the current user for the authenticated team.",
    tags: ["Users"],
    request: {
      body: {
        content: {
          "application/json": {
            schema: updateUserSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "The updated user",
        content: {
          "application/json": {
            schema: userSchema,
          },
        },
      },
    },
    middleware: [withRequiredScope("users.write")],
  }),
  async (c) => {
    const session = c.get("session");
    const body = c.req.valid("json");
    const team = await getAuthenticatedTeam(c);

    const result = await updateCurrentUser({
      userId: session.user.id,
      db: c.get("db"),
      currentEmail: session.user.email ?? null,
      fullName: body.fullName,
      email: body.email,
      avatarUrl: body.avatarUrl,
      locale: body.locale,
      weekStartsOnMonday: body.weekStartsOnMonday,
      timezone: body.timezone,
      timezoneAutoSync: body.timezoneAutoSync,
      timeFormat: body.timeFormat === 12 || body.timeFormat === 24 ? body.timeFormat : undefined,
      dateFormat: body.dateFormat,
      aiProvider: body.aiProvider,
    });

    const response = result
      ? {
          ...result,
          teamId: team.id,
          team,
          fileKey: await generateOptionalFileKey(team.id),
        }
      : null;

    return c.json(validateResponse(response, userSchema));
  },
);

export const usersRouter = app;
