"use client";

import { Badge } from "@tamias/ui/badge";
import { Button } from "@tamias/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@tamias/ui/card";
import { Input } from "@tamias/ui/input";
import { Label } from "@tamias/ui/label";
import { SubmitButton } from "@tamias/ui/submit-button";
import { Textarea } from "@tamias/ui/textarea";
import { useToast } from "@tamias/ui/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "@/framework/link";
import { useMemo, useState } from "react";
import {
  type EditableJournalLine,
  JournalLinesEditor,
} from "@/components/compliance/journal-lines-editor";
import { FormatAmount } from "@/components/format-amount";
import { useFileUrl } from "@/hooks/use-file-url";
import { useTRPC } from "@/trpc/client";

type PayrollRun = {
  id: string;
  periodKey: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  runDate: string;
  source: "csv" | "manual";
  status: "imported" | "exported";
  currency: string;
  lineCount: number;
  liabilityTotals: {
    grossPay: number;
    employerTaxes: number;
    payeLiability: number;
  };
  exportBundles: Array<{
    id: string;
    filePath: string;
    fileName: string;
  }>;
};

function formatDate(value?: string | null) {
  if (!value) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function defaultLines(): EditableJournalLine[] {
  return [
    {
      accountCode: "6100",
      description: "Gross pay",
      debit: "",
      credit: "",
    },
    {
      accountCode: "2210",
      description: "PAYE and NIC liability",
      debit: "",
      credit: "",
    },
  ];
}

function toNumber(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return 0;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function PayrollRunCard({
  run,
  onGenerateExport,
  isGenerating,
}: {
  run: PayrollRun;
  onGenerateExport: (periodKey: string) => void;
  isGenerating: boolean;
}) {
  const latestBundle = run.exportBundles.at(-1) ?? null;
  const download = useFileUrl(
    latestBundle
      ? {
          type: "download",
          filePath: latestBundle.filePath,
          filename: latestBundle.fileName,
        }
      : null,
  );

  return (
    <div className="rounded-lg border p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium">
              {run.payPeriodStart} to {run.payPeriodEnd}
            </div>
            <Badge variant={run.status === "exported" ? "default" : "secondary"}>
              {run.status}
            </Badge>
          </div>
          <div className="text-xs text-[#606060]">
            Run date {formatDate(run.runDate)} · {run.source} import · {run.lineCount} journal lines
          </div>
          <div className="text-xs text-[#606060]">
            PAYE <FormatAmount amount={run.liabilityTotals.payeLiability} currency={run.currency} />{" "}
            · Gross pay{" "}
            <FormatAmount amount={run.liabilityTotals.grossPay} currency={run.currency} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SubmitButton
            isSubmitting={isGenerating}
            onClick={() => onGenerateExport(run.periodKey)}
            variant="outline"
          >
            Generate export
          </SubmitButton>
          {download.url ? (
            <Button asChild variant="ghost">
              <a href={download.url}>Download</a>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function PayrollDashboard() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [source, setSource] = useState<"csv" | "manual">("csv");
  const [payPeriodStart, setPayPeriodStart] = useState(new Date().toISOString().slice(0, 10));
  const [payPeriodEnd, setPayPeriodEnd] = useState(new Date().toISOString().slice(0, 10));
  const [runDate, setRunDate] = useState(new Date().toISOString().slice(0, 10));
  const [currency, setCurrency] = useState("GBP");
  const [csvContent, setCsvContent] = useState(
    "accountCode,debit,credit,description\n6100,2500,0,Gross pay\n2210,0,650,PAYE and NIC liability\n2000,0,1850,Net pay payable",
  );
  const [manualLines, setManualLines] = useState<EditableJournalLine[]>(defaultLines());

  const dashboardQuery = useQuery(trpc.payroll.getDashboard.queryOptions());
  const runsQuery = useQuery(trpc.payroll.listRuns.queryOptions());
  const dashboard = dashboardQuery.data;
  const runs = runsQuery.data ?? [];

  const invalidatePayroll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: trpc.payroll.getDashboard.queryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.payroll.listRuns.queryKey(),
      }),
    ]);
  };

  const importRun = useMutation(
    trpc.payroll.importRun.mutationOptions({
      onSuccess: async () => {
        await invalidatePayroll();
        toast({
          title: "Payroll imported",
          description:
            "The payroll run has been recorded as a ledger journal and now feeds year-end reporting.",
        });
      },
    }),
  );

  const generateExport = useMutation(
    trpc.payroll.generateExport.mutationOptions({
      onSuccess: async () => {
        await invalidatePayroll();
        toast({
          title: "Payroll export generated",
          description: "The payroll bundle has been stored in the vault.",
        });
      },
    }),
  );

  const latestRun = useMemo(() => runs[0] ?? null, [runs]);

  if (dashboardQuery.isLoading || runsQuery.isLoading) {
    return <div className="text-sm text-[#606060]">Loading payroll workspace...</div>;
  }

  if (!dashboard?.profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Set up your UK filing profile first</CardTitle>
          <CardDescription>
            Payroll imports reuse the same UK filing profile and base currency as VAT and year-end
            compliance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild size="sm">
            <Link href="/compliance/settings">Open compliance settings</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Imported runs</CardTitle>
            <CardDescription>Payroll runs on the ledger</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-lg font-medium">{dashboard.summary.importedRunCount}</div>
            <div className="text-sm text-[#606060]">
              Latest run {formatDate(dashboard.summary.latestRunAt)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">PAYE liability</CardTitle>
            <CardDescription>Total imported PAYE and NIC due</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-lg font-medium">
              <FormatAmount
                amount={dashboard.summary.payeLiability}
                currency={dashboard.summary.currency}
              />
            </div>
            <div className="text-sm text-[#606060]">
              Import-first only. RTI stays out of scope here.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Latest run</CardTitle>
            <CardDescription>Most recent payroll import</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-lg font-medium">
              {latestRun ? latestRun.payPeriodEnd : "No run yet"}
            </div>
            <div className="text-sm text-[#606060]">
              {latestRun
                ? `${latestRun.source} import with ${latestRun.lineCount} lines`
                : "Import CSV or manual journals to begin"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Import payroll run</CardTitle>
          <CardDescription>
            Import a payroll journal from CSV or enter the journal lines manually. Each run becomes
            a first-class ledger input.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={source === "csv" ? "default" : "outline"}
              onClick={() => setSource("csv")}
            >
              CSV import
            </Button>
            <Button
              type="button"
              variant={source === "manual" ? "default" : "outline"}
              onClick={() => setSource("manual")}
            >
              Manual journal
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1">
              <Label>Pay period start</Label>
              <Input
                type="date"
                value={payPeriodStart}
                onChange={(event) => setPayPeriodStart(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Pay period end</Label>
              <Input
                type="date"
                value={payPeriodEnd}
                onChange={(event) => setPayPeriodEnd(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Run date</Label>
              <Input
                type="date"
                value={runDate}
                onChange={(event) => setRunDate(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Currency</Label>
              <Input
                value={currency}
                onChange={(event) => setCurrency(event.target.value.toUpperCase())}
                placeholder="GBP"
              />
            </div>
          </div>

          {source === "csv" ? (
            <div className="space-y-1">
              <Label>CSV content</Label>
              <Textarea
                rows={8}
                value={csvContent}
                onChange={(event) => setCsvContent(event.target.value)}
              />
              <div className="text-xs text-[#606060]">
                Required columns: <code>accountCode</code>, <code>debit</code>, <code>credit</code>.
                Optional: <code>description</code>.
              </div>
            </div>
          ) : (
            <JournalLinesEditor
              lines={manualLines}
              onChange={setManualLines}
              addLabel="Add payroll line"
            />
          )}

          <SubmitButton
            isSubmitting={importRun.isPending}
            onClick={() =>
              importRun.mutate({
                source,
                payPeriodStart,
                payPeriodEnd,
                runDate,
                currency,
                csvContent: source === "csv" ? csvContent : null,
                lines:
                  source === "manual"
                    ? manualLines.map((line) => ({
                        accountCode: line.accountCode,
                        description: line.description || null,
                        debit: toNumber(line.debit),
                        credit: toNumber(line.credit),
                      }))
                    : undefined,
              })
            }
          >
            Import payroll run
          </SubmitButton>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payroll runs</CardTitle>
          <CardDescription>
            Imported runs remain export-first. No RTI or provider submissions are exposed here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {runs.length ? (
            runs.map((run) => (
              <PayrollRunCard
                key={run.id}
                run={run as PayrollRun}
                isGenerating={generateExport.isPending}
                onGenerateExport={(periodKey) => generateExport.mutate({ periodKey })}
              />
            ))
          ) : (
            <div className="text-sm text-[#606060]">No payroll runs imported yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
