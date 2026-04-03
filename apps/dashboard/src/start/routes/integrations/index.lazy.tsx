import { createLazyFileRoute } from "@tanstack/react-router";
import { IntegrationsSitePage } from "@/site/pages/integrations-page";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/integrations/")({
  component: IntegrationsPage,
});

function IntegrationsPage() {
  return (
    <SiteLayoutShell>
      <IntegrationsSitePage />
    </SiteLayoutShell>
  );
}
