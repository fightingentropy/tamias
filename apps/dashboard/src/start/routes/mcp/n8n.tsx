import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { mcpN8nSiteMetadata } from "@/site/pages/mcp-metadata";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/mcp/n8n")({
  head: () => buildHeadFromMetadata(mcpN8nSiteMetadata),
});
