import { createLazyFileRoute } from "@tanstack/react-router";
import { MCPN8n } from "@/site/components/mcp-n8n";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/mcp/n8n")({
  component: McpN8nPage,
});

function McpN8nPage() {
  return (
    <SiteLayoutShell>
      <MCPN8n />
    </SiteLayoutShell>
  );
}
