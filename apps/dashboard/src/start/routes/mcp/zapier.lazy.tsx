import { createLazyFileRoute } from "@tanstack/react-router";
import { MCPZapier } from "@/site/components/mcp-zapier";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/mcp/zapier")({
  component: McpZapierPage,
});

function McpZapierPage() {
  return (
    <SiteLayoutShell>
      <MCPZapier />
    </SiteLayoutShell>
  );
}
