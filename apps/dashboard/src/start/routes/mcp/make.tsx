import { createFileRoute } from "@tanstack/react-router";
import {
  McpMakeSitePage,
  mcpMakeSiteMetadata,
} from "@/site/pages/mcp-pages";
import { SiteLayoutShell } from "@/start/root-shell";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createFileRoute("/mcp/make")({
  head: () => buildHeadFromMetadata(mcpMakeSiteMetadata),
  component: () => (
    <SiteLayoutShell>
      <McpMakeSitePage />
    </SiteLayoutShell>
  ),
});
