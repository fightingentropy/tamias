import { createLazyFileRoute } from "@tanstack/react-router";
import { McpOpenCodeSitePage } from "@/site/pages/mcp-pages";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/mcp/opencode")({
  component: McpOpenCodePage,
});

function McpOpenCodePage() {
  return (
    <SiteLayoutShell>
      <McpOpenCodeSitePage />
    </SiteLayoutShell>
  );
}
