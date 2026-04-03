import { createLazyFileRoute } from "@tanstack/react-router";
import { CompareSitePage } from "@/site/pages/static-pages";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/compare/")({
  component: ComparePage,
});

function ComparePage() {
  return (
    <SiteLayoutShell>
      <CompareSitePage />
    </SiteLayoutShell>
  );
}
