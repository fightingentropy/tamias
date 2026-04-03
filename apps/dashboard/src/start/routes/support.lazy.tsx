import { createLazyFileRoute } from "@tanstack/react-router";
import { SupportSitePage } from "@/site/pages/support-page";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/support")({
  component: SupportPage,
});

function SupportPage() {
  return (
    <SiteLayoutShell>
      <SupportSitePage />
    </SiteLayoutShell>
  );
}
