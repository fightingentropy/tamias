"use client";

import { useRef, useState } from "react";
import { Button } from "@tamias/ui/button";
import { Input } from "@tamias/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@tamias/ui/dialog";
import {
  downloadTaxEvidence,
  filingIsCurrent,
  filingStatusLabels,
  taxMoney,
  taxYearLabel,
  type TaxConnection,
  type TaxFiling,
  type TaxReport,
  type TaxRequest,
} from "./self-assessment-types";

export function SelfAssessmentFilingDetail({
  filing,
  report,
  connection,
  request,
  onChanged,
}: {
  filing: TaxFiling;
  report: TaxReport;
  connection: TaxConnection;
  request: TaxRequest;
  onChanged: (filing?: TaxFiling) => Promise<unknown>;
}) {
  const [declared, setDeclared] = useState(false);
  const [senderId, setSenderId] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const sending = useRef(false);
  const isTest = filing.environment === "test";
  const current = filingIsCurrent(filing, report, connection);
  const canSubmit =
    filing.status === "prepared" &&
    current &&
    connection.ready &&
    !report.filingBlockers.length &&
    declared &&
    (isTest || Boolean(senderId.trim() && password)) &&
    !uncertain;
  const canPoll =
    Boolean(filing.correlationId) && ["acknowledged", "unknown", "pending"].includes(filing.status);
  const pollDue = !filing.nextPollAt || Date.parse(filing.nextPollAt) <= Date.now();
  async function submit() {
    if (sending.current || !canSubmit) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    try {
      // Credentials stay in this component and this one request, outside query/mutation caches.
      const updated = await request<TaxFiling>(
        `/self-assessment/${report.taxYear}/submissions/${filing.id}/submit`,
        {
          declarationAccepted: true,
          confirmedIrMark: filing.irMark,
          ...(isTest ? {} : { senderId: senderId.trim(), password }),
        },
        "POST",
      );
      await onChanged(updated);
    } catch (problem) {
      setUncertain(true);
      setError(
        `${problem instanceof Error ? problem.message : "The connection was interrupted."} Refresh the submission status before doing anything else; the return may have been received.`,
      );
    } finally {
      setPassword("");
      setSenderId("");
      setDeclared(false);
      setConfirm(false);
      sending.current = false;
      setBusy(false);
    }
  }
  async function action(kind: "poll" | "evidence" | "refresh") {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    try {
      if (kind === "refresh") await onChanged();
      else if (kind === "poll") {
        const updated = await request<TaxFiling>(
          `/self-assessment/${report.taxYear}/submissions/${filing.id}/poll`,
          {},
          "POST",
        );
        await onChanged(updated);
      } else {
        const evidence = await request(
          `/self-assessment/${report.taxYear}/submissions/${filing.id}/evidence`,
        );
        downloadTaxEvidence(
          evidence,
          `Tamias-${report.taxYear}-${filing.status}-${filing.id}.json`,
        );
      }
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not complete this action.");
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5 border bg-card p-5 sm:p-6" aria-label="Prepared tax return">
      <div>
        <h4 className="font-medium">{filingStatusLabels[filing.status]}</h4>
        <p className="mt-1 text-sm text-muted-foreground">
          {isTest
            ? "Test return · does not fulfil your filing obligation"
            : `${taxYearLabel(report.taxYear)} Self Assessment`}
        </p>
      </div>
      {filing.receipt && (
        <div role="status" className="space-y-2 border-l-2 pl-4 text-sm">
          <p>{filing.receipt.summary}</p>
          {filing.receipt.errors.map((item, i) => (
            <p key={`${item.number}-${i}`}>
              {item.number ? `${item.number}: ` : ""}
              {item.text}
            </p>
          ))}
        </div>
      )}
      {["unknown", "pending"].includes(filing.status) && (
        <p className="text-sm text-muted-foreground">
          This submission needs a status check. Do not send another return while its outcome is
          uncertain.
        </p>
      )}
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Name</dt>
          <dd>{filing.identity.fullName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">UTR</dt>
          <dd>Ending {filing.identity.utr.slice(-4)}</dd>
        </div>
      </dl>
      <dl className="space-y-3 border-y py-4 text-sm">
        {filing.calculation.groups
          .filter((group) => group.wholePounds !== 0)
          .map((group) => (
            <div key={group.id} className="flex justify-between gap-3">
              <dt>{group.name}</dt>
              <dd className="tabular-nums">{taxMoney(group.wholePounds * 100)}</dd>
            </div>
          ))}
        {[
          ["Business profit", filing.calculation.profitPounds * 100],
          ["Income Tax", filing.calculation.incomeTaxPence],
          ["Class 4 National Insurance", filing.calculation.class4Pence],
          ["CIS tax already deducted", filing.calculation.cisDeductionsPence],
          [
            filing.calculation.totalTaxPence < 0
              ? "Calculated overpayment"
              : "Tax due on this return",
            Math.abs(filing.calculation.totalTaxPence),
          ],
        ].map(([label, amount]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt>{label}</dt>
            <dd className="tabular-nums">{taxMoney(Number(amount))}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">
        Figures use HMRC whole-pound rounding. Payments on account and other amounts on your HMRC
        account are separate. A calculated overpayment is subject to HMRC processing.
      </p>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">Return reference</summary>
        <p className="mt-2 break-all font-mono">{filing.irMark}</p>
        {filing.correlationId && (
          <p className="mt-2 break-all">HMRC reference: {filing.correlationId}</p>
        )}
      </details>
      {filing.status === "prepared" && !current && (
        <p role="alert" className="text-sm text-destructive">
          Your records or HMRC connection changed. Prepare a new return and review the updated
          figures.
        </p>
      )}
      {filing.status === "prepared" && current && !uncertain && (
        <fieldset
          disabled={busy || !connection.ready || Boolean(report.filingBlockers.length)}
          className="space-y-4"
        >
          {!isTest && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Enter your Government Gateway credentials when you are ready to submit. They are
                used once and are not saved with your return.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-2 text-sm">
                  Government Gateway user ID
                  <Input
                    autoComplete="off"
                    value={senderId}
                    onChange={(e) => setSenderId(e.target.value)}
                  />
                </label>
                <label className="space-y-2 text-sm">
                  Government Gateway password
                  <Input
                    type="password"
                    autoComplete="off"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
              </div>
            </div>
          )}
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={declared}
              onChange={(e) => setDeclared(e.target.checked)}
            />
            I declare that this return is correct and complete to the best of my knowledge and
            belief.
          </label>
          <Button disabled={busy || !canSubmit} onClick={() => setConfirm(true)}>
            {isTest ? "Send test return" : "Submit return to HMRC"}
          </Button>
        </fieldset>
      )}
      <div className="flex flex-wrap gap-3">
        {(uncertain || ["pending", "unknown", "acknowledged"].includes(filing.status)) && (
          <Button variant="outline" disabled={busy} onClick={() => void action("refresh")}>
            Refresh submission status
          </Button>
        )}
        {canPoll && (
          <Button variant="outline" disabled={busy || !pollDue} onClick={() => void action("poll")}>
            Check HMRC status
          </Button>
        )}
        <Button variant="outline" disabled={busy} onClick={() => void action("evidence")}>
          Download return and receipt
        </Button>
      </div>
      {canPoll && !pollDue && (
        <p className="text-xs text-muted-foreground">
          HMRC allows another check after {new Date(filing.nextPollAt!).toLocaleTimeString("en-GB")}
          . Refresh the status then.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Dialog
        open={confirm}
        onOpenChange={(open) => {
          if (!busy) setConfirm(open);
        }}
      >
        <DialogContent className="p-6 sm:p-8">
          <DialogTitle>
            {isTest
              ? "Send this test return?"
              : `Submit your ${taxYearLabel(report.taxYear)} return?`}
          </DialogTitle>
          <DialogDescription>
            {filing.identity.fullName} · UTR ending {filing.identity.utr.slice(-4)}.{" "}
            {isTest
              ? "This sends fictional details to HMRC's test service."
              : "This sends your tax return to HMRC's live service."}
          </DialogDescription>
          <p className="break-all text-xs text-muted-foreground">
            Return reference: {filing.irMark}
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" disabled={busy} onClick={() => setConfirm(false)}>
              Go back
            </Button>
            <Button disabled={busy || !canSubmit} onClick={() => void submit()}>
              {busy
                ? "Submitting…"
                : isTest
                  ? "Confirm test submission"
                  : "Confirm submission to HMRC"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
