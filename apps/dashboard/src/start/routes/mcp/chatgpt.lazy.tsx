import { createLazyFileRoute } from "@tanstack/react-router";
import { McpChatgptSitePage } from "@/site/pages/mcp-pages";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/mcp/chatgpt")({
  component: McpChatgptPage,
});

function McpChatgptPage() {
  return (
    <SiteLayoutShell>
      <McpChatgptSitePage />
    </SiteLayoutShell>
  );
}
