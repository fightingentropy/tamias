import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import {
  McpMakeSitePage,
  mcpMakeSiteMetadata,
} from "@/site/pages/mcp-pages";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/mcp/make")({
  head: () => buildHeadFromMetadata(mcpMakeSiteMetadata),
});
