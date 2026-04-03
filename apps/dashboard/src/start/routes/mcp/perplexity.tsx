import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import {
  McpPerplexitySitePage,
  mcpPerplexitySiteMetadata,
} from "@/site/pages/mcp-pages";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/mcp/perplexity")({
  head: () => buildHeadFromMetadata(mcpPerplexitySiteMetadata),
});
