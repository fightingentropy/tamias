import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import {
  McpCursorSitePage,
  mcpCursorSiteMetadata,
} from "@/site/pages/mcp-pages";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/mcp/cursor")({
  head: () => buildHeadFromMetadata(mcpCursorSiteMetadata),
});
