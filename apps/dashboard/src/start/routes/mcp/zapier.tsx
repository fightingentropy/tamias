import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/mcp/zapier")({
  loader: async () => {
    const { mcpZapierSiteMetadata } = await import("@/site/pages/mcp-metadata");
    return mcpZapierSiteMetadata;
  },
  head: ({ loaderData }) => buildHeadFromMetadata(loaderData),
});
