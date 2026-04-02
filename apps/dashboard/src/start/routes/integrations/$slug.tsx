import { createFileRoute } from "@tanstack/react-router";
import { IntegrationDetailPage } from "@/site/components/integration-detail-page";
import { getAppBySlug } from "@/site/data/apps";
import { SiteNotFoundPage } from "@/start/components/site-not-found-page";
import { baseUrl } from "@/site/sitemap";
import { SiteLayoutShell } from "@/start/root-shell";

export const Route = createFileRoute("/integrations/$slug")({
  head: ({ params }) => {
    const app = getAppBySlug(params.slug);

    if (!app) {
      return {
        meta: [
          { title: "Page not found" },
          { name: "robots", content: "noindex,nofollow" },
        ],
      };
    }

    const title = `${app.name} Integration`;
    const description = app.short_description;
    const url = `${baseUrl}/integrations/${params.slug}`;

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
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
