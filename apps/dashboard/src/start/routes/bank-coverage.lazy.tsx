import { createLazyFileRoute } from "@tanstack/react-router";
import { BankCoverageSitePage } from "@/site/pages/bank-coverage-page";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/bank-coverage")({
  component: BankCoveragePage,
});

function BankCoveragePage() {
  return (
    <SiteLayoutShell>
      <BankCoverageSitePage />
    </SiteLayoutShell>
  );
}
