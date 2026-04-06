"use client";

import { cn } from "@tamias/ui/cn";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTRPC } from "@/trpc/client";

const CYCLE_INTERVAL = 6000; // 6 seconds per insight

function getPeriodLabel(periodType: string, periodYear: number, periodNumber: number): string {
  switch (periodType) {
    case "weekly":
      return `Week ${periodNumber}, ${periodYear}`;
    case "monthly": {
      const monthName = format(new Date(periodYear, periodNumber - 1), "MMMM");
      return `${monthName} ${periodYear}`;
    }
    case "quarterly":
      return `Q${periodNumber} ${periodYear}`;
    case "yearly":
      return `${periodYear} Year in Review`;
    default:
      return `${periodType} ${periodNumber}, ${periodYear}`;
  }
}

export function SummaryTicker() {
  const trpc = useTRPC();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data, isLoading } = useQuery(
    trpc.insights.list.queryOptions({
      periodType: "weekly",
      limit: 5,
      includeDismissed: false,
    }),
  );

  const insights =
    data?.data?.map((insight) => ({
      id: insight.id,
      label: getPeriodLabel(insight.periodType, insight.periodYear, insight.periodNumber),
      title: insight.title ?? "",
      story: insight.content?.story ?? "",
    })) ?? [];

  const count = insights.length;

  const advance = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % Math.max(count, 1));
    setProgress(0);
  }, [count]);

  // Auto-cycle timer
  useEffect(() => {
    if (isPaused || count <= 1) return;

    intervalRef.current = setInterval(advance, CYCLE_INTERVAL);
    progressRef.current = setInterval(() => {
      setProgress((p) => Math.min(p + 100 / (CYCLE_INTERVAL / 50), 100));
    }, 50);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, [isPaused, count, advance]);

  // Reset progress on index change
  useEffect(() => {
    setProgress(0);
  }, [activeIndex]);

  if (isLoading) {
    return null;
  }

  if (count === 0) {
    return (
      <p className="mt-2 text-sm text-[#878787]">
        You're all caught up. Nothing needs your attention right now.
      </p>
    );
  }

  const current = insights[activeIndex % count];
  if (!current) return null;

  const displayText = current.title || current.story?.slice(0, 120) || current.label;

  return (
    <div
      className="mt-2 max-w-xl mx-auto"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <AnimatePresence mode="wait">
        <motion.p
          key={current.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
          className="text-sm text-[#878787] leading-relaxed"
        >
          {displayText}
        </motion.p>
      </AnimatePresence>

      {count > 1 && (
        <div className="flex gap-1.5 mt-3">
          {insights.map((insight, i) => (
            <button
              key={insight.id}
              type="button"
              className="h-[2px] flex-1 bg-[#e6e6e6] dark:bg-[#1d1d1d] overflow-hidden cursor-pointer"
              onClick={() => {
                setActiveIndex(i);
                setProgress(0);
              }}
            >
              <div
                className={cn(
                  "h-full bg-[#878787] transition-all",
                  i === activeIndex % count ? "duration-100" : "duration-0",
                )}
                style={{
                  width: i === activeIndex % count ? `${progress}%` : i < activeIndex % count ? "100%" : "0%",
                }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
