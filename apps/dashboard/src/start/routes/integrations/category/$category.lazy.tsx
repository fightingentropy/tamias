import { createLazyFileRoute } from "@tanstack/react-router";
import { IntegrationsGrid } from "@/site/components/integrations-grid";
import { categories, getAppsByCategory } from "@/site/data/apps";
import { SiteNotFoundPage } from "@/start/components/site-not-found-page";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

const validCategories = categories
  .filter((category) => category.id !== "all")
  .map((category) => category.id);

export const Route = createLazyFileRoute("/integrations/category/$category")({
  component: IntegrationCategoryRoute,
});

function IntegrationCategoryRoute() {
  const { category } = Route.useParams();

  if (!validCategories.includes(category)) {
    return <SiteNotFoundPage />;
  }

  return (
    <SiteLayoutShell>
      <IntegrationsGrid
        apps={getAppsByCategory(category)}
        activeCategory={category}
      />
    </SiteLayoutShell>
  );
}
