import { createLazyFileRoute } from "@tanstack/react-router";
import { MCPPerplexity } from "@/site/components/mcp-perplexity";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/mcp/perplexity")({
  component: McpPerplexityPage,
});

function McpPerplexityPage() {
  return (
    <SiteLayoutShell>
      <MCPPerplexity />
    </SiteLayoutShell>
  );
}
