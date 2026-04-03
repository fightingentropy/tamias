import { baseUrl } from "@/site/base-url";
import { categories, getAllAppCatalogSlugs } from "@/site/data/app-catalog";
import { getAllCompetitorSlugs } from "@/site/data/competitors";
import { getSortedBlogPostPreviews } from "@/site/lib/blog-metadata";
import { getAllDocSlugs } from "@/site/lib/docs-metadata";
import type { SiteSitemapEntry } from "@/site/metadata";

export default async function sitemap(): Promise<SiteSitemapEntry[]> {
  const lastModified = new Date().toISOString().slice(0, 10);

  const staticRoutes = [
    "",
    "/about",
    "/assistant",
    "/bank-coverage",
    "/compare",
    "/customers",
    "/docs",
    "/file-storage",
    "/inbox",
    "/insights",
    "/integrations",
    "/invoicing",
    "/mcp",
    "/mcp/chatgpt",
    "/mcp/claude",
    "/mcp/copilot",
    "/mcp/cursor",
    "/mcp/make",
    "/mcp/n8n",
    "/mcp/opencode",
    "/mcp/perplexity",
    "/mcp/raycast",
    "/mcp/zapier",
    "/pre-accounting",
    "/pricing",
    "/policy",
    "/story",
    "/support",
    "/terms",
    "/time-tracking",
    "/transactions",
    "/updates",
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified,
  }));

  const blogPosts = getSortedBlogPostPreviews().map((post) => ({
    url: `${baseUrl}/updates/${post.slug}`,
    lastModified: post.metadata.publishedAt ?? lastModified,
  }));

  const integrations = getAllAppCatalogSlugs().map((slug) => ({
    url: `${baseUrl}/integrations/${slug}`,
    lastModified,
  }));

  const integrationCategories = categories
    .filter((category) => category.id !== "all")
    .map((category) => ({
      url: `${baseUrl}/integrations/category/${category.id}`,
      lastModified,
    }));

  const docPages = getAllDocSlugs().map((slug) => ({
    url: `${baseUrl}/docs/${slug}`,
    lastModified,
  }));

  const comparisonPages = getAllCompetitorSlugs().map((slug) => ({
    url: `${baseUrl}/compare/${slug}`,
    lastModified,
  }));

  return [
    ...staticRoutes,
    ...blogPosts,
    ...integrations,
    ...integrationCategories,
    ...docPages,
    ...comparisonPages,
  ];
}
