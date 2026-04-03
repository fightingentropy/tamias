import { createLazyFileRoute } from "@tanstack/react-router";
import { McpCursorSitePage } from "@/site/pages/mcp-pages";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/mcp/cursor")({
  component: McpCursorPage,
});

function McpCursorPage() {
  return (
    <SiteLayoutShell>
      <McpCursorSitePage />
    </SiteLayoutShell>
  );
}
