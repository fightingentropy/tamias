"use client";

import dynamic from "next/dynamic";

export const YearEndDashboardClient = dynamic(
  () =>
    import("@/components/compliance/year-end-dashboard").then(
      (mod) => mod.YearEndDashboard,
    ),
  { ssr: false },
);
