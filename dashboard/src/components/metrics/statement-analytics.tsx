import { useQuery } from "@tanstack/react-query";
import { useQueryStates, parseAsString, parseAsStringLiteral } from "nuqs";
import { Button } from "@tamias/ui/button";
import { useTRPC } from "@/trpc/client";
import { useTeamQuery } from "@/hooks/use-team";
import { getPeriodDateRange } from "@/utils/metrics-date-utils";
import { StatementAnalyticsView } from "./statement-analytics-view";

const periods = [
  "all",
  "tax-year",
  "previous-tax-year",
  "this-year",
  "3-months",
  "1-year",
  "custom",
] as const;
const selectClass = "h-10 max-w-full border bg-background px-3 text-sm";

export function StatementAnalytics() {
  const trpc = useTRPC();
  const { data: team } = useTeamQuery();
  const accounts = useQuery(trpc.bankAccounts.get.queryOptions());
  const [filter, setFilter] = useQueryStates({
    statementPeriod: parseAsStringLiteral(periods).withDefault("all"),
    statementAccount: parseAsString,
    statementCurrency: parseAsString,
    statementFrom: parseAsString,
    statementTo: parseAsString,
  });
  const selectedAccount = accounts.data?.find((account) => account.id === filter.statementAccount);
  const currency =
    filter.statementCurrency ?? selectedAccount?.currency ?? team?.baseCurrency ?? "GBP";
  const range: { from?: string; to?: string } =
    filter.statementPeriod === "all"
      ? {}
      : getPeriodDateRange(
          filter.statementPeriod,
          undefined,
          filter.statementFrom ?? undefined,
          filter.statementTo ?? undefined,
        );
  const validDates =
    filter.statementPeriod !== "custom" ||
    !!(filter.statementFrom && filter.statementTo && filter.statementFrom <= filter.statementTo);
  const query = useQuery({
    ...trpc.reports.statement.queryOptions({
      ...range,
      accountId: filter.statementAccount ?? undefined,
      currency,
    }),
    enabled: !!team?.id && validDates,
  });
  const currencies = [
    ...new Set(
      [
        currency,
        team?.baseCurrency,
        ...(accounts.data?.map((account) => account.currency) ?? []),
      ].filter((value): value is string => !!value),
    ),
  ];
  return (
    <div className="space-y-6 pt-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-2 text-xs text-muted-foreground">
          Period
          <select
            className={selectClass}
            value={filter.statementPeriod}
            onChange={(event) =>
              void setFilter({
                statementPeriod: event.target.value as typeof filter.statementPeriod,
              })
            }
          >
            <option value="all">All statement history</option>
            <option value="tax-year">Current UK tax year</option>
            <option value="previous-tax-year">Previous UK tax year</option>
            <option value="this-year">This calendar year</option>
            <option value="3-months">Last 3 months</option>
            <option value="1-year">Last 12 months</option>
            <option value="custom">Custom dates</option>
          </select>
        </label>
        <label className="flex flex-col gap-2 text-xs text-muted-foreground">
          Account
          <select
            className={selectClass}
            value={filter.statementAccount ?? ""}
            onChange={(event) =>
              void setFilter({
                statementAccount: event.target.value || null,
                statementCurrency: null,
              })
            }
          >
            <option value="">All accounts</option>
            {accounts.data?.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-xs text-muted-foreground">
          Currency
          <select
            className={selectClass}
            value={currency}
            onChange={(event) => void setFilter({ statementCurrency: event.target.value })}
          >
            {currencies.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        {filter.statementPeriod === "custom" && (
          <>
            <label className="flex flex-col gap-2 text-xs text-muted-foreground">
              From
              <input
                className={selectClass}
                type="date"
                value={filter.statementFrom ?? ""}
                onChange={(event) => void setFilter({ statementFrom: event.target.value || null })}
              />
            </label>
            <label className="flex flex-col gap-2 text-xs text-muted-foreground">
              To
              <input
                className={selectClass}
                type="date"
                value={filter.statementTo ?? ""}
                onChange={(event) => void setFilter({ statementTo: event.target.value || null })}
              />
            </label>
          </>
        )}
      </div>
      {range.from && validDates && (
        <p className="text-xs text-muted-foreground">
          {range.from} to {range.to} · UK tax years run from 6 April to 5 April.
        </p>
      )}
      {!validDates ? (
        <p className="text-sm text-muted-foreground">Choose a start and end date in order.</p>
      ) : query.isError ? (
        <div role="alert" className="border p-5 space-y-3">
          <p className="text-sm">Could not load statement analytics. {query.error.message}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </div>
      ) : query.data ? (
        <StatementAnalyticsView data={query.data} accountId={filter.statementAccount} />
      ) : (
        <p role="status" className="py-8 text-sm text-muted-foreground">
          Loading your statement analytics…
        </p>
      )}
    </div>
  );
}
