import { createLazyFileRoute } from "@tanstack/react-router";
import { TermsPage } from "@/site/pages/legal/terms-page";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/terms")({
  component: TermsRoutePage,
});

function TermsRoutePage() {
  return (
    <SiteLayoutShell>
      <TermsPage />
    </SiteLayoutShell>
  );
}
