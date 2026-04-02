"use client";

import { Button } from "@tamias/ui/button";
import { useMediaQuery } from "@tamias/ui/hooks";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@tamias/ui/hover-card";
import { Icons } from "@tamias/ui/icons";
import { useQuery } from "@tanstack/react-query";
import Link from "@/framework/link";
import { useEffect, useMemo, useState } from "react";
import { BankLogo } from "@/components/bank-logo";
import { useTRPC } from "@/trpc/client";
import {
  buildConnectionIssues,
  type ConnectionIssue,
  getHighestSeverity,
} from "@/utils/connection-status";

function IssueLogo({ issue }: { issue: ConnectionIssue }) {
  if (issue.type === "bank") {
    return <BankLogo src={issue.logoUrl ?? null} alt={issue.title} size={20} />;
  }

  // Inbox provider icons
  if (issue.provider === "gmail") {
    return <Icons.Gmail className="size-5" />;
  }
  if (issue.provider === "outlook") {
    return <Icons.Outlook className="size-5" />;
  }

  return null;
}

function IssueRow({ issue }: { issue: ConnectionIssue }) {
  return (
    <Link
      href={issue.path}
      className="flex items-center justify-between gap-3 py-2.5 px-4 hover:bg-accent transition-colors"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="shrink-0">
          <IssueLogo issue={issue} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium truncate">{issue.title}</p>
          <p className="text-[11px] text-muted-foreground">{issue.message}</p>
        </div>
      </div>
      <div className="flex items-center gap-0.5 text-[11px] text-muted-foreground shrink-0">
        {issue.linkText}
        <Icons.ChevronRight className="size-3" />
      </div>
    </Link>
  );
}

// Delay before fetching to avoid being included in initial TRPC batch
const FETCH_DELAY_MS = 500;

function getInitialPageVisibility() {
  if (typeof document === "undefined") {
    return true;
  }

  return document.visibilityState === "visible";
}

export function ConnectionStatus() {
  const trpc = useTRPC();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [shouldFetch, setShouldFetch] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(getInitialPageVisibility);

  useEffect(() => {
    const updateVisibility = () => {
      setIsPageVisible(document.visibilityState === "visible");
    };

    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);

    return () => {
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  useEffect(() => {
    if (!isDesktop || !isPageVisible || shouldFetch) {
      return;
    }

    const timer = window.setTimeout(() => {
      setShouldFetch(true);
    }, FETCH_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [isDesktop, isPageVisible, shouldFetch]);

  const { data, isLoading } = useQuery({
    ...trpc.team.connectionStatus.queryOptions(),
    enabled: isDesktop && isPageVisible && shouldFetch,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const issues = useMemo(() => buildConnectionIssues(data), [data]);
  const severity = getHighestSeverity(issues);

  if (!isDesktop || !shouldFetch || isLoading || issues.length === 0) {
    return null;
  }

  const iconColor = severity === "error" ? "text-[#FF3638]" : "text-[#FFD02B]";

  return (
    <HoverCard openDelay={100} closeDelay={200}>
      <HoverCardTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="rounded-full w-8 h-8 items-center hidden md:flex"
        >
          <Icons.Error size={16} className={iconColor} />
        </Button>
      </HoverCardTrigger>
      <HoverCardContent className="w-[320px] p-0" align="end" sideOffset={10}>
        <div className="px-4 py-2.5 border-b">
          <p className="text-[11px] font-medium text-muted-foreground">
            Connection Issues
          </p>
        </div>
        <div className="max-h-[280px] overflow-y-auto">
          {issues.map((issue) => (
            <IssueRow key={`${issue.type}-${issue.title}`} issue={issue} />
          ))}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
