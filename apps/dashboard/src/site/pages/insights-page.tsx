import { Insights } from "@/site/components/insights";
import { createSiteMetadata } from "@/site/page-metadata";

export const insightsSiteMetadata = createSiteMetadata({
  title: "Business Insights",
  description:
    "Understand your business at a glance. Get weekly summaries, cash flow analysis, and clear explanations of revenue and spending trends.",
  path: "/insights",
  keywords: [
    "business insights",
    "business analytics",
    "cash flow analysis",
    "revenue tracking",
    "spending analysis",
  ],
});

export function InsightsSitePage() {
  return <Insights />;
}
