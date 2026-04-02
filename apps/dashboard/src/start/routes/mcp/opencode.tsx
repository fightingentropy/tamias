import { createFileRoute } from "@tanstack/react-router";
import {
  McpOpenCodeSitePage,
  mcpOpenCodeSiteMetadata,
} from "@/site/pages/mcp-pages";
import { SiteLayoutShell } from "@/start/root-shell";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createFileRoute("/mcp/opencode")({
  head: () => buildHeadFromMetadata(mcpOpenCodeSiteMetadata),
  component: () => (
    <SiteLayoutShell>
      <McpOpenCodeSitePage />
    </SiteLayoutShell>
  ),
});
