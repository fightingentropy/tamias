import { SupportForm } from "@/site/components/support-form";
import { createSiteMetadata } from "@/site/page-metadata";

export const supportSiteMetadata = createSiteMetadata({
  title: "Support",
  description:
    "Get help with Tamias. Contact our team for assistance with any questions or issues you may have.",
  path: "/support",
});

export function SupportSitePage() {
  return <SupportForm />;
}
