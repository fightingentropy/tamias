import { createFileRoute } from "@tanstack/react-router";
import {
  McpClaudeSitePage,
  mcpClaudeSiteMetadata,
} from "@/site/pages/mcp-pages";
import { SiteLayoutShell } from "@/start/root-shell";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createFileRoute("/mcp/claude")({
  head: () => buildHeadFromMetadata(mcpClaudeSiteMetadata),
  component: () => (
    <SiteLayoutShell>
      <McpClaudeSitePage />
    </SiteLayoutShell>
  ),
});
