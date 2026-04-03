import { createLazyFileRoute } from "@tanstack/react-router";
import { IntegrationsGrid } from "@/site/components/integrations-grid";
import { categories, getAppSummariesByCategory } from "@/site/data/app-catalog";
import { SiteNotFoundPage } from "@/start/components/site-not-found-page";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

const validCategories: string[] = categories
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
        apps={getAppSummariesByCategory(category)}
        activeCategory={category}
      />
    </SiteLayoutShell>
  );
}
