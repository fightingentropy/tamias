import { BankCoverage } from "@/site/components/bank-coverage";
import { createSiteMetadata } from "@/site/page-metadata";

export const bankCoverageSiteMetadata = createSiteMetadata({
  title: "Bank Coverage",
  description:
    "We currently support over 25,000+ banks worldwide. Search to find your bank and connect your accounts to Tamias.",
  path: "/bank-coverage",
});

export function BankCoverageSitePage() {
  return <BankCoverage />;
}
