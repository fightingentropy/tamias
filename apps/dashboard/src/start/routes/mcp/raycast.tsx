import { createFileRoute } from "@tanstack/react-router";
import {
  McpRaycastSitePage,
  mcpRaycastSiteMetadata,
} from "@/site/pages/mcp-pages";
import { SiteLayoutShell } from "@/start/root-shell";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createFileRoute("/mcp/raycast")({
  head: () => buildHeadFromMetadata(mcpRaycastSiteMetadata),
  component: () => (
    <SiteLayoutShell>
      <McpRaycastSitePage />
    </SiteLayoutShell>
  ),
});
