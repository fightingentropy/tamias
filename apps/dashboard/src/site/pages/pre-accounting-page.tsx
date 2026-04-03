import { PreAccounting } from "@/site/components/pre-accounting";
import { createSiteMetadata } from "@/site/page-metadata";

export const preAccountingSiteMetadata = createSiteMetadata({
  title: "Pre-Accounting",
  description:
    "Automated bookkeeping that collects transactions, matches receipts, and prepares accountant-ready records. Save hours on manual data entry every month.",
  path: "/pre-accounting",
  keywords: [
    "bookkeeping software",
    "small business bookkeeping",
    "automated bookkeeping",
    "pre-accounting",
    "accountant-ready records",
  ],
});

export function PreAccountingSitePage() {
  return <PreAccounting />;
}
