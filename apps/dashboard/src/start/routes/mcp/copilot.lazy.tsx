import { createLazyFileRoute } from "@tanstack/react-router";
import { McpCopilotSitePage } from "@/site/pages/mcp-pages";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/mcp/copilot")({
  component: McpCopilotPage,
});

function McpCopilotPage() {
  return (
    <SiteLayoutShell>
      <McpCopilotSitePage />
    </SiteLayoutShell>
  );
}
