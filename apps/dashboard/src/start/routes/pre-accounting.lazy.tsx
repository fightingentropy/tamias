import { createLazyFileRoute } from "@tanstack/react-router";
import { PreAccountingSitePage } from "@/site/pages/pre-accounting-page";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/pre-accounting")({
  component: PreAccountingPage,
});

function PreAccountingPage() {
  return (
    <SiteLayoutShell>
      <PreAccountingSitePage />
    </SiteLayoutShell>
  );
}
