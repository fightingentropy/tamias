import { createLazyFileRoute } from "@tanstack/react-router";
import { MCPMake } from "@/site/components/mcp-make";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/mcp/make")({
  component: McpMakePage,
});

function McpMakePage() {
  return (
    <SiteLayoutShell>
      <MCPMake />
    </SiteLayoutShell>
  );
}
