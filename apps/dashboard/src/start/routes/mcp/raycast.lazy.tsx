import { createLazyFileRoute } from "@tanstack/react-router";
import { McpRaycastSitePage } from "@/site/pages/mcp-pages";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/mcp/raycast")({
  component: McpRaycastPage,
});

function McpRaycastPage() {
  return (
    <SiteLayoutShell>
      <McpRaycastSitePage />
    </SiteLayoutShell>
  );
}
