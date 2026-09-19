"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@tamias/ui/button";
import { Badge } from "@tamias/ui/badge";
import { Dialog, DialogContent } from "@tamias/ui/dialog";
import { SelfAssessmentIdentityForm } from "./self-assessment-identity";
import { SelfAssessmentFilingDetail } from "./self-assessment-filing-detail";
import {
  filingStatusLabels,
  type TaxFiling,
  type TaxFilingHistory,
  type TaxReport,
  type TaxRequest,
} from "./self-assessment-types";

export function SelfAssessmentFiling({
  report,
  request,
  teamId,
}: {
  report: TaxReport;
  request: TaxRequest;
  teamId: string;
}) {
  const client = useQueryClient();
  const [showIdentity, setShowIdentity] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const queryKey = ["self-assessment-filings", teamId, report.taxYear];
  const history = useQuery({
    queryKey,
    queryFn: () => request<TaxFilingHistory>(`/self-assessment/${report.taxYear}/submissions`),
    retry: false,
    gcTime: 0,
  });
  const connection = history.data?.connection;
  const filings = history.data?.data ?? [];
  const selected = filings.find((filing) => filing.id === selectedId) ?? filings[0];
  const existing = filings.find(
    (filing) =>
      filing.environment === "production" &&
      ["pending", "acknowledged", "accepted", "unknown"].includes(filing.status),
  );
  const canPrepare = Boolean(
    connection?.ready &&
    connection.supportedTaxYear === report.taxYear &&
    !report.filingBlockers.length &&
    !existing &&
    !history.isError,
  );
  async function changed(filing?: TaxFiling) {
    if (filing) {
      client.setQueryData<TaxFilingHistory>(queryKey, (old) =>
        old
          ? {
              ...old,
              data: [filing, ...old.data.filter((item) => item.id !== filing.id)],
            }
          : old,
      );
      setSelectedId(filing.id);
    }
    await client.invalidateQueries({ queryKey });
  }
  return (
    <section
      id="hmrc-filing"
      aria-labelledby="hmrc-filing-heading"
      className="space-y-5 border-t pt-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="hmrc-filing-heading" className="text-xl font-serif">
          File your Self Assessment
        </h3>
        {connection && (
          <Badge variant="outline">
            {connection.environment === "test"
              ? "Test service"
              : connection.ready
                ? "Live filing enabled"
                : "Live filing unavailable"}
          </Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Prepare, review and submit one cash-basis sole-trader return for 2025/26, including recorded
        CIS deductions. Other income and additional return sections need another filing route.
      </p>
      {connection?.environment === "test" && (
        <p className="border p-4 text-sm">
          Real filing is not enabled. This connection uses HMRC's test service; test submissions do
          not file your tax return.
        </p>
      )}
      {history.isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          Checking your HMRC connection…
        </p>
      )}
      {history.isError && (
        <div role="alert" className="space-y-3 text-sm">
          <p>{history.error.message}</p>
          <Button variant="outline" onClick={() => void history.refetch()}>
            Check connection again
          </Button>
        </div>
      )}
      {!!(report.filingBlockers.length || connection?.blockers.length) && (
        <div className="space-y-3 bg-muted/30 p-4 text-sm">
          <p className="font-medium">Before you prepare</p>
          <ul className="list-disc space-y-2 pl-5">
            {[...new Set([...report.filingBlockers, ...(connection?.blockers ?? [])])].map(
              (message) => (
                <li key={message}>{message}</li>
              ),
            )}
          </ul>
          {report.needsReview > 0 && (
            <a className="inline-block underline underline-offset-4" href="#tax-transactions">
              Review transactions
            </a>
          )}
        </div>
      )}
      {existing && (
        <p className="text-sm">
          A live return for this year is already{" "}
          {existing.status === "accepted" ? "accepted" : "awaiting a confirmed outcome"}. Use its
          status and receipt below.
        </p>
      )}
      <Button disabled={!canPrepare || preparing} onClick={() => setShowIdentity(true)}>
        Prepare return for review
      </Button>
      {!!filings.length && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Saved returns</h4>
          <div className="flex flex-wrap gap-2">
            {filings.map((filing) => (
              <Button
                key={filing.id}
                size="sm"
                variant={selected?.id === filing.id ? "default" : "outline"}
                onClick={() => setSelectedId(filing.id)}
              >
                {new Date(filing.createdAt).toLocaleDateString("en-GB")} ·{" "}
                {filingStatusLabels[filing.status]}
                {filing.environment === "test" ? " · test" : ""}
              </Button>
            ))}
          </div>
        </div>
      )}
      {selected && connection && (
        <SelfAssessmentFilingDetail
          key={`${selected.id}-${report.fingerprint}-${connection.environment}`}
          filing={selected}
          report={report}
          connection={connection}
          request={request}
          onChanged={changed}
        />
      )}
      <Dialog
        open={showIdentity && canPrepare}
        onOpenChange={(open) => {
          if (!preparing) setShowIdentity(open);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto p-6 sm:max-w-xl sm:p-8">
          {showIdentity && connection && (
            <SelfAssessmentIdentityForm
              report={report}
              request={request}
              isTest={connection.environment === "test"}
              onBusy={setPreparing}
              onPrepared={(filing) => {
                setShowIdentity(false);
                void changed(filing);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
