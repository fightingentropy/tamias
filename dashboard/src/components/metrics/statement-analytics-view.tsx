import type { StatementAnalytics } from "@tamias/app-data/queries/reports";
import { format, parseISO, endOfMonth } from "date-fns";
import { PublicComparisonBarChart } from "@/components/charts/public-report-charts";

export function statementTransactionsHref(
  data: Pick<StatementAnalytics, "from" | "to">,
  accountId?: string | null,
  extra: Record<string, string> = {},
) {
  const search = new URLSearchParams();
  if (data.from) search.set("start", data.from);
  if (data.to) search.set("end", data.to);
  if (accountId) search.set("accounts", accountId);
  for (const [key, value] of Object.entries(extra)) search.set(key, value);
  return `/transactions?${search}`;
}

export function StatementAnalyticsView({
  data,
  accountId,
}: {
  data: StatementAnalytics;
  accountId?: string | null;
}) {
  const money = (value: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: data.currency }).format(value);
  const date = (value: string) => format(parseISO(value), "d MMM yyyy");
  const { summary } = data;
  const href = (extra?: Record<string, string>) =>
    statementTransactionsHref(data, accountId, extra);
  if (!summary.count)
    return (
      <div className="border p-8 text-sm text-muted-foreground">
        No settled transactions in this period
        {summary.unconvertedCount
          ? ` with an amount in ${data.currency}. Try the original account currency`
          : ""}
        .
      </div>
    );
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-muted-foreground">
          {summary.count.toLocaleString("en-GB")} settled transactions ·{" "}
          {summary.firstDate && date(summary.firstDate)} –{" "}
          {summary.lastDate && date(summary.lastDate)}
        </p>
        <a className="underline underline-offset-4" href={href()}>
          Browse transactions
        </a>
      </div>
      {!!summary.unconvertedCount && (
        <p role="status" className="border p-4 text-sm">
          {summary.unconvertedCount} transactions in {summary.unconvertedCurrencies} have no
          recorded {data.currency} conversion and are left out of these totals. Choose their
          original currency to view them.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Money in", summary.moneyIn, "All incoming cash, including transfers"],
          ["Money out", summary.moneyOut, "All outgoing cash, including transfers"],
          ["Net movement", summary.netMovement, "Money in minus money out"],
          ["Spending", summary.spending, "Outgoings before refunds; marked transfers excluded"],
        ].map(([label, value, detail]) => (
          <section key={label} className="border bg-background p-5 space-y-3">
            <h3 className="text-sm text-muted-foreground">{label}</h3>
            <p className="text-2xl font-medium tabular-nums break-words">{money(Number(value))}</p>
            <p className="text-xs leading-relaxed text-muted-foreground">{detail}</p>
          </section>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-8 gap-y-2 border-y py-4 text-sm text-muted-foreground">
        <span>
          Transfers in{" "}
          <strong className="font-medium text-foreground tabular-nums">
            {money(summary.transfersIn)}
          </strong>
        </span>
        <span>
          Transfers out{" "}
          <strong className="font-medium text-foreground tabular-nums">
            {money(summary.transfersOut)}
          </strong>
        </span>
        {(summary.excludedIn > 0 || summary.excludedOut > 0) && (
          <span>
            Other excluded movements: {money(summary.excludedIn)} in · {money(summary.excludedOut)}{" "}
            out
          </span>
        )}
        <span>Cash movement is not taxable profit.</span>
      </div>
      <section className="border p-5 space-y-4" aria-label="Monthly cash flow">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-serif">Monthly cash flow</h3>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <i className="inline-block h-2 w-2 bg-foreground" />
              Money in
            </span>
            <span className="flex items-center gap-2">
              <i
                className="inline-block h-2 w-2"
                style={{ background: "var(--chart-bar-fill-secondary)" }}
              />
              Money out
            </span>
          </div>
        </div>
        <div className="h-64 sm:h-80">
          <PublicComparisonBarChart
            currency={data.currency}
            locale="en-GB"
            primaryLabel="Money in"
            secondaryLabel="Money out"
            data={data.months.map((row) => ({
              label: format(parseISO(`${row.month}-01`), "MMM yy"),
              primary: row.moneyIn,
              secondary: row.moneyOut,
            }))}
          />
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            View monthly amounts and transactions
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 font-normal">Month</th>
                  <th className="py-2 font-normal text-right">Money in</th>
                  <th className="py-2 font-normal text-right">Money out</th>
                  <th className="py-2 font-normal text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {data.months.map((row) => {
                  const start = `${row.month}-01`;
                  const end = format(endOfMonth(parseISO(start)), "yyyy-MM-dd");
                  return (
                    <tr key={row.month} className="border-b last:border-0">
                      <td className="py-3">
                        <a
                          className="underline underline-offset-4"
                          href={href({
                            start: data.from && data.from > start ? data.from : start,
                            end: data.to && data.to < end ? data.to : end,
                          })}
                        >
                          {format(parseISO(start), "MMM yyyy")}
                        </a>
                      </td>
                      <td className="text-right tabular-nums">{money(row.moneyIn)}</td>
                      <td className="text-right tabular-nums">{money(row.moneyOut)}</td>
                      <td className="text-right tabular-nums">
                        {money(row.moneyIn - row.moneyOut)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="border p-5 space-y-5" aria-label="Spending by category">
          <div>
            <h3 className="text-lg font-serif">Spending by category</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Includes personal and business purchases. Tax treatment is reviewed separately.
            </p>
          </div>
          {data.categories.length ? (
            <ul className="space-y-4">
              {data.categories.map((category) => (
                <li key={category.slug}>
                  <a
                    href={href({ categories: category.slug, type: "expense" })}
                    className="group block space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3 text-sm">
                      <span className="group-hover:underline">{category.name}</span>
                      <span className="shrink-0 tabular-nums">
                        {money(category.amount)}{" "}
                        <span className="text-muted-foreground text-xs">
                          {category.percentage}%
                        </span>
                      </span>
                    </div>
                    <div className="h-1 bg-muted">
                      <div
                        className="h-full bg-foreground/65"
                        style={{ width: `${Math.min(100, category.percentage)}%` }}
                      />
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No spending in this period.</p>
          )}
          {!!summary.uncategorizedCount && (
            <a
              className="inline-block text-sm underline underline-offset-4"
              href={href({ categories: "uncategorized", type: "expense" })}
            >
              Categorise {summary.uncategorizedCount} transactions
            </a>
          )}
        </section>
        <section className="border p-5 space-y-5" aria-label="Top merchants and payees">
          <div>
            <h3 className="text-lg font-serif">Top merchants and payees</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Your largest spending totals, before refunds.
            </p>
          </div>
          <ol className="divide-y">
            {data.merchants.map((merchant, index) => (
              <li key={merchant.name} className="py-3 first:pt-0">
                <a
                  className="group flex justify-between gap-3 text-sm"
                  href={href({ q: merchant.name, type: "expense" })}
                >
                  <span className="min-w-0">
                    <span className="mr-3 text-xs text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="group-hover:underline">{merchant.name}</span>
                    <span className="block ml-7 mt-1 text-xs text-muted-foreground">
                      {merchant.count} payments
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">{money(merchant.amount)}</span>
                </a>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
