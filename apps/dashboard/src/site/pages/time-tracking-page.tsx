import { TimeTracking } from "@/site/components/time-tracking";
import { createSiteMetadata } from "@/site/page-metadata";

export const timeTrackingSiteMetadata = createSiteMetadata({
  title: "Time Tracking",
  description:
    "Track billable hours with ease. Get monthly breakdowns, link time to projects and customers, and generate invoices. Built for consultants and small business owners.",
  path: "/time-tracking",
  keywords: [
    "time tracking",
    "billable hours",
    "time tracker",
    "project time tracking",
    "small business time management",
  ],
});

export function TimeTrackingSitePage() {
  return <TimeTracking />;
}
