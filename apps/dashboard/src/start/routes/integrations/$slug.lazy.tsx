import { createLazyFileRoute } from "@tanstack/react-router";
import { IntegrationDetailPage } from "@/site/components/integration-detail-page";
import { getAppBySlug } from "@/site/data/apps";
import { SiteNotFoundPage } from "@/start/components/site-not-found-page";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/integrations/$slug")({
  component: IntegrationDetailRoute,
});

function IntegrationDetailRoute() {
  const { slug } = Route.useParams();
  const app = getAppBySlug(slug);

  if (!app) {
    return <SiteNotFoundPage />;
  }

  return (
    <SiteLayoutShell>
      <IntegrationDetailPage app={app} />
    </SiteLayoutShell>
  );
}
