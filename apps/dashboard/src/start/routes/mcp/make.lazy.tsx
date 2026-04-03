import { createLazyFileRoute } from "@tanstack/react-router";
import { McpMakeSitePage } from "@/site/pages/mcp-pages";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/mcp/make")({
  component: McpMakePage,
});

function McpMakePage() {
  return (
    <SiteLayoutShell>
      <McpMakeSitePage />
    </SiteLayoutShell>
  );
}
