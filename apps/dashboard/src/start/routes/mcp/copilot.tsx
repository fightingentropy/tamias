import { createFileRoute } from "@tanstack/react-router";
import {
  McpCopilotSitePage,
  mcpCopilotSiteMetadata,
} from "@/site/pages/mcp-pages";
import { SiteLayoutShell } from "@/start/root-shell";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createFileRoute("/mcp/copilot")({
  head: () => buildHeadFromMetadata(mcpCopilotSiteMetadata),
  component: () => (
    <SiteLayoutShell>
      <McpCopilotSitePage />
    </SiteLayoutShell>
  ),
});
