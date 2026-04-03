import { IntegrationsGrid } from "@/site/components/integrations-grid";
import { appCatalog } from "@/site/data/app-catalog";

export function IntegrationsSitePage() {
  return <IntegrationsGrid apps={appCatalog} activeCategory="all" />;
}
