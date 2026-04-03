import { createLazyFileRoute } from "@tanstack/react-router";
import { McpZapierSitePage } from "@/site/pages/mcp-pages";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/mcp/zapier")({
  component: McpZapierPage,
});

function McpZapierPage() {
  return (
    <SiteLayoutShell>
      <McpZapierSitePage />
    </SiteLayoutShell>
  );
}
