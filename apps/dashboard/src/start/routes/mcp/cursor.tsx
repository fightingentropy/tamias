import { createFileRoute } from "@tanstack/react-router";
import {
  McpCursorSitePage,
  mcpCursorSiteMetadata,
} from "@/site/pages/mcp-pages";
import { SiteLayoutShell } from "@/start/root-shell";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createFileRoute("/mcp/cursor")({
  head: () => buildHeadFromMetadata(mcpCursorSiteMetadata),
  component: () => (
    <SiteLayoutShell>
      <McpCursorSitePage />
    </SiteLayoutShell>
  ),
});
