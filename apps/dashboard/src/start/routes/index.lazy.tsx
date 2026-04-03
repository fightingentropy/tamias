import { createLazyFileRoute } from "@tanstack/react-router";
import { StartPage } from "@/site/components/startpage";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  return (
    <SiteLayoutShell>
      <StartPage />
    </SiteLayoutShell>
  );
}
