const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeTimestampBoundary(
  value: string,
  boundary: "start" | "end",
) {
  if (!DATE_ONLY_PATTERN.test(value)) {
    return value;
  }

  return boundary === "start"
    ? `${value}T00:00:00.000Z`
    : `${value}T23:59:59.999Z`;
}
