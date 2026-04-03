"use client";

import { useId } from "react";

type SimpleDatum = {
  label: string;
  value: number;
};

type ComparisonDatum = {
  label: string;
  primary: number;
  secondary: number;
};

type ForecastDatum = {
  label: string;
  actual: number | null;
  forecasted: number | null;
};

type StackedDatum = {
  label: string;
  total: number;
  recurring: number;
};

type RunwayDatum = {
  label: string;
  value: number;
};

type DonutDatum = {
  label: string;
  value: number;
};

type SeriesDatum = {
  label: string;
  [key: string]: string | number | null | undefined;
};

type LineSeries = {
  key: string;
  color: string;
  dashed?: boolean;
  dotted?: boolean;
  width?: number;
};

type BarSeries = {
  key: string;
  color: string;
  opacity?: number;
  pattern?: "diagonal";
};

const SVG_WIDTH = 720;
const SVG_HEIGHT = 320;
const MARGIN = { top: 16, right: 12, bottom: 28, left: 12 };
const CHART_WIDTH = SVG_WIDTH - MARGIN.left - MARGIN.right;
const CHART_HEIGHT = SVG_HEIGHT - MARGIN.top - MARGIN.bottom;

export const publicChartGrayShades = [
  "#C6C6C6",
  "#A8A8A8",
  "#8B8B8B",
  "#707070",
  "#545454",
];

function getStep(count: number) {
  if (count <= 6) return 1;
  if (count <= 10) return 2;
  return 3;
}

function getRange(values: number[], includeZero = false) {
  if (values.length === 0) {
    return { min: 0, max: 1 };
  }

  let min = Math.min(...values);
  let max = Math.max(...values);

  if (includeZero) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }

  if (min === max) {
    if (min === 0) {
      max = 1;
    } else {
      const padding = Math.abs(min) * 0.2;
      min -= padding;
      max += padding;
    }
  }

  return { min, max };
}

function valueToY(value: number, min: number, max: number) {
  const ratio = (value - min) / (max - min);
  return MARGIN.top + CHART_HEIGHT - ratio * CHART_HEIGHT;
}

