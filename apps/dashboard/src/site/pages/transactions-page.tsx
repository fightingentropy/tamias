import { Transactions } from "@/site/components/transactions";
import { createSiteMetadata } from "@/site/page-metadata";

export const transactionsSiteMetadata = createSiteMetadata({
  title: "Transactions",
  description:
    "Track all your business expenses in one place. Automatically sync and categorize transactions from your bank accounts. Built for small business owners.",
  path: "/transactions",
  keywords: [
    "expense tracking",
    "business expenses",
    "transaction management",
    "expense categorization",
    "small business accounting",
  ],
});

export function TransactionsSitePage() {
  return <Transactions />;
}
