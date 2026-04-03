import { createLazyFileRoute } from "@tanstack/react-router";
import { MCP } from "@/site/components/mcp";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/mcp/")({
  component: McpPage,
});

function McpPage() {
  return (
    <SiteLayoutShell>
      <MCP />
    </SiteLayoutShell>
  );
}
