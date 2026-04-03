import { createLazyFileRoute } from "@tanstack/react-router";
import { McpPerplexitySitePage } from "@/site/pages/mcp-pages";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/mcp/perplexity")({
  component: McpPerplexityPage,
});

function McpPerplexityPage() {
  return (
    <SiteLayoutShell>
      <McpPerplexitySitePage />
    </SiteLayoutShell>
  );
}
