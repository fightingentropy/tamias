import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import {
  McpClaudeSitePage,
  mcpClaudeSiteMetadata,
} from "@/site/pages/mcp-pages";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/mcp/claude")({
  head: () => buildHeadFromMetadata(mcpClaudeSiteMetadata),
});
