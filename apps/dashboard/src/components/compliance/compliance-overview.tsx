"use client";

import { Badge } from "@tamias/ui/badge";
import { Button } from "@tamias/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@tamias/ui/card";
import { Icons } from "@tamias/ui/icons";
import { useQuery } from "@tanstack/react-query";
import Link from "@/framework/link";
import { useTRPC } from "@/trpc/client";

function formatDate(value?: string | null) {
  if (!value) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function ComplianceOverview() {
  const trpc = useTRPC();
  const { data, isLoading } = useQuery(trpc.vat.getDashboard.queryOptions());
  const yearEndQuery = useQuery(trpc.yearEnd.getDashboard.queryOptions());
  const payrollQuery = useQuery(trpc.payroll.getDashboard.queryOptions());

  if (isLoading) {
    return (
      <div className="text-sm text-[#606060]">Loading compliance data...</div>
    );
  }

  const cards = [
    {
      href: "/compliance/vat",
      title: "VAT filing",
      description: data?.connected
        ? "Review HMRC obligations, rebuild the draft, and submit the return."
        : "Connect HMRC VAT to sync obligations and submit returns.",
      icon: <Icons.Vat size={18} />,
      meta: data?.latestSubmission
        ? `Latest submission ${data.latestSubmission.periodKey}`
        : data?.obligations?.[0]
          ? `Next due ${formatDate(data.obligations[0].dueDate)}`
          : "No synced obligations yet",
    },
    {
      href: "/compliance/settings",
      title: "Filing settings",
      description:
        "Set your VRN, UTR, accounting basis, year-end, and agent/client filing mode.",
      icon: <Icons.Settings size={18} />,
      meta: data?.profile?.vrn
        ? `VRN ${data.profile.vrn}`
        : "Profile not configured",
    },
    {
      href: "/compliance/year-end",
      title: "Year-end",
      description:
        "Build an annual pack from the shared ledger, add manual journals, and export CT prep schedules.",
      icon: <Icons.CalendarMonth size={18} />,
      meta: yearEndQuery.data?.pack?.latestExportedAt
        ? `Latest export ${formatDate(yearEndQuery.data.pack.latestExportedAt)}`
        : yearEndQuery.data?.period?.accountsDueDate
          ? `Accounts due ${formatDate(yearEndQuery.data.period.accountsDueDate)}`
          : "Annual pack not built yet",
    },
    {
      href: "/compliance/payroll",
      title: "Payroll",
      description:
        "Import payroll journals, track PAYE liability totals, and export payroll packs.",
      icon: <Icons.Accounts size={18} />,
      meta: payrollQuery.data?.latestRun?.payPeriodEnd
        ? `Latest run ${formatDate(payrollQuery.data.latestRun.payPeriodEnd)}`
        : "No payroll runs imported yet",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1 lg:min-w-0 lg:flex-1 lg:max-w-[620px]">
          <h1 className="text-2xl font-medium">Compliance</h1>
          <p className="text-sm text-[#606060]">
            UK Ltd compliance now spans VAT, annual year-end packs with CT prep,
            and payroll import workflows for GB teams and enabled UK filing
            profiles.
          </p>
        </div>

        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center lg:shrink-0">
          <Badge
            className="h-8 whitespace-nowrap px-3"
            variant={data?.connected ? "default" : "secondary"}
          >
            {data?.profile
              ? data?.connected
                ? "HMRC VAT connected"
                : "HMRC VAT not connected"
              : "Profile not configured"}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <Card key={card.href}>
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {card.icon}
                  <CardTitle className="text-lg">{card.title}</CardTitle>
                </div>
                <Icons.ArrowRightAlt size={16} />
              </div>
              <CardDescription>{card.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <div className="text-sm text-[#606060]">{card.meta}</div>
              <Button asChild size="sm" variant="ghost">
                <Link href={card.href}>Open</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
