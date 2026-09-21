"use client";

import { Badge } from "@tamias/ui/badge";
import { getBusinessProfile } from "@tamias/contracts/business-type";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@tamias/ui/card";
import { Icons } from "@tamias/ui/icons";
import { Skeleton } from "@tamias/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import Link from "@/framework/link";
import { useTRPC } from "@/trpc/client";
import { useTeamQuery } from "@/hooks/use-team";
import { SelfAssessmentOverview } from "./self-assessment-overview";

function formatDate(value?: string | null) {
  if (!value) {
    return "None";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

type CardStatus = "ready" | "partial" | "inactive";

function statusBorderColor(status: CardStatus) {
  switch (status) {
    case "ready":
      return "border-l-emerald-500";
    case "partial":
      return "border-l-amber-500";
    case "inactive":
      return "border-l-zinc-300 dark:border-l-zinc-600";
  }
}

function statusLabel(status: CardStatus) {
  switch (status) {
    case "ready":
      return "Ready";
    case "partial":
      return "In progress";
    case "inactive":
      return "Not set up";
  }
}

function statusBadgeVariant(status: CardStatus): "default" | "secondary" | "outline" {
  switch (status) {
    case "ready":
      return "default";
    case "partial":
      return "secondary";
    case "inactive":
      return "outline";
  }
}

function ComplianceOverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2 lg:min-w-0 lg:flex-1 lg:max-w-[620px]">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-full max-w-[480px]" />
        </div>
        <Skeleton className="h-8 w-48" />
      </div>

      <Card>
        <CardContent className="grid gap-4 py-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-28" />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-2 w-full rounded-full" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <Skeleton className="h-5 w-28" />
              </div>
              <Skeleton className="h-4 w-full max-w-[320px]" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function ComplianceOverview() {
  const { data: team } = useTeamQuery();
  const profile = getBusinessProfile(team);
  if (team?.countryCode === "GB" && profile.showSelfAssessment)
    return <SelfAssessmentOverview profile={profile} />;
  return <BusinessTaxOverview isLimitedCompany={profile.isLimitedCompany} />;
}

function BusinessTaxOverview({ isLimitedCompany }: { isLimitedCompany: boolean }) {
  const trpc = useTRPC();
  const vatQuery = useQuery(trpc.vat.getDashboard.queryOptions());
  const yearEndQuery = useQuery(trpc.yearEnd.getDashboard.queryOptions());
  const payrollQuery = useQuery(trpc.payroll.getDashboard.queryOptions());

  const isLoading = vatQuery.isLoading && yearEndQuery.isLoading && payrollQuery.isLoading;

  if (isLoading) {
    return <ComplianceOverviewSkeleton />;
  }

  const data = vatQuery.data;
  const profileConfigured = !!data?.profile?.vrn;
  const hmrcConnected = !!data?.connected;
  const payrollImported = (payrollQuery.data?.summary?.importedRunCount ?? 0) > 0;
  const yearEndBuilt = !!yearEndQuery.data?.pack;

  const vatStatus: CardStatus =
    data?.obligationSyncError || vatQuery.isError
      ? "partial"
      : hmrcConnected
        ? "ready"
        : data?.profile
          ? "partial"
          : "inactive";
  const settingsStatus: CardStatus = profileConfigured ? "ready" : "inactive";
  const yearEndStatus: CardStatus = yearEndQuery.data?.pack?.latestExportedAt
    ? "ready"
    : yearEndBuilt
      ? "partial"
      : "inactive";
  const payrollStatus: CardStatus = payrollImported ? "ready" : "inactive";

  const cards = [
    {
      href: "/compliance/vat",
      title: "VAT filing",
      description: hmrcConnected
        ? "Review HMRC obligations, rebuild the draft, and submit the return."
        : "Connect HMRC VAT to sync obligations and submit returns.",
      icon: <Icons.Vat size={18} />,
      status: vatStatus,
      meta:
        data?.obligationSyncError || vatQuery.isError
          ? "HMRC obligations could not be refreshed"
          : data?.latestSubmission
            ? `Latest submission ${data.latestSubmission.periodKey}`
            : data?.obligations?.[0]
              ? `Next due ${formatDate(data.obligations[0].dueDate)}`
              : "No synced obligations yet",
    },
    {
      href: "/compliance/settings",
      title: "Filing settings",
      description: "Set your VRN, UTR, accounting basis, year-end, and agent/client filing mode.",
      icon: <Icons.Settings size={18} />,
      status: settingsStatus,
      meta: data?.profile?.vrn ? `VRN ${data.profile.vrn}` : "Profile not configured",
    },
    {
      href: "/compliance/year-end",
      title: "Year-end",
      description:
        "Build an annual pack from the shared ledger, add manual journals, and export CT prep schedules.",
      icon: <Icons.CalendarMonth size={18} />,
      status: yearEndStatus,
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
      status: payrollStatus,
      meta: payrollQuery.data?.latestRun?.payPeriodEnd
        ? `Latest run ${formatDate(payrollQuery.data.latestRun.payPeriodEnd)}`
        : "No payroll runs imported yet",
    },
  ];

  const stats = [
    {
      label: "VAT status",
      value: hmrcConnected ? "Connected" : data?.profile ? "Not connected" : "No profile",
      dot: hmrcConnected ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-600",
    },
    {
      label: "Next VAT due",
      value: formatDate(data?.obligations?.[0]?.dueDate),
    },
    {
      label: "Payroll runs",
      value: String(payrollQuery.data?.summary?.importedRunCount ?? 0),
    },
    {
      label: "Year-end",
      value: yearEndQuery.data?.pack?.latestExportedAt
        ? "Exported"
        : yearEndBuilt
          ? "Pack built"
          : "Not built",
    },
  ];

  return (
    <div className="mx-auto max-w-[1120px] py-8 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1 lg:min-w-0 lg:flex-1 lg:max-w-[620px]">
          <h1 className="text-3xl font-serif">Tax overview</h1>
          <p className="text-sm text-muted-foreground">
            {isLimitedCompany
              ? "VAT, company year-end records and payroll, when they apply to your business."
              : "Choose the UK tax tools that apply to your business. Your business structure helps us personalise this page."}
          </p>
          {!isLimitedCompany && (
            <Link
              href="/settings#business-profile"
              className="mt-3 inline-block text-sm underline underline-offset-4"
            >
              Set business structure
            </Link>
          )}
        </div>

        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center lg:shrink-0">
          <Badge
            className="h-8 whitespace-nowrap px-3"
            variant={hmrcConnected ? "default" : "secondary"}
          >
            {data?.profile
              ? hmrcConnected
                ? "HMRC VAT connected"
                : "HMRC VAT not connected"
              : "Profile not configured"}
          </Badge>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-4 py-4 grid-cols-2 md:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="space-y-1">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {stat.label}
              </div>
              <div className="flex items-center gap-2">
                {stat.dot ? (
                  <span className={`inline-block h-2 w-2 rounded-full ${stat.dot}`} />
                ) : null}
                <span className="text-sm font-medium">{stat.value}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Each area is optional until it applies to your business. Setup status does not confirm that
        a return is ready to file.
      </p>
      {(vatQuery.isError || yearEndQuery.isError || payrollQuery.isError) && (
        <p role="alert" className="text-sm">
          Some tax information couldn’t be loaded. Refresh to try again.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="block">
            <Card
              className={`border-l-4 ${statusBorderColor(card.status)} cursor-pointer transition-colors hover:border-foreground/20`}
            >
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
                      {card.icon}
                    </div>
                    <CardTitle className="text-lg">{card.title}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusBadgeVariant(card.status)} className="text-xs">
                      {statusLabel(card.status)}
                    </Badge>
                    <Icons.ArrowRightAlt size={16} className="text-muted-foreground" />
                  </div>
                </div>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">{card.meta}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
