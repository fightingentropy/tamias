import { createLazyFileRoute } from "@tanstack/react-router";
import { StorySitePage } from "@/site/pages/static-pages";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/story")({
  component: StoryPage,
});

function StoryPage() {
  return (
    <SiteLayoutShell>
      <StorySitePage />
    </SiteLayoutShell>
  );
}
