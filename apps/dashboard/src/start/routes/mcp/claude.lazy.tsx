import { createLazyFileRoute } from "@tanstack/react-router";
import { McpClaudeSitePage } from "@/site/pages/mcp-pages";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/mcp/claude")({
  component: McpClaudePage,
});

function McpClaudePage() {
  return (
    <SiteLayoutShell>
      <McpClaudeSitePage />
    </SiteLayoutShell>
  );
}
