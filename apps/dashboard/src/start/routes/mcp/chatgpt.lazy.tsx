import { createLazyFileRoute } from "@tanstack/react-router";
import { MCPChatGPT } from "@/site/components/mcp-chatgpt";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/mcp/chatgpt")({
  component: McpChatgptPage,
});

function McpChatgptPage() {
  return (
    <SiteLayoutShell>
      <MCPChatGPT />
    </SiteLayoutShell>
  );
}
