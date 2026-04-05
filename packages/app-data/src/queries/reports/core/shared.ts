export type GetReportsParams = {
  teamId: string;
  from: string;
  to: string;
  currency?: string;
  type?: "revenue" | "profit";
  revenueType?: "gross" | "net";
  /** When true, use exact dates instead of expanding to month boundaries. Useful for weekly insights. */
  exactDates?: boolean;
};

export interface ReportsResultItem {
  value: string;
  date: string;
  currency: string;
}

export function serializeProfitParams(params: GetReportsParams) {
  return [
    params.teamId,
    params.from,
    params.to,
    params.currency ?? "",
    params.revenueType ?? "net",
    params.exactDates ?? false,
  ].join(":");
}

export function serializeRevenueParams(params: GetReportsParams) {
  return [
    params.teamId,
    params.from,
    params.to,
    params.currency ?? "",
    params.revenueType ?? "gross",
    params.exactDates ?? false,
  ].join(":");
}
