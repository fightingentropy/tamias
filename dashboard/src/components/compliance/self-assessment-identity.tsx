"use client";

import { useRef, useState } from "react";
import type { SelfAssessmentIdentity } from "@tamias/compliance";
import { Button } from "@tamias/ui/button";
import { Input } from "@tamias/ui/input";
import { DialogDescription, DialogTitle } from "@tamias/ui/dialog";
import {
  taxSelectStyle,
  taxYearLabel,
  type TaxFiling,
  type TaxReport,
  type TaxRequest,
} from "./self-assessment-types";

const confirmations = [
  "This business is my only taxable income for this tax year.",
  "I qualify for the standard Personal Allowance.",
  "I have no other charges, reliefs, repayments or tax already paid beyond the recorded CIS deductions.",
  "My business operated for the full tax year.",
  "Standard self-employed National Insurance applies to me.",
];

export function SelfAssessmentIdentityForm({
  report,
  request,
  isTest,
  onPrepared,
  onBusy,
}: {
  report: TaxReport;
  request: TaxRequest;
  isTest: boolean;
  onPrepared: (filing: TaxFiling) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [confirmed, setConfirmed] = useState<boolean[]>(confirmations.map(() => false));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sending = useRef(false);
  async function prepare(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current || !confirmed.every(Boolean) || report.filingBlockers.length) return;
    const fields = new FormData(event.currentTarget);
    const value = (name: string) => String(fields.get(name) ?? "").trim();
    const identity: SelfAssessmentIdentity = {
      fullName: value("fullName"),
      utr: value("utr"),
      nino: value("nino").toUpperCase().replaceAll(" ", ""),
      dateOfBirth: value("dateOfBirth"),
      taxpayerStatus: value("taxpayerStatus") as SelfAssessmentIdentity["taxpayerStatus"],
      onlyThisBusinessIncome: true,
      standardPersonalAllowance: true,
      noOtherChargesOrReliefs: true,
      businessOperatedFullYear: true,
      standardNationalInsurance: true,
      class2Choice: value("class2Choice") as SelfAssessmentIdentity["class2Choice"],
    };
    sending.current = true;
    setBusy(true);
    onBusy(true);
    setError(null);
    try {
      const filing = await request<TaxFiling>(
        `/self-assessment/${report.taxYear}/prepare`,
        { fingerprint: report.fingerprint, identity },
        "POST",
      );
      onPrepared(filing);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not prepare this return.");
    } finally {
      sending.current = false;
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <form onSubmit={prepare} className="space-y-5">
      <DialogTitle>Prepare your {taxYearLabel(report.taxYear)} return</DialogTitle>
      <DialogDescription>
        {isTest ? "Test service: use fictional taxpayer details. " : ""}
        Preparing saves a return for your review. You submit it separately after checking the
        figures.
      </DialogDescription>
      <fieldset disabled={busy} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm sm:col-span-2">
            Full name
            <Input name="fullName" required maxLength={56} autoComplete="name" />
          </label>
          <label className="space-y-2 text-sm">
            Unique Taxpayer Reference (UTR)
            <Input
              name="utr"
              required
              pattern="[0-9]{10}"
              inputMode="numeric"
              maxLength={10}
              autoComplete="off"
              placeholder="10 digits"
            />
          </label>
          <label className="space-y-2 text-sm">
            National Insurance number
            <Input
              name="nino"
              required
              maxLength={13}
              autoComplete="off"
              className="uppercase"
              placeholder="AB123456C"
            />
          </label>
          <label className="space-y-2 text-sm">
            Date of birth
            <Input
              name="dateOfBirth"
              type="date"
              required
              max={new Date().toISOString().slice(0, 10)}
            />
          </label>
          <label className="space-y-2 text-sm">
            Taxpayer status
            <select name="taxpayerStatus" required defaultValue="" className={taxSelectStyle}>
              <option value="" disabled>
                Select your tax region
              </option>
              <option value="U">England / Northern Ireland</option>
              <option value="C">Wales</option>
              <option value="S">Scotland</option>
            </select>
          </label>
        </div>
        <div className="space-y-3 border-t pt-4">
          {confirmations.map((label, index) => (
            <label key={label} className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                required
                checked={confirmed[index]}
                onChange={(e) =>
                  setConfirmed((old) =>
                    old.map((checked, i) => (i === index ? e.target.checked : checked)),
                  )
                }
              />
              {label}
            </label>
          ))}
        </div>
        <label className="block space-y-2 text-sm">
          Class 2 National Insurance
          <select name="class2Choice" required defaultValue="" className={taxSelectStyle}>
            <option value="" disabled>
              Select your choice
            </option>
            <option value="not_needed">Profit £6,845 or more: voluntary payments not needed</option>
            <option value="do_not_pay">Profit below £6,845: I choose not to pay voluntarily</option>
            <option value="pay_voluntarily">Profit below £6,845: I want to pay voluntarily</option>
          </select>
        </label>
        <p className="text-xs text-muted-foreground">
          Voluntary Class 2 payments need a separate calculation through HMRC or an accountant.
        </p>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button
        type="submit"
        disabled={busy || !confirmed.every(Boolean) || Boolean(report.filingBlockers.length)}
      >
        {busy ? "Preparing…" : "Save return for review"}
      </Button>
    </form>
  );
}
