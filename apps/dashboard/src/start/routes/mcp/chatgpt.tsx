import { createFileRoute } from "@tanstack/react-router";
import {
  McpChatgptSitePage,
  mcpChatgptSiteMetadata,
} from "@/site/pages/mcp-pages";
import { SiteLayoutShell } from "@/start/root-shell";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createFileRoute("/mcp/chatgpt")({
  head: () => buildHeadFromMetadata(mcpChatgptSiteMetadata),
  component: () => (
    <SiteLayoutShell>
      <McpChatgptSitePage />
    </SiteLayoutShell>
  ),
});
