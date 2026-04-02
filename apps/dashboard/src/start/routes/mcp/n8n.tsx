import { createFileRoute } from "@tanstack/react-router";
import {
  McpN8nSitePage,
  mcpN8nSiteMetadata,
} from "@/site/pages/mcp-pages";
import { SiteLayoutShell } from "@/start/root-shell";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createFileRoute("/mcp/n8n")({
  head: () => buildHeadFromMetadata(mcpN8nSiteMetadata),
  component: () => (
    <SiteLayoutShell>
      <McpN8nSitePage />
    </SiteLayoutShell>
  ),
});
