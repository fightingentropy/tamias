import { createLazyFileRoute } from "@tanstack/react-router";
import { InvoicingSitePage } from "@/site/pages/static-pages";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/invoicing")({
  component: InvoicingPage,
});

function InvoicingPage() {
  return (
    <SiteLayoutShell>
      <InvoicingSitePage />
    </SiteLayoutShell>
  );
}
