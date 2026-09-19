"use client";

import { useState } from "react";
import type { SelfAssessmentProfile } from "@tamias/compliance/self-assessment";
import { Button } from "@tamias/ui/button";
import { Input } from "@tamias/ui/input";
import type { TaxReport, TaxRequest } from "./self-assessment-types";

const confirmations = [
  ["soleTrader", "This return is for my sole-trader business."],
  ["cashBasis", "I use cash-basis accounting: money received and expenses paid."],
  ["recordsComplete", "I have included all business accounts, cash income and expenses."],
  ["adjustmentsReviewed", "I have checked allowances, adjustments and losses."],
  ["otherIncomeReviewed", "I have checked all my other income and selected any sections below."],
] as const;
const sections: [SelfAssessmentProfile["additionalSections"][number], string][] = [
  ["employment", "Employment / PAYE"],
  ["property", "Property income"],
  ["savings_dividends", "Savings interest or dividends"],
  ["capital_gains", "Capital gains, including crypto"],
  ["foreign", "Foreign income"],
  ["partnership", "Partnership income"],
  ["pensions_benefits", "Pensions or taxable benefits"],
  ["student_loans", "Student or postgraduate loans"],
  ["reliefs", "Other reliefs or tax adjustments"],
  ["multiple_businesses", "More than one business"],
  ["vat_registered", "VAT registration"],
  ["capital_allowances", "Capital allowances"],
  ["loss_relief", "Loss relief"],
  ["non_resident", "Residence adjustments"],
  ["mtd", "Making Tax Digital for Income Tax"],
];

export function SelfAssessmentProfileForm({
  report,
  request,
  onSaved,
}: {
  report: TaxReport;
  request: TaxRequest;
  onSaved: () => Promise<unknown>;
}) {
  const [profile, setProfile] = useState(report.profile);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  function update(values: Partial<SelfAssessmentProfile>) {
    setSaved(false);
    setProfile((old) => ({ ...old, ...values }));
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await request(`/self-assessment/${report.taxYear}/profile`, profile, "PUT");
      await onSaved();
      setSaved(true);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Could not save your return checks.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="border p-5 sm:p-6">
      <summary className="cursor-pointer font-medium">Your business and return status</summary>
      <form onSubmit={save} className="mt-5 space-y-5">
        <p className="text-sm text-muted-foreground">
          Confirm these when you have checked your records. Investment withdrawals and personal
          transfers are not automatically business income, but gains and other income may need their
          own return sections.
        </p>
        <fieldset disabled={busy} className="space-y-5">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={Boolean(profile.filedElsewhere)}
              onChange={(e) => update({ filedElsewhere: e.target.checked })}
            />
            I already filed this year's return outside Tamias.
          </label>
          <p className="text-xs text-muted-foreground">
            This records your confirmation and prevents a new submission here. Your transactions
            remain available for organisation and analytics.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2 text-sm">
              Business or trading name
              <Input
                required
                maxLength={100}
                value={profile.businessName}
                onChange={(e) => update({ businessName: e.target.value })}
              />
            </label>
            <label className="block space-y-2 text-sm">
              Business description
              <Input
                required
                maxLength={200}
                value={profile.businessDescription}
                onChange={(e) => update({ businessDescription: e.target.value })}
              />
            </label>
          </div>
          <div className="space-y-3">
            {confirmations.map(([key, label]) => (
              <label key={key} className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={profile[key]}
                  onChange={(e) => update({ [key]: e.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>
          <fieldset className="space-y-3 border-t pt-4">
            <legend className="pt-4 text-sm font-medium">Other sections that apply</legend>
            <p className="text-sm text-muted-foreground">
              Tamias currently files one simple sole-trader business for 2025/26. Selecting another
              section keeps your working papers available and prevents an incomplete submission.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {sections.map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={profile.additionalSections.includes(key)}
                    onChange={(e) =>
                      update({
                        additionalSections: e.target.checked
                          ? [...profile.additionalSections, key]
                          : profile.additionalSections.filter((v) => v !== key),
                      })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        </fieldset>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="text-sm text-muted-foreground">
            Return checks saved.
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save return checks"}
        </Button>
      </form>
    </details>
  );
}
