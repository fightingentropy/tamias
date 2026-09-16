"use client";

import { Skeleton } from "@tamias/ui/skeleton";
import Link from "@/framework/link";

interface OverviewMetricCardProps {
  label: string;
  value: React.ReactNode;
  detail?: string;
  href: string;
  isLoading?: boolean;
}

export function OverviewMetricCard({
  label,
  value,
  detail,
  href,
  isLoading,
}: OverviewMetricCardProps) {
  if (isLoading) {
    return (
      <div className="h-full border p-5 flex flex-col justify-between bg-card border-border min-h-[110px]">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className="mt-3">
          <Skeleton className="h-6 w-24" />
        </div>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="h-full border p-5 flex flex-col justify-between transition-colors bg-card border-border hover:bg-accent hover:border-muted-foreground/40 cursor-pointer group min-h-[110px]"
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="mt-3">
        <span className="text-2xl font-medium tabular-nums">{value}</span>
        {detail ? <span className="mt-1 block text-sm text-muted-foreground">{detail}</span> : null}
      </div>
    </Link>
  );
}
