"use client";

import type { getBusinessProfile } from "@tamias/contracts/business-type";
import { Badge } from "@tamias/ui/badge";
import { Button } from "@tamias/ui/button";
import { SelfAssessmentWorkspace } from "./self-assessment-workspace";
import Link from "@/framework/link";

export function SelfAssessmentOverview({
  profile,
}: {
  profile: ReturnType<typeof getBusinessProfile>;
}) {
  return (
    <div className="mx-auto max-w-[1120px] py-8 space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif">Tax overview</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your business records and the tax tasks that matter to you.
          </p>
        </div>
        <Badge variant="outline" className="px-3 py-1.5">
          {profile.isSoleTrader ? "Sole trader" : "CIS subcontractor"}
          {profile.isSoleTrader && profile.usesCis ? " · CIS" : ""}
        </Badge>
      </div>

      {(!profile.structure || profile.structure === "not_sure") && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-5 text-sm">
          <p className="text-muted-foreground">
            CIS is saved. Confirm your business structure to personalise your tax overview.
          </p>
          <Link href="/settings#business-profile" className="underline underline-offset-4">
            Set business structure
          </Link>
        </div>
      )}

      <SelfAssessmentWorkspace />

      {profile.usesCis && (
        <section
          className="grid gap-4 border-b pb-7 sm:grid-cols-[1fr_auto] sm:items-center"
          aria-labelledby="cis-records-heading"
        >
          <div>
            <h2 id="cis-records-heading" className="text-lg font-medium">
              Keep your CIS statements
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Save the payment and deduction statements your contractors give you, alongside your
              other business documents.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/vault">Open documents</Link>
          </Button>
        </section>
      )}

      <details className="group border-b pb-5">
        <summary className="cursor-pointer text-sm font-medium">Other tax tools</summary>
        <p className="mt-3 text-sm text-muted-foreground">
          Use these only when they apply to your business.
        </p>
        <div className="mt-4 flex flex-wrap gap-5 text-sm">
          <Link href="/compliance/vat" className="underline underline-offset-4">
            VAT
          </Link>
          <Link href="/compliance/payroll" className="underline underline-offset-4">
            Payroll
          </Link>
          <Link href="/settings#business-profile" className="underline underline-offset-4">
            Business details
          </Link>
        </div>
      </details>
    </div>
  );
}
