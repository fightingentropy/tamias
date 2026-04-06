import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Database } from "@tamias/app-data/client";
import type { Id } from "@tamias/app-data/convex/data-model";
import type { Scope } from "@tamias/auth-session/scopes";

export interface McpContext {
  db: Database;
  teamId: string;
  convexUserId?: Id<"appUsers">;
  scopes: Scope[];
}

export type RegisterTools = (server: McpServer, ctx: McpContext) => void;

// Common tool annotations for read-only tools
export const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

/**
 * Check if the context has the required scope for a tool
 */
export function hasScope(ctx: McpContext, requiredScope: Scope): boolean {
  return ctx.scopes.includes(requiredScope);
}
