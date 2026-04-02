import { createFileRoute } from "@tanstack/react-router";
import {
  McpZapierSitePage,
  mcpZapierSiteMetadata,
} from "@/site/pages/mcp-pages";
import { SiteLayoutShell } from "@/start/root-shell";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createFileRoute("/mcp/zapier")({
  head: () => buildHeadFromMetadata(mcpZapierSiteMetadata),
  component: () => (
    <SiteLayoutShell>
      <McpZapierSitePage />
    </SiteLayoutShell>
  ),
});
