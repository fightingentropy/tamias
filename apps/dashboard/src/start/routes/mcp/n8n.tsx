import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import {
  McpN8nSitePage,
  mcpN8nSiteMetadata,
} from "@/site/pages/mcp-pages";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/mcp/n8n")({
  head: () => buildHeadFromMetadata(mcpN8nSiteMetadata),
});
