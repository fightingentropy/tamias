import { createFileRoute } from "@tanstack/react-router";
import {
  McpPerplexitySitePage,
  mcpPerplexitySiteMetadata,
} from "@/site/pages/mcp-pages";
import { SiteLayoutShell } from "@/start/root-shell";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createFileRoute("/mcp/perplexity")({
  head: () => buildHeadFromMetadata(mcpPerplexitySiteMetadata),
  component: () => (
    <SiteLayoutShell>
      <McpPerplexitySitePage />
    </SiteLayoutShell>
  ),
});
