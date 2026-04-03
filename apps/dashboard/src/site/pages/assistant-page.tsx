import { Assistant } from "@/site/components/assistant";
import { createSiteMetadata } from "@/site/page-metadata";

export const assistantSiteMetadata = createSiteMetadata({
  title: "AI Assistant",
  description:
    "Your AI-powered business assistant. Ask questions about your business and get clear, actionable answers based on your real business data.",
  path: "/assistant",
});

export function AssistantSitePage() {
  return <Assistant />;
}
