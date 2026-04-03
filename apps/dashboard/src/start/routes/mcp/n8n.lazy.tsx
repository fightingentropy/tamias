import { createLazyFileRoute } from "@tanstack/react-router";
import { McpN8nSitePage } from "@/site/pages/mcp-pages";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/mcp/n8n")({
  component: McpN8nPage,
});

function McpN8nPage() {
  return (
    <SiteLayoutShell>
      <McpN8nSitePage />
    </SiteLayoutShell>
  );
}
