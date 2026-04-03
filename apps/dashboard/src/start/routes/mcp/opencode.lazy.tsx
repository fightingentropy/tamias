import { createLazyFileRoute } from "@tanstack/react-router";
import { MCPOpenCode } from "@/site/components/mcp-opencode";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/mcp/opencode")({
  component: McpOpenCodePage,
});

function McpOpenCodePage() {
  return (
    <SiteLayoutShell>
      <MCPOpenCode />
    </SiteLayoutShell>
  );
}
