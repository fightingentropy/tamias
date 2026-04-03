import { IntegrationsGrid } from "@/site/components/integrations-grid";
import { apps } from "@/site/data/apps";
import { createSiteMetadata } from "@/site/page-metadata";

export const integrationsSiteMetadata = createSiteMetadata({
  title: "Integrations",
  description:
    "Connect Tamias with your favorite tools. Explore integrations for email, accounting, productivity, and more.",
  path: "/integrations",
});

export function IntegrationsSitePage() {
  return <IntegrationsGrid apps={apps} activeCategory="all" />;
}
