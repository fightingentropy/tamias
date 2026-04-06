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
      <div className="h-full border p-5 flex flex-col justify-between bg-white border-[#e6e6e6] dark:bg-[#0c0c0c] dark:border-[#1d1d1d] min-h-[110px]">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="mt-3">
          <Skeleton className="h-6 w-24" />
        </div>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="h-full border p-5 flex flex-col justify-between transition-all duration-300 bg-white border-[#e6e6e6] hover:bg-[#f7f7f7] hover:border-[#d0d0d0] dark:bg-[#0c0c0c] dark:border-[#1d1d1d] dark:hover:bg-[#0f0f0f] dark:hover:border-[#222222] cursor-pointer group min-h-[110px]"
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="mt-3">
        <span className="text-xl font-medium">{value}</span>
        {detail ? (
          <span className="text-xs text-muted-foreground ml-2">{detail}</span>
        ) : null}
      </div>
    </Link>
  );
}