function buildLinePath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) {
    return "";
  }

  return points
    .map((point, index) =>
      `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    )
    .join(" ");
}

function buildAreaPath(points: Array<{ x: number; y: number }>, baselineY: number) {
  if (points.length === 0) {
    return "";
  }

  const line = buildLinePath(points);
  const last = points[points.length - 1]!;
  const first = points[0]!;

  return `${line} L ${last.x.toFixed(2)} ${baselineY.toFixed(2)} L ${first.x.toFixed(2)} ${baselineY.toFixed(2)} Z`;
}

function xCenter(index: number, count: number) {
  if (count <= 1) {
    return MARGIN.left + CHART_WIDTH / 2;
  }

  return MARGIN.left + (index / (count - 1)) * CHART_WIDTH;
}

function xBand(index: number, count: number) {
  return MARGIN.left + (index / count) * CHART_WIDTH;
}

function Frame({
  children,
  labels,
}: {
  children: React.ReactNode;
  labels?: string[];
}) {
  const step = labels ? getStep(labels.length) : 1;

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      className="h-full w-full overflow-visible"
      preserveAspectRatio="none"
      data-chart-plot-area="true"
      data-plot-x={MARGIN.left}
      data-plot-y={MARGIN.top}
      data-plot-width={CHART_WIDTH}
      data-plot-height={CHART_HEIGHT}
    >
      <g>
        {Array.from({ length: 4 }).map((_, index) => {
          const y = MARGIN.top + (CHART_HEIGHT / 3) * index;

          return (
            <line
              key={index}
              x1={MARGIN.left}
              x2={SVG_WIDTH - MARGIN.right}
              y1={y}
              y2={y}
              stroke="hsl(var(--border))"
              strokeDasharray="3 6"
              strokeWidth="1"
              opacity="0.45"
            />
          );
        })}
      </g>
      {children}
      {labels?.map((label, index) => {
        if (index % step !== 0 && index !== labels.length - 1) {
          return null;
        }

        return (
          <text
            key={label + index}
            x={xCenter(index, labels.length)}
            y={SVG_HEIGHT - 8}
            textAnchor="middle"
            fontSize="10"
            fill="hsl(var(--muted-foreground))"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

export function PublicBurnRateChart({
  data,
}: {
  data: Array<{ month: string; amount: number; average: number }>;
}) {
  const labels = data.map((item) => item.month);
  const values = data.map((item) => item.amount);
  const { min, max } = getRange([...values, data[0]?.average ?? 0], true);
  const averageY = valueToY(data[0]?.average ?? 0, min, max);
  const bandWidth = CHART_WIDTH / Math.max(data.length, 1);
  const barWidth = Math.max(10, Math.min(34, bandWidth * 0.55));

  return (
    <Frame labels={labels}>
      <line
        x1={MARGIN.left}
        x2={SVG_WIDTH - MARGIN.right}
        y1={averageY}
        y2={averageY}
        stroke="hsl(var(--muted-foreground))"
        strokeDasharray="6 6"
        strokeWidth="2"
      />
      {data.map((item, index) => {
        const x = xBand(index, data.length) + (bandWidth - barWidth) / 2;
        const y = valueToY(item.amount, min, max);
        const zeroY = valueToY(0, min, max);
        const height = Math.max(2, Math.abs(zeroY - y));

        return (
          <rect
            key={item.month + index}
            x={x}
            y={Math.min(y, zeroY)}
            width={barWidth}
            height={height}
            fill="hsl(var(--foreground))"
            opacity="0.92"
            rx="2"
          />
        );
      })}
    </Frame>
  );
}

export function PublicComparisonBarChart({
  data,
  showAverage = false,
}: {
  data: ComparisonDatum[];
  showAverage?: boolean;
}) {
  const labels = data.map((item) => item.label);
  const values = data.flatMap((item) => [item.primary, item.secondary]);
  const average =
    data.length > 0
      ? data.reduce((sum, item) => sum + item.primary, 0) / data.length
      : 0;
  const { min, max } = getRange(showAverage ? [...values, average] : values, true);
  const zeroY = valueToY(0, min, max);
  const bandWidth = CHART_WIDTH / Math.max(data.length, 1);
  const gap = Math.max(4, bandWidth * 0.08);
  const barWidth = Math.max(8, Math.min(22, (bandWidth - gap) / 2));

  return (
    <Frame labels={labels}>
      {showAverage && (
        <line
          x1={MARGIN.left}
          x2={SVG_WIDTH - MARGIN.right}
          y1={valueToY(average, min, max)}
          y2={valueToY(average, min, max)}
          stroke="hsl(var(--muted-foreground))"
          strokeDasharray="6 6"
          strokeWidth="2"
        />
      )}
      <line
        x1={MARGIN.left}
        x2={SVG_WIDTH - MARGIN.right}
        y1={zeroY}
        y2={zeroY}
        stroke="hsl(var(--border))"
        strokeWidth="1"
      />
      {data.map((item, index) => {
        const bandX = xBand(index, data.length);
        const primaryX = bandX + (bandWidth - gap) / 2 - barWidth;
        const secondaryX = bandX + (bandWidth + gap) / 2;
        const primaryY = valueToY(item.primary, min, max);
        const secondaryY = valueToY(item.secondary, min, max);

        return (
          <g key={item.label + index}>
            <rect
              x={primaryX}
              y={Math.min(primaryY, zeroY)}
              width={barWidth}
              height={Math.max(2, Math.abs(zeroY - primaryY))}
              fill="hsl(var(--foreground))"
              opacity="0.92"
              rx="2"
            />
            <rect
              x={secondaryX}
              y={Math.min(secondaryY, zeroY)}
              width={barWidth}
              height={Math.max(2, Math.abs(zeroY - secondaryY))}
              fill="var(--chart-bar-fill-secondary)"
              opacity="0.95"
              rx="2"
            />
          </g>
        );
      })}
    </Frame>
  );
}

export function PublicForecastChart({ data }: { data: ForecastDatum[] }) {
  const labels = data.map((item) => item.label);
  const values = data.flatMap((item) =>
    [item.actual, item.forecasted].filter(
      (value): value is number => value !== null && value !== undefined,
    ),
  );
  const { min, max } = getRange(values, true);
  const baselineY = valueToY(min, min, max);
  const actualPoints = data
    .map((item, index) =>
      item.actual == null
        ? null
        : { x: xCenter(index, data.length), y: valueToY(item.actual, min, max) },
    )
    .filter((point): point is { x: number; y: number } => point !== null);
  const forecastPoints = data
    .map((item, index) =>
      item.forecasted == null
        ? null
        : {
            x: xCenter(index, data.length),
            y: valueToY(item.forecasted, min, max),
          },
    )
    .filter((point): point is { x: number; y: number } => point !== null);

  return (
    <Frame labels={labels}>
      <path
        d={buildAreaPath(actualPoints, baselineY)}
        fill="hsl(var(--foreground))"
        opacity="0.08"
      />
      <path
        d={buildLinePath(actualPoints)}
        fill="none"
        stroke="hsl(var(--foreground))"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={buildLinePath(forecastPoints)}
        fill="none"
        stroke="hsl(var(--muted-foreground))"
        strokeWidth="2.5"
        strokeDasharray="6 6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Frame>
  );
}

export function PublicCashFlowChart({
  data,
}: {
  data: Array<{
    label: string;
    inflow: number;
    outflow: number;
    netFlow: number;
    cumulativeFlow?: number;
  }>;
}) {
  return (
    <PublicGroupedBarLineChart
      data={data}
      bars={[
        {
          key: "inflow",
          color: "hsl(var(--foreground))",
          opacity: 0.92,
        },
        {
          key: "outflow",
          color: "hsl(var(--foreground))",
          pattern: "diagonal",
          opacity: 0.95,
        },
        {
          key: "netFlow",
          color: "var(--chart-actual-line)",
          opacity: 0.95,
        },
      ]}
      line={{
        key: "cumulativeFlow",
        color: "hsl(var(--muted-foreground))",
        dashed: true,
      }}
    />
  );
}

export function PublicRunwayChart({ data }: { data: RunwayDatum[] }) {
  const labels = data.map((item) => item.label);
  const values = data.map((item) => item.value);
  const { min, max } = getRange(values, true);
  const points = data.map((item, index) => ({
    x: xCenter(index, data.length),
    y: valueToY(item.value, min, max),
  }));
  const baselineY = valueToY(0, min, max);

  return (
    <Frame labels={labels}>
      <path
        d={buildAreaPath(points, baselineY)}
        fill="hsl(var(--foreground))"
        opacity="0.12"
      />
      <path
        d={buildLinePath(points)}
        fill="none"
        stroke="hsl(var(--foreground))"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Frame>
  );
}

export function PublicStackedExpensesChart({
  data,
}: {
  data: StackedDatum[];
}) {
  const labels = data.map((item) => item.label);
  const totals = data.map((item) => item.total);
  const { min, max } = getRange(totals, true);
  const bandWidth = CHART_WIDTH / Math.max(data.length, 1);
  const barWidth = Math.max(14, Math.min(36, bandWidth * 0.55));

  return (
    <Frame labels={labels}>
      <defs>
        <pattern
          id="public-report-recurring-pattern"
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="8"
            stroke="hsl(var(--foreground))"
            strokeWidth="3"
          />
        </pattern>
      </defs>
      {data.map((item, index) => {
        const x = xBand(index, data.length) + (bandWidth - barWidth) / 2;
        const totalY = valueToY(item.total, min, max);
        const recurringY = valueToY(item.recurring, min, max);
        const zeroY = valueToY(0, min, max);

        return (
          <g key={item.label + index}>
            <rect
              x={x}
              y={Math.min(totalY, zeroY)}
              width={barWidth}
              height={Math.max(2, Math.abs(zeroY - totalY))}
              fill="#C6C6C6"
              opacity="0.95"
              rx="2"
            />
            <rect
              x={x}
              y={Math.min(recurringY, zeroY)}
              width={barWidth}
              height={Math.max(2, Math.abs(zeroY - recurringY))}
              fill="url(#public-report-recurring-pattern)"
              rx="2"
            />
          </g>
        );
      })}
    </Frame>
  );
}

function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number,
) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;

  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeArc(
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polarToCartesian(centerX, centerY, radius, endAngle);
  const end = polarToCartesian(centerX, centerY, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    "M",
    start.x,
    start.y,
    "A",
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
  ].join(" ");
}

export function PublicDonutChart({ data }: { data: DonutDatum[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const centerX = SVG_WIDTH / 2;
  const centerY = SVG_HEIGHT / 2;
  const radius = 88;
  const circumference = 2 * Math.PI * radius;
  let currentAngle = 0;

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <circle
        cx={centerX}
        cy={centerY}
        r={radius}
        fill="none"
        stroke="hsl(var(--border))"
        strokeWidth="36"
        opacity="0.35"
      />
      {data.map((item, index) => {
        const angle = total > 0 ? (item.value / total) * 360 : 0;
        const startAngle = currentAngle;
        const endAngle = currentAngle + angle;
        currentAngle = endAngle;

        return (
          <path
            key={item.label + index}
            d={describeArc(centerX, centerY, radius, startAngle, endAngle)}
            fill="none"
            stroke={publicChartGrayShades[index % publicChartGrayShades.length]}
            strokeWidth="36"
            strokeLinecap={angle > 8 ? "round" : "butt"}
            strokeDasharray={circumference}
          />
        );
      })}
    </svg>
  );
}

export function PublicScoreLineChart({
  data,
}: {
  data: Array<{ label: string; value: number }>;
}) {
  const labels = data.map((item) => item.label);
  const points = data.map((item, index) => ({
    x: xCenter(index, data.length),
    y: valueToY(item.value, 0, 100),
  }));

  return (
    <Frame labels={labels}>
      <path
        d={buildLinePath(points)}
        fill="none"
        stroke="hsl(var(--foreground))"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((point, index) => (
        <circle
          key={labels[index]}
          cx={point.x}
          cy={point.y}
          r="3"
          fill="hsl(var(--foreground))"
        />
      ))}
    </Frame>
  );
}

export function PublicMultiLineChart({
  data,
  series,
  includeZero = true,
  domain,
}: {
  data: SeriesDatum[];
  series: LineSeries[];
  includeZero?: boolean;
  domain?: { min: number; max: number };
}) {
  const labels = data.map((item) => item.label);
  const values = data.flatMap((item) =>
    series
      .map((entry) => item[entry.key])
      .filter((value): value is number => typeof value === "number"),
  );
  const { min, max } = domain ?? getRange(values, includeZero);
  const zeroY = min <= 0 && max >= 0 ? valueToY(0, min, max) : null;

  return (
    <Frame labels={labels}>
      {zeroY !== null && (
        <line
          x1={MARGIN.left}
          x2={SVG_WIDTH - MARGIN.right}
          y1={zeroY}
          y2={zeroY}
          stroke="hsl(var(--border))"
          strokeWidth="1"
        />
      )}
      {series.map((entry) => {
        const points = data
          .map((item, index) => {
            const value = item[entry.key];
            if (typeof value !== "number") {
              return null;
            }

            return {
              x: xCenter(index, data.length),
              y: valueToY(value, min, max),
            };
          })
          .filter((point): point is { x: number; y: number } => point !== null);

        return (
          <path
            key={entry.key}
            d={buildLinePath(points)}
            fill="none"
            stroke={entry.color}
            strokeWidth={entry.width ?? 2.5}
            strokeDasharray={
              entry.dotted ? "3 5" : entry.dashed ? "6 6" : undefined
            }
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
    </Frame>
  );
}

export function PublicGroupedBarLineChart({
  data,
  bars,
  line,
  includeZero = true,
}: {
  data: SeriesDatum[];
  bars: BarSeries[];
  line?: LineSeries;
  includeZero?: boolean;
}) {
  const patternId = useId().replace(/:/g, "");
  const labels = data.map((item) => item.label);
  const barValues = data.flatMap((item) =>
    bars
      .map((entry) => item[entry.key])
      .filter((value): value is number => typeof value === "number"),
  );
  const { min: barMin, max: barMax } = getRange(barValues, includeZero);
  const zeroY = valueToY(0, barMin, barMax);
  const lineValues = line
    ? data
        .map((item) => item[line.key])
        .filter((value): value is number => typeof value === "number")
    : [];
  const lineRange =
    lineValues.length > 0 ? getRange(lineValues, true) : { min: 0, max: 1 };
  const bandWidth = CHART_WIDTH / Math.max(data.length, 1);
  const totalGap = Math.max(6, bandWidth * 0.14);
  const barWidth = Math.max(
    8,
    Math.min(18, (bandWidth - totalGap * (bars.length - 1)) / bars.length),
  );

  const linePoints = line
    ? data
        .map((item, index) => {
          const value = item[line.key];
          if (typeof value !== "number") {
            return null;
          }

          return {
            x: xCenter(index, data.length),
            y: valueToY(value, lineRange.min, lineRange.max),
          };
        })
        .filter((point): point is { x: number; y: number } => point !== null)
    : [];

  return (
    <Frame labels={labels}>
      {bars.some((entry) => entry.pattern) && (
        <defs>
          <pattern
            id={`public-grouped-pattern-${patternId}`}
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="8"
              stroke="hsl(var(--foreground))"
              strokeWidth="3"
            />
          </pattern>
        </defs>
      )}
      <line
        x1={MARGIN.left}
        x2={SVG_WIDTH - MARGIN.right}
        y1={zeroY}
        y2={zeroY}
        stroke="hsl(var(--border))"
        strokeWidth="1"
      />
      {data.map((item, dataIndex) => {
        const startX =
          xBand(dataIndex, data.length) +
          (bandWidth - bars.length * barWidth - (bars.length - 1) * totalGap) /
            2;

        return (
          <g key={item.label + dataIndex}>
            {bars.map((entry, barIndex) => {
              const value = item[entry.key];
              if (typeof value !== "number") {
                return null;
              }

              const y = valueToY(value, barMin, barMax);
              const x = startX + barIndex * (barWidth + totalGap);

              return (
                <rect
                  key={entry.key}
                  x={x}
                  y={Math.min(y, zeroY)}
                  width={barWidth}
                  height={Math.max(2, Math.abs(zeroY - y))}
                  fill={
                    entry.pattern
                      ? `url(#public-grouped-pattern-${patternId})`
                      : entry.color
                  }
                  opacity={entry.opacity ?? 0.95}
                  rx="2"
                />
              );
            })}
          </g>
        );
      })}
      {line && linePoints.length > 0 && (
        <path
          d={buildLinePath(linePoints)}
          fill="none"
          stroke={line.color}
          strokeWidth={line.width ?? 2.5}
          strokeDasharray={
            line.dotted ? "3 5" : line.dashed ? "6 6" : undefined
          }
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </Frame>
  );
}
