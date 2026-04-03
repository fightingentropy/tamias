import { createLazyFileRoute } from "@tanstack/react-router";
import { McpSitePage } from "@/site/pages/mcp-pages";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/mcp/")({
  component: McpPage,
});

function McpPage() {
  return (
    <SiteLayoutShell>
      <McpSitePage />
    </SiteLayoutShell>
  );
}
