import { createLazyFileRoute } from "@tanstack/react-router";
import { MCPRaycast } from "@/site/components/mcp-raycast";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/mcp/raycast")({
  component: McpRaycastPage,
});

function McpRaycastPage() {
  return (
    <SiteLayoutShell>
      <MCPRaycast />
    </SiteLayoutShell>
  );
}
