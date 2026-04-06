import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { getCurrentUserFromConvex, updateCurrentUserInConvex } from "@tamias/app-services/identity";
import { generateOptionalFileKey } from "@tamias/encryption";
import { updateUserSchema, userSchema } from "../../schemas/users";
import { validateResponse } from "../../utils/validate-response";
import { withRequiredScope } from "../middleware";
import type { Context } from "../types";

const app = new OpenAPIHono<Context>();

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

    const result = await getCurrentUserFromConvex({
      userId: session.user.convexId,
      email: session.user.email ?? null,
    });

    // Add fileKey if user has a teamId
    const response = result
      ? {
          ...result,
          fileKey: await generateOptionalFileKey(result.teamId),
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

    const result = await updateCurrentUserInConvex({
      userId: session.user.convexId,
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
          fileKey: await generateOptionalFileKey(result.teamId),
        }
      : null;

    return c.json(validateResponse(response, userSchema));
  },
);

export const usersRouter = app;
