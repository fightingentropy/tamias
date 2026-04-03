import { createLazyFileRoute } from "@tanstack/react-router";
import { PolicyPage } from "@/site/pages/legal/policy-page";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/policy")({
  component: PolicyRoutePage,
});

function PolicyRoutePage() {
  return (
    <SiteLayoutShell>
      <PolicyPage />
    </SiteLayoutShell>
  );
}
