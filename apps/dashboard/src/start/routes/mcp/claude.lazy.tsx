import { createLazyFileRoute } from "@tanstack/react-router";
import { MCPClaude } from "@/site/components/mcp-claude";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/mcp/claude")({
  component: McpClaudePage,
});

function McpClaudePage() {
  return (
    <SiteLayoutShell>
      <MCPClaude />
    </SiteLayoutShell>
  );
}
