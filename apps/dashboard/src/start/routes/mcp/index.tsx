import { createFileRoute } from "@tanstack/react-router";
import { McpSitePage, mcpSiteMetadata } from "@/site/pages/mcp-pages";
import { SiteLayoutShell } from "@/start/root-shell";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createFileRoute("/mcp/")({
  head: () => buildHeadFromMetadata(mcpSiteMetadata),
  component: () => (
    <SiteLayoutShell>
      <McpSitePage />
    </SiteLayoutShell>
  ),
});
