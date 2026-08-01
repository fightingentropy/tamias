"use client";

import { Badge } from "@tamias/ui/badge";
import { Button } from "@tamias/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@tamias/ui/card";
import { SubmitButton } from "@tamias/ui/submit-button";
import { useToast } from "@tamias/ui/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import Link from "@/framework/link";
import { useMemo } from "react";
import { FormatAmount } from "@/components/format-amount";
import { useTaxReturnParams } from "@/hooks/use-tax-return-params";
import { useTRPC } from "@/trpc/client";

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

export function VatDashboard() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { setParams: setTaxReturnParams } = useTaxReturnParams();

  const dashboardQuery = useQuery(trpc.vat.getDashboard.queryOptions());
  const submissionsQuery = useQuery(trpc.vat.listSubmissions.queryOptions());
  const latestDraftId = dashboardQuery.data?.latestDraft?.id;

  const draftQuery = useQuery({
    ...trpc.vat.getDraft.queryOptions(latestDraftId ? { vatReturnId: latestDraftId } : undefined),
    enabled: !!latestDraftId,
  });

  const invalidateVat = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: trpc.vat.getDashboard.queryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.vat.listSubmissions.queryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.vat.getDraft.pathKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.compliance.getProfile.queryKey(),
      }),
    ]);
  };

  const recalculateDraft = useMutation(
    trpc.vat.recalculateDraft.mutationOptions({
      onSuccess: async () => {
        await invalidateVat();
        toast({
          title: "VAT draft recalculated",
          description: "The latest VAT draft has been rebuilt from the journal layer.",
        });
      },
    }),
  );

  const submitReturn = useMutation(
    trpc.vat.submit.mutationOptions({
      onSuccess: async () => {
        await invalidateVat();
        toast({
          title: "VAT return submitted",
          description: "The latest VAT return was submitted and an evidence pack was stored.",
        });
      },
    }),
  );

  const dashboard = dashboardQuery.data;
  const draft = draftQuery.data ?? dashboard?.latestDraft ?? null;
  const openObligation = useMemo(
    () => dashboard?.obligations?.find((item) => item.status.toLowerCase() === "open"),
    [dashboard?.obligations],
  );

  if (dashboardQuery.isLoading) {
    return <div className="text-sm text-[#606060]">Loading VAT workspace...</div>;
  }

  if (!dashboard?.profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Set up your UK filing profile first</CardTitle>
          <CardDescription>
            VAT filing is gated behind a UK Ltd filing profile so Tamias can store your VRN,
            accounting basis, and year-end defaults separately from generic team settings.
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
            <CardTitle className="text-base">Connection</CardTitle>
            <CardDescription>HMRC VAT app status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Badge variant={dashboard.connected ? "default" : "secondary"}>
              {dashboard.connected ? "Connected" : "Not connected"}
            </Badge>
            <div className="text-sm text-[#606060]">
              {dashboard.connected
                ? "HMRC obligations can be synced and returns can be filed from Tamias."
                : "Connect the HMRC VAT app before filing."}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Open obligation</CardTitle>
            <CardDescription>Current obligation from HMRC</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-lg font-medium">
              {openObligation?.periodKey ?? "No open obligation"}
            </div>
            <div className="text-sm text-[#606060]">Due {formatDate(openObligation?.dueDate)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Latest submission</CardTitle>
            <CardDescription>Most recent VAT filing outcome</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-lg font-medium">
              {dashboard.latestSubmission?.periodKey ?? "No submission yet"}
            </div>
            <div className="text-sm text-[#606060]">
              {dashboard.latestSubmission?.submittedAt
                ? `Submitted ${formatDate(dashboard.latestSubmission.submittedAt)}`
                : "Waiting for first filing"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Draft return</CardTitle>
          <CardDescription>
            This is the working VAT return. Use edit draft for return details, box adjustments, and
            the HMRC submission body.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {draft?.periodKey ?? openObligation?.periodKey ?? "Current quarter"}
            </Badge>
            <Badge variant="outline">
              {dashboard.profile.accountingBasis === "cash" ? "Cash basis" : "Accrual basis"}
            </Badge>
          </div>

          {draft?.lines?.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {draft.lines.map((line) => (
                <div
                  key={line.code}
                  className="flex items-center justify-between rounded-lg border px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-medium">{line.label}</div>
                    <div className="text-xs text-[#606060] uppercase">{line.code}</div>
                  </div>
                  <div className="text-sm font-medium">
                    <FormatAmount amount={line.amount} currency={draft.currency} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-[#606060]">
              No VAT draft exists yet. Recalculate once your filing profile and HMRC connection are
              ready.
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <SubmitButton
              isSubmitting={recalculateDraft.isPending}
              disabled={recalculateDraft.isPending || !dashboard.connected}
              onClick={() =>
                recalculateDraft.mutate({
                  obligationId: openObligation?.id,
                  vatReturnId: draft?.id,
                })
              }
            >
              Recalculate draft
            </SubmitButton>

            <SubmitButton
              isSubmitting={submitReturn.isPending}
              disabled={submitReturn.isPending || !dashboard.connected || !draft?.id}
              onClick={() => {
                if (!draft?.id) {
                  return;
                }

                submitReturn.mutate({
                  vatReturnId: draft.id,
                  declarationAccepted: true,
                  idempotencyKey: crypto.randomUUID(),
                  confirmationId: crypto.randomUUID(),
                  userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
                });
              }}
            >
              Submit return
            </SubmitButton>

            <Button variant="outline" onClick={() => setTaxReturnParams({ taxReturn: "vat" })}>
              <Pencil className="mr-2 size-3" />
              Edit draft
            </Button>
          </div>

          <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-4">
            <div>
              <div className="text-xs uppercase text-[#878787]">Sales items</div>
              <div className="text-lg font-medium">{draft?.salesCount ?? 0}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-[#878787]">Purchase items</div>
              <div className="text-lg font-medium">{draft?.purchaseCount ?? 0}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-[#878787]">Adjustments</div>
              <div className="text-lg font-medium">{draft?.adjustmentCount ?? 0}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-[#878787]">Net VAT due</div>
              <div className="text-lg font-medium">
                {draft ? <FormatAmount amount={draft.netVatDue} currency={draft.currency} /> : "-"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Submission history</CardTitle>
          <CardDescription>
            Evidence packs are created on submission and can be fetched from the API for audit
            reproduction.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {submissionsQuery.data?.length ? (
            submissionsQuery.data.map((submission) => (
              <div
                key={submission.id}
                className="flex flex-col gap-2 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="font-medium">{submission.periodKey}</div>
                  <div className="text-sm text-[#606060]">
                    {submission.submittedAt
                      ? `Submitted ${formatDate(submission.submittedAt)}`
                      : "Draft only"}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant="outline">{submission.status}</Badge>
                  <div className="text-sm font-medium">
                    <FormatAmount
                      amount={submission.netVatDue ?? 0}
                      currency={dashboard.profile?.baseCurrency ?? "GBP"}
                    />
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-[#606060]">No VAT submissions have been recorded yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
