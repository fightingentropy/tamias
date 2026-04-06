import { StreamableHTTPTransport } from "@hono/mcp";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { Scope } from "@tamias/auth-session/scopes";
import { createMcpServer } from "../../mcp/server";
import type { Context } from "../types";

const app = new OpenAPIHono<Context>();

app.all("/", async (c) => {
  const transport = new StreamableHTTPTransport();
  const db = c.get("db");
  const teamId = c.get("teamId");
  const session = c.get("session");
  const convexUserId = session.user.convexId;
  const scopes = (c.get("scopes") as Scope[] | undefined) ?? [];

  const server = createMcpServer({ db, teamId, convexUserId, scopes });

  await server.connect(transport);

  return transport.handleRequest(c);
});

export const mcpRouter = app;
