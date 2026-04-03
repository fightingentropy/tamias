import { createLazyFileRoute } from "@tanstack/react-router";
import { AssistantSitePage } from "@/site/pages/assistant-page";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/assistant")({
  component: AssistantPage,
});

function AssistantPage() {
  return (
    <SiteLayoutShell>
      <AssistantSitePage />
    </SiteLayoutShell>
  );
}
