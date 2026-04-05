export function serializeMetricRangeParams(params: {
  teamId: string;
  from: string;
  to: string;
  currency?: string;
  exactDates?: boolean;
}) {
  return [
    params.teamId,
    params.from,
    params.to,
    params.currency ?? "",
    params.exactDates ?? false,
  ].join(":");
}
