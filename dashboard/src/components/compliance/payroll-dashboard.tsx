"use client";

import { Badge } from "@tamias/ui/badge";
import { Button } from "@tamias/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@tamias/ui/card";
import { Icons } from "@tamias/ui/icons";
import { Input } from "@tamias/ui/input";
import { Label } from "@tamias/ui/label";
import { Skeleton } from "@tamias/ui/skeleton";
import { SubmitButton } from "@tamias/ui/submit-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@tamias/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@tamias/ui/tabs";
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

function PayrollDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-full max-w-[480px]" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="space-y-2">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-3 w-36" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Skeleton className="h-10 w-72" />
      <Card>
        <CardContent className="py-6 space-y-3">
          <Skeleton className="h-4 w-full max-w-[400px]" />
          <Skeleton className="h-4 w-full max-w-[320px]" />
          <Skeleton className="h-4 w-full max-w-[360px]" />
        </CardContent>
      </Card>
    </div>
  );
}

function PayrollRunActions({
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
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={isGenerating}
        onClick={() => onGenerateExport(run.periodKey)}
      >
        Export
      </Button>
      {download.url ? (
        <Button asChild size="sm" variant="ghost">
          <a href={download.url}>Download</a>
        </Button>
      ) : null}
    </div>
  );
}

function CostBreakdown({
  run,
}: {
  run: PayrollRun | null;
}) {
  if (!run) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cost breakdown</CardTitle>
          <CardDescription>
            Import your first payroll run to see the liability breakdown here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent mb-3">
              <Icons.Accounts size={22} className="text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No payroll data yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const netPay = run.liabilityTotals.grossPay - run.liabilityTotals.payeLiability;

  const items = [
    { label: "Gross pay", amount: run.liabilityTotals.grossPay },
    { label: "Employer taxes (NIC)", amount: run.liabilityTotals.employerTaxes },
    { label: "PAYE liability", amount: run.liabilityTotals.payeLiability },
    { label: "Net pay", amount: netPay },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Cost breakdown</CardTitle>
            <CardDescription>
              Latest run: {run.payPeriodStart} to {run.payPeriodEnd}
            </CardDescription>
          </div>
          <Badge variant="outline">{run.periodKey}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between rounded-lg border px-4 py-3"
            >
              <div className="text-sm text-muted-foreground">{item.label}</div>
              <div className="text-sm font-medium">
                <FormatAmount amount={item.amount} currency={run.currency} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function PayrollDashboard() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
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
        setActiveTab("runs");
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
    return <PayrollDashboardSkeleton />;
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
      <div className="space-y-1">
        <h1 className="text-2xl font-medium">Payroll</h1>
        <p className="text-sm text-muted-foreground">
          Import payroll journals, track PAYE liability totals, and export payroll packs for year-end.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent">
                <Icons.ReceiptLong size={18} className="text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">Imported runs</CardTitle>
                <CardDescription>Payroll runs on the ledger</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-semibold">{dashboard.summary.importedRunCount}</div>
            <div className="text-sm text-muted-foreground">
              {dashboard.summary.latestRunAt
                ? `Latest ${formatDate(dashboard.summary.latestRunAt)}`
                : "No runs yet"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent">
                <Icons.Currency size={18} className="text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">PAYE liability</CardTitle>
                <CardDescription>Total PAYE and NIC due</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-semibold">
              <FormatAmount
                amount={dashboard.summary.payeLiability}
                currency={dashboard.summary.currency}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              Import-first only. RTI stays out of scope.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent">
                <Icons.CalendarMonth size={18} className="text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">Latest run</CardTitle>
                <CardDescription>Most recent payroll import</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-semibold">
              {latestRun ? formatDate(latestRun.payPeriodEnd) : "No run yet"}
            </div>
            <div className="text-sm text-muted-foreground">
              {latestRun
                ? `${latestRun.source} import with ${latestRun.lineCount} lines`
                : "Import CSV or manual journals to begin"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="import">Import</TabsTrigger>
          <TabsTrigger value="runs">
            Runs
            {runs.length > 0 ? (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {runs.length}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <CostBreakdown run={latestRun as PayrollRun | null} />

          {latestRun ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Latest run summary</CardTitle>
                    <CardDescription>
                      {latestRun.payPeriodStart} to {latestRun.payPeriodEnd}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={latestRun.status === "exported" ? "default" : "secondary"}>
                      {latestRun.status}
                    </Badge>
                    <Badge variant="outline">{latestRun.source}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-4">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Run date
                    </div>
                    <div className="text-sm font-medium mt-1">{formatDate(latestRun.runDate)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Journal lines
                    </div>
                    <div className="text-sm font-medium mt-1">{latestRun.lineCount}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Gross pay
                    </div>
                    <div className="text-sm font-medium mt-1">
                      <FormatAmount
                        amount={latestRun.liabilityTotals.grossPay}
                        currency={latestRun.currency}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      PAYE due
                    </div>
                    <div className="text-sm font-medium mt-1">
                      <FormatAmount
                        amount={latestRun.liabilityTotals.payeLiability}
                        currency={latestRun.currency}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="import" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Import payroll run</CardTitle>
              <CardDescription>
                Import a payroll journal from CSV or enter the journal lines manually. Each run
                becomes a first-class ledger input.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant={source === "csv" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSource("csv")}
                >
                  CSV import
                </Button>
                <Button
                  type="button"
                  variant={source === "manual" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSource("manual")}
                >
                  Manual journal
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <div className="space-y-1.5">
                  <Label>Pay period start</Label>
                  <Input
                    type="date"
                    value={payPeriodStart}
                    onChange={(event) => setPayPeriodStart(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Pay period end</Label>
                  <Input
                    type="date"
                    value={payPeriodEnd}
                    onChange={(event) => setPayPeriodEnd(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Run date</Label>
                  <Input
                    type="date"
                    value={runDate}
                    onChange={(event) => setRunDate(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Input
                    value={currency}
                    onChange={(event) => setCurrency(event.target.value.toUpperCase())}
                    placeholder="GBP"
                  />
                </div>
              </div>

              {source === "csv" ? (
                <div className="space-y-2">
                  <Label>CSV content</Label>
                  <Textarea
                    rows={8}
                    className="font-mono text-sm"
                    value={csvContent}
                    onChange={(event) => setCsvContent(event.target.value)}
                  />
                  <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                    <Icons.Info size={14} className="mt-0.5 shrink-0" />
                    <span>
                      Required columns: <code className="font-mono">accountCode</code>,{" "}
                      <code className="font-mono">debit</code>,{" "}
                      <code className="font-mono">credit</code>. Optional:{" "}
                      <code className="font-mono">description</code>. Each row becomes a journal
                      line in the ledger.
                    </span>
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
        </TabsContent>

        <TabsContent value="runs" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Payroll runs</CardTitle>
                  <CardDescription>
                    Imported runs remain export-first. No RTI or provider submissions are exposed
                    here.
                  </CardDescription>
                </div>
                {runs.length > 0 ? (
                  <Badge variant="secondary">{runs.length} runs</Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              {runs.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead>Run date</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead className="text-right">Lines</TableHead>
                        <TableHead className="text-right">PAYE liability</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {runs.map((run) => {
                        const r = run as PayrollRun;
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium whitespace-nowrap">
                              {r.payPeriodStart} to {r.payPeriodEnd}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {formatDate(r.runDate)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {r.source}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{r.lineCount}</TableCell>
                            <TableCell className="text-right">
                              <FormatAmount
                                amount={r.liabilityTotals.payeLiability}
                                currency={r.currency}
                              />
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={r.status === "exported" ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {r.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <PayrollRunActions
                                run={r}
                                isGenerating={generateExport.isPending}
                                onGenerateExport={(periodKey) =>
                                  generateExport.mutate({ periodKey })
                                }
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent mb-4">
                    <Icons.Accounts size={24} className="text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium mb-1">No payroll runs imported yet</p>
                  <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                    Import a payroll journal from CSV or enter journal lines manually to get started.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab("import")}
                  >
                    Import payroll run
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
