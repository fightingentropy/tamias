"use client";

import { cn } from "@tamias/ui/cn";
import { Skeleton } from "@tamias/ui/skeleton";
import Link from "@/framework/link";
import { Suspense } from "react";
import { ChevronDownIcon, LogoSmallIcon } from "@/start/components/app-shell-icons";
import { MainMenu } from "./main-menu";
import { useSidebar } from "./sidebar-provider";
import { TeamDropdown } from "./team-dropdown";

function TeamDropdownSkeleton({ isExpanded }: { isExpanded: boolean }) {
  return (
    <div className="relative h-[32px]">
      <div className="fixed left-[19px] bottom-4 w-[32px] h-[32px]">
        <Skeleton className="w-[32px] h-[32px] rounded-none" />
      </div>
      {isExpanded && (
        <div className="fixed left-[62px] bottom-4 h-[32px] flex items-center">
          <Skeleton className="h-4 w-24" />
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const { expanded: isExpanded, toggle } = useSidebar();

  return (
    <aside
      className={cn(
        "h-screen flex-shrink-0 flex-col justify-between fixed top-0 pb-4 items-center hidden md:flex z-50 transition-all duration-200 ease-&lsqb;cubic-bezier(0.4,0,0.2,1)&rsqb;",
        "bg-background border-r border-border",
        isExpanded ? "w-[232px]" : "w-[70px]",
      )}
      aria-label="Workspace navigation"
    >
      <div
        className={cn(
          "absolute top-0 left-0 h-[70px] flex items-center justify-center bg-background border-b border-border transition-all duration-200 ease-&lsqb;cubic-bezier(0.4,0,0.2,1)&rsqb;",
          isExpanded ? "w-full" : "w-[69px]",
        )}
      >
        <Link
          href="/dashboard"
          aria-label="Tamias home"
          className="absolute left-[22px] flex items-center gap-3 transition-none"
        >
          <LogoSmallIcon />
          {isExpanded && <span className="font-serif text-xl">Tamias</span>}
        </Link>
      </div>

      <div className="flex flex-col w-full pt-[70px] flex-1 min-h-0 overflow-y-auto border-b border-border mb-3">
        <MainMenu isExpanded={isExpanded} />
      </div>

      <button
        type="button"
        onClick={toggle}
        aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
        aria-expanded={isExpanded}
        className="mb-4 mx-3 flex h-9 shrink-0 items-center gap-3 self-stretch px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <span className={cn("shrink-0", isExpanded ? "rotate-90" : "-rotate-90")}>
          <ChevronDownIcon size={18} />
        </span>
        {isExpanded && <span>Collapse sidebar</span>}
      </button>

      <Suspense fallback={<TeamDropdownSkeleton isExpanded={isExpanded} />}>
        <TeamDropdown isExpanded={isExpanded} />
      </Suspense>
    </aside>
  );
}
