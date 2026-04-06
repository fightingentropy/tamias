"use client";

import dynamic from "@/framework/dynamic";

export const YearEndDashboardClient = dynamic(
  () => import("@/components/compliance/year-end-dashboard").then((mod) => mod.YearEndDashboard),
  { ssr: false },
);
