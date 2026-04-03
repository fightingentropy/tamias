import { createLazyFileRoute } from "@tanstack/react-router";
import { MCPCopilot } from "@/site/components/mcp-copilot";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/mcp/copilot")({
  component: McpCopilotPage,
});

function McpCopilotPage() {
  return (
    <SiteLayoutShell>
      <MCPCopilot />
    </SiteLayoutShell>
  );
}
