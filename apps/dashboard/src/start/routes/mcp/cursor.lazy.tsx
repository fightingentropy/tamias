import { createLazyFileRoute } from "@tanstack/react-router";
import { MCPCursor } from "@/site/components/mcp-cursor";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/mcp/cursor")({
  component: McpCursorPage,
});

function McpCursorPage() {
  return (
    <SiteLayoutShell>
      <MCPCursor />
    </SiteLayoutShell>
  );
}
