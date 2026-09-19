"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CisPaymentSchema,
  poundsToPence,
  currentUkTaxYear,
  type SelfAssessmentReport,
  type TaxReview,
} from "@tamias/compliance/self-assessment";
import { calculateSelfAssessmentDraft } from "@tamias/compliance/self-assessment-calculation";
import { Button } from "@tamias/ui/button";
import { Input } from "@tamias/ui/input";
import { Badge } from "@tamias/ui/badge";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@tamias/ui/dialog";
import { getApiUrl } from "@tamias/utils/envs";
import { useAuthToken } from "@/framework/auth-client";
import { useUserQuery } from "@/hooks/use-user";
import Link from "@/framework/link";
import { SelfAssessmentFiling } from "./self-assessment-filing";
import { SelfAssessmentProfileForm } from "./self-assessment-profile";
import type { TaxRequest } from "./self-assessment-types";

type Report = SelfAssessmentReport & { fingerprint: string };
type Transaction = Report["transactions"][number];
const money = (pence: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
const yearLabel = (year: number) => `${year}/${String(year + 1).slice(-2)}`;
const selectStyle = "h-10 border bg-background px-3 text-sm w-full";

function ReviewForm({
  row,
  report,
  busy,
  error,
  onSave,
}: {
  row: Transaction;
  report: Report;
  busy: boolean;
  error: string | null;
  onSave: (review: TaxReview) => void;
}) {
  const [category, setCategory] = useState<TaxReview["category"]>(
    row.category ?? (row.isCis ? "turnover" : "excluded"),
  );
  const [percent, setPercent] = useState(row.category === "excluded" ? 0 : row.businessPercent);
  const [note, setNote] = useState(row.note);
  const [useCis, setUseCis] = useState(Boolean(row.cis || row.isCis));
  const [gross, setGross] = useState(row.cis ? (row.cis.grossPence / 100).toFixed(2) : "");
  const [deduction, setDeduction] = useState(
    row.cis ? (row.cis.deductionPence / 100).toFixed(2) : "",
  );
  const [incomeYear, setIncomeYear] = useState(
    String(row.cis ? (row.cis.incomeTaxYear ?? "pending") : row.bankTaxYear),
  );
  const [deductionYear, setDeductionYear] = useState(
    String(row.cis ? (row.cis.deductionTaxYear ?? "pending") : row.bankTaxYear),
  );
  const [pendingYears, setPendingYears] = useState(
    row.cis?.taxYearsUnderReview.length ? row.cis.taxYearsUnderReview : [row.bankTaxYear],
  );
  const [reference, setReference] = useState(row.cis?.reference ?? "");
  const [validation, setValidation] = useState<string | null>(null);
  const years = Array.from({ length: 3 }, (_, i) => row.bankTaxYear - 1 + i).filter(
    (y) => y >= 2024,
  );
  const pending = incomeYear === "pending" || deductionYear === "pending";
  function save(event: React.FormEvent) {
    event.preventDefault();
    try {
      const cis = useCis
        ? CisPaymentSchema.parse({
            grossPence: poundsToPence(Number(gross)),
            deductionPence: poundsToPence(Number(deduction)),
            incomeTaxYear: incomeYear === "pending" ? null : Number(incomeYear),
            deductionTaxYear: deductionYear === "pending" ? null : Number(deductionYear),
            taxYearsUnderReview: pending ? pendingYears : [],
            reference,
          })
        : null;
      if (cis && cis.grossPence - cis.deductionPence !== row.amountPence)
        throw new Error(
          "Gross pay minus CIS deductions must match the bank credit. Check the statement figures.",
        );
      if (!Number.isInteger(percent) || percent < 0 || percent > 100)
        throw new Error("Enter a business share from 0 to 100%.");
      setValidation(null);
      onSave({
        transactionId: row.id,
        sourceVersion: row.sourceVersion,
        category: cis ? "turnover" : category,
        businessPercent: cis ? 100 : category === "excluded" ? 0 : percent,
        note,
        cis,
      });
    } catch (problem) {
      setValidation(
        problem instanceof Error && !problem.message.startsWith("[")
          ? problem.message
          : "Check the statement amounts, tax years and reference.",
      );
    }
  }
  return (
    <form onSubmit={save} className="space-y-5">
      <DialogTitle>{row.name}</DialogTitle>
      <DialogDescription>
        {row.date} · Bank amount{" "}
        {row.amountPence === null ? `${row.amount} ${row.currency}` : money(row.amountPence)}
      </DialogDescription>
      {row.amount > 0 && row.currency === "GBP" && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={useCis} onChange={(e) => setUseCis(e.target.checked)} />{" "}
          Use a CIS payment statement
        </label>
      )}
      {useCis ? (
        <div className="space-y-4 border p-4">
          <p className="text-sm text-muted-foreground">
            Use the actual gross pay and tax deducted on your statement. Your bank amount stays
            unchanged.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-2 text-sm">
              Gross pay (£)
              <Input
                aria-label="Gross pay in pounds"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={gross}
                onChange={(e) => setGross(e.target.value)}
              />
            </label>
            <label className="space-y-2 text-sm">
              CIS deducted (£)
              <Input
                aria-label="CIS deducted in pounds"
                type="number"
                min="0"
                step="0.01"
                required
                value={deduction}
                onChange={(e) => setDeduction(e.target.value)}
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-2 text-sm">
              Income tax year
              <select
                className={selectStyle}
                value={incomeYear}
                onChange={(e) => setIncomeYear(e.target.value)}
              >
                <option value="pending">Awaiting confirmation</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {yearLabel(y)}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              Deduction tax year
              <select
                className={selectStyle}
                value={deductionYear}
                onChange={(e) => setDeductionYear(e.target.value)}
              >
                <option value="pending">Awaiting confirmation</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {yearLabel(y)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {pending && (
            <fieldset className="space-y-2 text-sm">
              <legend>Tax years affected by this uncertainty</legend>
              {years.map((y) => (
                <label key={y} className="mr-4 inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={pendingYears.includes(y)}
                    onChange={(e) =>
                      setPendingYears(
                        e.target.checked
                          ? [...pendingYears, y]
                          : pendingYears.filter((v) => v !== y),
                      )
                    }
                  />
                  {yearLabel(y)}
                </label>
              ))}
              <p className="text-muted-foreground">
                Unallocated amounts stay outside the totals until the year is confirmed.
              </p>
            </fieldset>
          )}
          <label className="block space-y-2 text-sm">
            Statement reference
            <Input
              required
              maxLength={500}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Contractor, statement period or invoice reference"
            />
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-[1fr_100px] gap-3">
          <label className="space-y-2 text-sm">
            Tax category
            <select
              className={selectStyle}
              value={category}
              onChange={(e) => setCategory(e.target.value as TaxReview["category"])}
            >
              {report.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm">
            Business %
            <Input
              type="number"
              min={0}
              max={100}
              step={1}
              disabled={category === "excluded"}
              value={category === "excluded" ? 0 : percent}
              onChange={(e) => setPercent(Number(e.target.value))}
            />
          </label>
        </div>
      )}
      <label className="block space-y-2 text-sm">
        Review note
        <Input maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <Link
        href={`/transactions?transactionId=${row.id}`}
        className="inline-block text-sm underline underline-offset-4"
      >
        Open transaction and attachments
      </Link>
      {(validation || error) && (
        <p role="alert" className="text-sm text-destructive">
          {validation || error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save review"}
      </Button>
    </form>
  );
}

function TaxYearContent({
  report,
  request,
  teamId,
}: {
  report: Report;
  request: TaxRequest;
  teamId: string;
}) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("needs-review");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(40);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [taxpayerStatus, setTaxpayerStatus] = useState<"U" | "C" | "S">("U");
  const [exportError, setExportError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: ({ year, reviews }: { year: number; reviews: TaxReview[] }) =>
      request<Report>(`/self-assessment/${year}/reviews`, { reviews }),
    onSuccess: async () => {
      setEditing(null);
      setSelected(new Set());
      await queryClient.invalidateQueries({ queryKey: ["self-assessment"] });
    },
  });
  const estimate = calculateSelfAssessmentDraft(report, taxpayerStatus);
  const filtered = report.transactions.filter(
    (t) =>
      (filter === "all" ||
        (filter === "needs-review" && (t.needsReview || t.cisPending)) ||
        (filter === "cis" && t.isCis) ||
        (filter === "receipts" && t.included && t.businessAmountPence < 0 && !t.hasReceipt)) &&
      (!search || `${t.name} ${t.note} ${t.date}`.toLowerCase().includes(search.toLowerCase())),
  );
  const cisRows = report.transactions.filter((t) => t.cis);
  async function exportWorkingPapers() {
    try {
      setExportError(null);
      const result = await request<{ csv: string; fileName: string }>(
        `/self-assessment/${report.taxYear}/export?fingerprint=${report.fingerprint}`,
      );
      const url = URL.createObjectURL(new Blob([result.csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = result.fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Export failed. Try again.");
    }
  }
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-6 border-y py-6 lg:grid-cols-4">
        {[
          ["Gross business income", report.incomePence],
          ["Business expenses", report.expensesPence],
          ["Profit before adjustments", report.profitPence],
          ["CIS tax already deducted", report.cisDeductionsPence],
        ].map(([label, amount]) => (
          <div key={label}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl tabular-nums tracking-tight">{money(Number(amount))}</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Reviewed records only · {report.needsReview.toLocaleString("en-GB")} transactions still to
        review · {report.missingReceipts} work purchases without receipts
      </p>
      <SelfAssessmentProfileForm
        key={JSON.stringify(report.profile)}
        report={report}
        request={request}
        onSaved={() =>
          queryClient.invalidateQueries({ queryKey: ["self-assessment", teamId, report.taxYear] })
        }
      />
      {!!report.cisPendingCount && (
        <div className="border border-amber-500/40 bg-amber-500/5 p-5 text-sm">
          <h3 className="font-medium">CIS tax year awaiting confirmation</h3>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            {money(report.cisPendingGrossPence)} gross income and{" "}
            {money(report.cisPendingDeductionsPence)} deductions remain unallocated to a tax year.
            These amounts are excluded from the totals and estimate below.
          </p>
        </div>
      )}
      {!report.profile.filedElsewhere && report.taxYear === 2025 && (
        <section
          className="grid gap-6 border bg-card p-5 sm:p-6 lg:grid-cols-[1fr_1fr]"
          aria-labelledby="draft-estimate"
        >
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h3 id="draft-estimate" className="text-xl font-serif">
                Draft tax estimate
              </h3>
              <Badge variant="outline">
                {report.blockers.length ? "Incomplete records" : "Review before filing"}
              </Badge>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              An illustration using only the reviewed business figures, the standard Personal
              Allowance and Class 4 National Insurance. Other income, reliefs, student loans,
              voluntary Class 2, prior refunds and payments on account are not included.
            </p>
            <label className="mt-4 block max-w-xs space-y-2 text-sm">
              Tax rates for this illustration
              <select
                className={selectStyle}
                value={taxpayerStatus}
                onChange={(e) => setTaxpayerStatus(e.target.value as "U" | "C" | "S")}
              >
                <option value="U">England or Northern Ireland</option>
                <option value="C">Wales</option>
                <option value="S">Scotland</option>
              </select>
            </label>
          </div>
          {estimate ? (
            <dl className="space-y-3 text-sm">
              {[
                ["Income tax", estimate.incomeTaxPence],
                ["Class 4 National Insurance", estimate.class4Pence],
                ["Less CIS credit", -estimate.cisDeductionsPence],
              ].map(([label, amount]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt>{label}</dt>
                  <dd className="tabular-nums">{money(Number(amount))}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-4 border-t pt-4">
                <dt>
                  {estimate.refundPence > 0
                    ? "Illustrative overpayment"
                    : "Illustrative tax remaining"}
                </dt>
                <dd className="text-2xl tabular-nums">
                  {money(estimate.refundPence || estimate.taxDuePence)}
                </dd>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {estimate.refundPence > 0 ? "This is not a confirmed refund. " : ""}Return figures
                use HMRC whole-pound rounding. Unreviewed or unallocated amounts can change this
                estimate.
              </p>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              This estimate supports 2025/26 businesses with turnover below £90,000 and no loss or
              net expense refunds. Your working papers remain available.
            </p>
          )}
        </section>
      )}
      <SelfAssessmentFiling report={report} request={request} teamId={teamId} />
      {!!cisRows.length && (
        <section aria-labelledby="cis-payments">
          <h3 id="cis-payments" className="text-lg font-medium">
            CIS statement records
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Gross earnings and deductions stay separate from the net bank payment.
          </p>
          <div className="mt-4 divide-y border-y">
            {cisRows.map((t) => (
              <button
                key={t.id}
                className="flex w-full flex-wrap items-center justify-between gap-3 py-4 text-left hover:bg-muted/40"
                onClick={() => {
                  mutation.reset();
                  setEditing(t);
                }}
              >
                <span>
                  <span className="block text-sm font-medium">{t.name}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {t.date} · {t.cis?.reference}
                  </span>
                </span>
                <span className="text-right text-sm">
                  <span className="block tabular-nums">
                    {money(t.cis!.grossPence)} gross · {money(t.cis!.deductionPence)} CIS
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {t.needsReview
                      ? "Record changed — review again"
                      : t.cis!.incomeTaxYear === null || t.cis!.deductionTaxYear === null
                        ? "Awaiting tax-year confirmation"
                        : `Income ${yearLabel(t.cis!.incomeTaxYear!)} · credit ${yearLabel(t.cis!.deductionTaxYear!)}`}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
      <section id="tax-transactions" aria-labelledby="tax-transactions-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id="tax-transactions-heading" className="text-lg font-medium">
            Review transactions
          </h3>
          <Button variant="outline" size="sm" onClick={exportWorkingPapers}>
            Export working papers
          </Button>
        </div>
        {exportError && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {exportError}
          </p>
        )}
        <div className="my-4 flex flex-wrap gap-3">
          <div className="min-w-[180px]">
            <select
              aria-label="Transaction review filter"
              className={selectStyle}
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setLimit(40);
                setSelected(new Set());
              }}
            >
              <option value="needs-review">Needs review</option>
              <option value="cis">CIS payments</option>
              <option value="receipts">Missing work receipts</option>
              <option value="all">All transactions</option>
            </select>
          </div>
          <Input
            aria-label="Search tax transactions"
            placeholder="Search transactions"
            className="max-w-xs"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setLimit(40);
              setSelected(new Set());
            }}
          />
        </div>
        {!!selected.size && (
          <div className="mb-4 flex flex-wrap items-center gap-3 border p-3 text-sm">
            <span>{selected.size} selected</span>
            <Button
              size="sm"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() =>
                mutation.mutate({
                  year: report.taxYear,
                  reviews: report.transactions
                    .filter((t) => selected.has(t.id))
                    .map((t) => ({
                      transactionId: t.id,
                      sourceVersion: t.sourceVersion,
                      category: "excluded",
                      businessPercent: 0,
                      note: "Reviewed as personal or not allowable for this business.",
                      cis: null,
                    })),
                })
              }
            >
              Mark as personal / not allowable
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        )}
        {!editing && mutation.error && (
          <p role="alert" className="my-3 text-sm text-destructive">
            {mutation.error.message}
          </p>
        )}
        <div className="divide-y border-y">
          {filtered.slice(0, limit).map((t) => (
            <div key={t.id} className="flex items-center gap-3 py-3">
              <input
                type="checkbox"
                aria-label={`Select ${t.name} ${t.date}`}
                checked={selected.has(t.id)}
                disabled={
                  t.isCis ||
                  t.automaticExclusion ||
                  t.pending ||
                  t.bankTaxYear !== report.taxYear ||
                  (!selected.has(t.id) && selected.size >= 100)
                }
                onChange={(e) =>
                  setSelected((old) => {
                    const next = new Set(old);
                    if (e.target.checked) next.add(t.id);
                    else next.delete(t.id);
                    return next;
                  })
                }
              />
              <button
                className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left hover:text-muted-foreground disabled:opacity-60"
                disabled={t.automaticExclusion || t.pending}
                onClick={() => {
                  mutation.reset();
                  setEditing(t);
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{t.name}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {t.date} ·{" "}
                    {t.cisPending
                      ? "Tax year to confirm"
                      : t.needsReview
                        ? "Needs review"
                        : report.categories.find((c) => c.id === t.category)?.name}
                  </span>
                </span>
                <span className="shrink-0 text-sm tabular-nums">
                  {t.amountPence === null ? `${t.amount} ${t.currency}` : money(t.amountPence)}
                </span>
              </button>
            </div>
          ))}
          {!filtered.length && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No transactions in this view.
            </p>
          )}
        </div>
        {filtered.length > limit && (
          <Button variant="outline" className="mt-4" onClick={() => setLimit((n) => n + 40)}>
            Show more ({filtered.length - limit} remaining)
          </Button>
        )}
      </section>
      <details className="border-t pt-5">
        <summary className="cursor-pointer text-sm font-medium">
          {report.profile.filedElsewhere ? "Bookkeeping checks" : "Checks for a future filing"} (
          {report.blockers.length})
        </summary>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          {report.blockers.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </details>
      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setEditing(null);
        }}
      >
        <DialogContent className="p-6 sm:p-8">
          {editing && (
            <ReviewForm
              key={editing.id}
              row={editing}
              report={report}
              busy={mutation.isPending}
              error={mutation.error?.message ?? null}
              onSave={(review) => mutation.mutate({ year: editing.bankTaxYear, reviews: [review] })}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function SelfAssessmentWorkspace() {
  const token = useAuthToken();
  const { data: user } = useUserQuery();
  const teamId = user?.teamId;
  const currentYear = currentUkTaxYear();
  const lastCompleted = currentYear - 1;
  const [year, setYear] = useState(Math.max(2024, currentYear));
  async function request<T>(
    path: string,
    body?: unknown,
    method?: "GET" | "PUT" | "POST",
  ): Promise<T> {
    if (!token || !teamId) throw new Error("Sign in to load your tax records.");
    const response = await fetch(`${getApiUrl()}${path}`, {
      method: method ?? (body === undefined ? "GET" : "PUT"),
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Tamias-Team-Id": teamId,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(
        data &&
          typeof data === "object" &&
          "description" in data &&
          typeof data.description === "string"
          ? data.description
          : "Could not complete the tax request. Check your details and try again.",
      );
    return data as T;
  }
  const query = useQuery({
    queryKey: ["self-assessment", teamId, year],
    enabled: Boolean(token && teamId),
    queryFn: () => request<Report>(`/self-assessment/${year}`),
    retry: 1,
  });
  return (
    <section id="self-assessment" aria-labelledby="self-assessment-heading" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="self-assessment-heading" className="text-2xl font-serif">
            Self Assessment
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Organise this year's business records and CIS deductions for your next return.
            <Link href="/reports" className="ml-2 underline underline-offset-4">
              Open statement analytics
            </Link>
          </p>
        </div>
        <select
          aria-label="Tax year"
          className={`${selectStyle} !w-auto`}
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        >
          {Array.from({ length: Math.max(1, currentYear - 2023) }, (_, i) => currentYear - i).map(
            (y) => (
              <option key={y} value={y}>
                {yearLabel(y)}
                {y > lastCompleted ? " · in progress" : ""}
              </option>
            ),
          )}
        </select>
      </div>
      {query.isPending && (
        <p role="status" className="py-8 text-sm text-muted-foreground">
          Loading your tax records…
        </p>
      )}
      {query.isError && (
        <div role="alert" className="space-y-3 border p-5">
          <p className="text-sm">{query.error.message}</p>
          <Button variant="outline" onClick={() => query.refetch()}>
            Try again
          </Button>
        </div>
      )}
      {query.data && (
        <TaxYearContent
          key={`${teamId}-${year}`}
          report={query.data}
          request={request}
          teamId={teamId!}
        />
      )}
    </section>
  );
}
