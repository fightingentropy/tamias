"use client";

import { useMemo } from "react";

type MiniLinePoint = {
  value: number;
};

type MiniBarPoint = {
  value: number;
};

type MiniChartProps = {
  className?: string;
};

export function MiniLineChart({
  data,
  className,
}: MiniChartProps & { data: MiniLinePoint[] }) {
  const points = useMemo(() => {
    if (data.length === 0) {
      return "";
    }

    const width = 100;
    const height = 32;
    const minValue = Math.min(...data.map((item) => item.value));
    const maxValue = Math.max(...data.map((item) => item.value));
    const range = maxValue - minValue || 1;

    return data
      .map((item, index) => {
        const x =
          data.length === 1 ? width / 2 : (index / (data.length - 1)) * width;
        const y = height - ((item.value - minValue) / range) * (height - 2) - 1;
        return `${x},${y}`;
      })
      .join(" ");
  }, [data]);

  if (data.length === 0) {
    return null;
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      className={className}
    >
      <polyline
        fill="none"
        points={points}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MiniBarChart({
  data,
  className,
}: MiniChartProps & { data: MiniBarPoint[] }) {
  const chart = useMemo(() => {
    if (data.length === 0) {
      return null;
    }

    const width = 100;
    const height = 40;
    const minValue = Math.min(0, ...data.map((item) => item.value));
    const maxValue = Math.max(0, ...data.map((item) => item.value));
    const range = maxValue - minValue || 1;
    const gap = 2;
    const barWidth = Math.max(3, width / data.length - gap);
    const zeroY = height - ((0 - minValue) / range) * height;

    const bars = data.map((item, index) => {
      const normalized = (item.value - minValue) / range;
      const yValue = height - normalized * height;
      const x = index * (barWidth + gap);
      const y = item.value >= 0 ? yValue : zeroY;
      const barHeight = Math.max(1.5, Math.abs(zeroY - yValue));

      return {
        x,
        y,
          height: barHeight,
      };
    });

    return { bars, barWidth, zeroY };
  }, [data]);

  if (!chart) {
    return null;
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      className={className}
    >
      <line
        x1="0"
        x2="100"
        y1={chart.zeroY}
        y2={chart.zeroY}
        stroke="hsl(var(--border))"
        strokeDasharray="3 3"
        strokeWidth="1"
      />
      {chart.bars.map((bar, index) => (
        <rect
          key={`mini-bar-${index.toString()}`}
          x={bar.x}
          y={bar.y}
          width={Math.max(1.5, Math.min(100 - bar.x, chart.barWidth))}
          height={bar.height}
          rx="1"
          fill="currentColor"
        />
      ))}
    </svg>
  );
}
