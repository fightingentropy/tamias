import { createLazyFileRoute } from "@tanstack/react-router";
import { AboutSitePage } from "@/site/pages/about-page";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/about")({
  component: AboutPage,
});

function AboutPage() {
  return (
    <SiteLayoutShell>
      <AboutSitePage />
    </SiteLayoutShell>
  );
}
