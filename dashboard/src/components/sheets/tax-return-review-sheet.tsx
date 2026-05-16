"use client";

import { Badge } from "@tamias/ui/badge";
import { Button } from "@tamias/ui/button";
import { Input } from "@tamias/ui/input";
import { Label } from "@tamias/ui/label";
import { ScrollArea } from "@tamias/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@tamias/ui/select";
import { Separator } from "@tamias/ui/separator";
import { Sheet, SheetContent } from "@tamias/ui/sheet";
import { SubmitButton } from "@tamias/ui/submit-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@tamias/ui/tabs";
import { Textarea } from "@tamias/ui/textarea";
import { useToast } from "@tamias/ui/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FileText, Pencil, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  CT_ADJUSTMENT_CATEGORIES,
  humanizeToken,
} from "@/components/compliance/year-end-dashboard.lib";
import { FormatAmount } from "@/components/format-amount";
import {
  openTaxReturnReviewWindow,
  type TaxReturnType,
  useTaxReturnParams,
} from "@/hooks/use-tax-return-params";
import { useTRPC } from "@/trpc/client";

type FilingProfilePreview = {
  enabled: boolean;
  companyName: string | null;
  companyNumber: string | null;
  companyAuthenticationCode: string | null;
  utr: string | null;
  vrn: string | null;
  vatScheme: "standard_quarterly" | null;
  accountingBasis: "cash" | "accrual";
  filingMode: "client" | "agent";
  agentReferenceNumber: string | null;
  yearEndMonth: number | null;
  yearEndDay: number | null;
  baseCurrency: string | null;
  principalActivity: string | null;
  directors: string[];
  signingDirectorName: string | null;
  approvalDate: string | null;
  averageEmployeeCount: number | null;
  ordinaryShareCount: number | null;
  ordinaryShareNominalValue: number | null;
  dormant: boolean | null;
  auditExemptionClaimed: boolean | null;
  membersDidNotRequireAudit: boolean | null;
  directorsAcknowledgeResponsibilities: boolean | null;
  accountsPreparedUnderSmallCompaniesRegime: boolean | null;
};

type Ct600DraftPreview = {
  companyName: string;
  companyNumber: string | null;
  utr: string | null;
  periodStart: string;
  periodEnd: string;
  currency: string;
  turnover: number;
  tradingProfits: number;
  lossesBroughtForward: number;
  chargeableProfits: number;
  grossCorporationTax: number;
  marginalRelief: number;
  netCorporationTaxChargeable: number;
  loansToParticipatorsTax: number;
  taxPayable: number;
  taxRate: number;
  declarationName: string;
  declarationStatus: string;
  returnType: "new";
  filingReadiness?: {
    isReady: boolean;
    blockers: string[];
    warnings: string[];
    supportedPath: string;
  };
  reviewItems?: string[];
  limitations?: string[];
  financialYearBreakdown?: Array<{
    financialYear: number;
    chargeableProfits: number;
    grossCorporationTax: number;
    marginalRelief: number;
    netCorporationTax: number;
    taxRate: number;
    chargeType: string;
  }>;
};

type CorporationTaxAdjustmentPreview = {
  id: string;
  category: string;
  label: string;
  amount: number;
  note: string | null;
  createdAt: string;
};

type VatLineCode = "box1" | "box2" | "box3" | "box4" | "box5" | "box6" | "box7" | "box8" | "box9";

type VatDraftPreview = {
  id: string;
  obligationId: string | null;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  status: "draft" | "ready" | "submitted" | "accepted" | "rejected";
  currency: string;
  lines: Array<{
    code: VatLineCode;
    label: string;
    amount: number;
  }>;
  netVatDue: number;
  salesCount: number;
  purchaseCount: number;
  adjustmentCount: number;
  updatedAt: string;
};

type ProfileFormState = {
  companyName: string;
  companyNumber: string;
  utr: string;
  vrn: string;
  baseCurrency: string;
  principalActivity: string;
  directors: string;
  signingDirectorName: string;
  approvalDate: string;
};

type CtAdjustmentFormState = {
  category: (typeof CT_ADJUSTMENT_CATEGORIES)[number]["value"];
  label: string;
  amount: string;
  note: string;
};

type VatAdjustmentFormState = {
  lineCode: VatLineCode;
  amount: string;
  reason: string;
  effectiveDate: string;
};

const profileDefaultForm: ProfileFormState = {
  companyName: "",
  companyNumber: "",
  utr: "",
  vrn: "",
  baseCurrency: "GBP",
  principalActivity: "",
  directors: "",
  signingDirectorName: "",
  approvalDate: "",
};

const ctAdjustmentDefaultForm: CtAdjustmentFormState = {
  category: "other",
  label: "",
  amount: "",
  note: "",
};

function vatAdjustmentDefaultForm(): VatAdjustmentFormState {
  return {
    lineCode: "box1",
    amount: "",
    reason: "",
    effectiveDate: new Date().toISOString().slice(0, 10),
  };
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function parseOptionalInteger(value: number | null | undefined) {
  return typeof value === "number" ? value : null;
}

function parseOptionalAmount(value: number | null | undefined) {
  return typeof value === "number" ? value : null;
}

function parseDirectors(value: string) {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function profileToForm(profile: FilingProfilePreview | null | undefined): ProfileFormState {
  if (!profile) {
    return profileDefaultForm;
  }

  return {
    companyName: profile.companyName ?? "",
    companyNumber: profile.companyNumber ?? "",
    utr: profile.utr ?? "",
    vrn: profile.vrn ?? "",
    baseCurrency: profile.baseCurrency ?? "GBP",
    principalActivity: profile.principalActivity ?? "",
    directors: Array.isArray(profile.directors) ? profile.directors.join("\n") : "",
    signingDirectorName: profile.signingDirectorName ?? "",
    approvalDate: profile.approvalDate ?? "",
  };
}

function lineAmount(draft: VatDraftPreview | null, code: VatLineCode) {
  return draft?.lines.find((line) => line.code === code)?.amount ?? 0;
}

function buildVatSubmissionPayload(draft: VatDraftPreview | null) {
  if (!draft) {
    return null;
  }

  return {
    periodKey: draft.periodKey,
    vatDueSales: Math.round(lineAmount(draft, "box1") * 100) / 100,
    vatDueAcquisitions: Math.round(lineAmount(draft, "box2") * 100) / 100,
    totalVatDue: Math.round(lineAmount(draft, "box3") * 100) / 100,
    vatReclaimedCurrPeriod: Math.round(lineAmount(draft, "box4") * 100) / 100,
    netVatDue: Math.abs(Math.round(lineAmount(draft, "box5") * 100) / 100),
    totalValueSalesExVAT: Math.round(lineAmount(draft, "box6")),
    totalValuePurchasesExVAT: Math.round(lineAmount(draft, "box7")),
    totalValueGoodsSuppliedExVAT: Math.round(lineAmount(draft, "box8")),
    totalAcquisitionsExVAT: Math.round(lineAmount(draft, "box9")),
    finalised: true,
  };
}

function AmountCell({ amount, currency }: { amount: number; currency: string }) {
  return <FormatAmount amount={amount} currency={currency} />;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs uppercase text-[#878787]">{label}</div>
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 border-b pb-5 last:border-b-0 last:pb-0">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">{title}</h3>
        {description ? <p className="text-sm text-[#606060]">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function InputField({
  id,
  label,
  value,
  onChange,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function TaxReturnHeader({
  type,
  title,
  subtitle,
  status,
}: {
  type: TaxReturnType;
  title: string;
  subtitle: string;
  status: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
      <div className="min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-[#606060]" />
          <h2 className="truncate text-base font-medium">{title}</h2>
          <Badge variant="outline">{status}</Badge>
        </div>
        <p className="text-sm text-[#606060]">{subtitle}</p>
      </div>
      <Button variant="outline" size="sm" onClick={() => openTaxReturnReviewWindow(type)}>
        <ExternalLink className="mr-2 size-3" />
        New window
      </Button>
    </div>
  );
}

export function TaxReturnReviewSheet() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { taxReturn, setParams } = useTaxReturnParams();
  const isOpen = Boolean(taxReturn);
  const [profileForm, setProfileForm] = useState<ProfileFormState>(profileDefaultForm);
  const [ctAdjustmentForm, setCtAdjustmentForm] =
    useState<CtAdjustmentFormState>(ctAdjustmentDefaultForm);
  const [vatAdjustmentForm, setVatAdjustmentForm] =
    useState<VatAdjustmentFormState>(vatAdjustmentDefaultForm);

  const profileQuery = useQuery({
    ...trpc.compliance.getProfile.queryOptions(),
    enabled: isOpen,
  });
  const yearEndQuery = useQuery({
    ...trpc.yearEnd.getPack.queryOptions(),
    enabled: taxReturn === "ct600",
  });
  const vatDashboardQuery = useQuery({
    ...trpc.vat.getDashboard.queryOptions(),
    enabled: taxReturn === "vat",
  });
  const latestVatDraftId = vatDashboardQuery.data?.latestDraft?.id;
  const vatDraftQuery = useQuery({
    ...trpc.vat.getDraft.queryOptions(
      latestVatDraftId ? { vatReturnId: latestVatDraftId } : undefined,
    ),
    enabled: taxReturn === "vat" && Boolean(latestVatDraftId),
  });

  const profile = profileQuery.data as FilingProfilePreview | null | undefined;
  const yearEndWorkspace = yearEndQuery.data;
  const ct600Draft = (yearEndWorkspace?.ct600Draft ?? null) as Ct600DraftPreview | null;
  const ctAdjustments = Array.isArray(yearEndWorkspace?.corporationTaxAdjustments)
    ? (yearEndWorkspace.corporationTaxAdjustments as CorporationTaxAdjustmentPreview[])
    : [];
  const yearEndPeriod = yearEndWorkspace?.period ?? null;
  const yearEndPack = yearEndWorkspace?.pack ?? null;
  const draft = (vatDraftQuery.data ??
    vatDashboardQuery.data?.latestDraft ??
    null) as VatDraftPreview | null;
  const vatSubmissionPayload = useMemo(() => buildVatSubmissionPayload(draft), [draft]);

  useEffect(() => {
    if (profile) {
      setProfileForm(profileToForm(profile));
    }
  }, [profile]);

  const invalidateCompliance = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: trpc.compliance.getProfile.queryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.yearEnd.getDashboard.queryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.yearEnd.getPack.queryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.vat.getDashboard.queryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.vat.getDraft.pathKey(),
      }),
    ]);
  };

  const upsertProfile = useMutation(
    trpc.compliance.upsertProfile.mutationOptions({
      onSuccess: async () => {
        await invalidateCompliance();
        toast({
          title: "Return details saved",
          description: "The filing profile has been refreshed for VAT and corporation tax.",
        });
      },
      onError: (error) => {
        toast({
          title: "Return details failed",
          description: error.message,
          variant: "destructive",
        });
      },
    }),
  );

  const saveProfile = () => {
    if (!profile) {
      return;
    }

    upsertProfile.mutate({
      enabled: profile.enabled,
      legalEntityType: "uk_ltd",
      provider: "hmrc-vat",
      companyName: profileForm.companyName || null,
      companyNumber: profileForm.companyNumber || null,
      companyAuthenticationCode: profile.companyAuthenticationCode ?? null,
      utr: profileForm.utr || null,
      vrn: profileForm.vrn || null,
      vatScheme: profile.vatScheme ?? "standard_quarterly",
      accountingBasis: profile.accountingBasis === "accrual" ? "accrual" : "cash",
      filingMode: profile.filingMode === "agent" ? "agent" : "client",
      agentReferenceNumber: profile.agentReferenceNumber ?? null,
      yearEndMonth: profile.yearEndMonth ?? 3,
      yearEndDay: profile.yearEndDay ?? 31,
      baseCurrency: profileForm.baseCurrency || profile.baseCurrency || "GBP",
      principalActivity: profileForm.principalActivity || null,
      directors: parseDirectors(profileForm.directors),
      signingDirectorName: profileForm.signingDirectorName || null,
      approvalDate: profileForm.approvalDate || null,
      averageEmployeeCount: parseOptionalInteger(profile.averageEmployeeCount),
      ordinaryShareCount: parseOptionalInteger(profile.ordinaryShareCount),
      ordinaryShareNominalValue: parseOptionalAmount(profile.ordinaryShareNominalValue),
      dormant: profile.dormant,
      auditExemptionClaimed: profile.auditExemptionClaimed,
      membersDidNotRequireAudit: profile.membersDidNotRequireAudit,
      directorsAcknowledgeResponsibilities: profile.directorsAcknowledgeResponsibilities,
      accountsPreparedUnderSmallCompaniesRegime: profile.accountsPreparedUnderSmallCompaniesRegime,
    });
  };

  const upsertCtAdjustment = useMutation(
    trpc.yearEnd.upsertCorporationTaxAdjustment.mutationOptions({
      onSuccess: async () => {
        await invalidateCompliance();
        setCtAdjustmentForm(ctAdjustmentDefaultForm);
        toast({
          title: "CT adjustment saved",
          description: "The corporation tax draft has been recalculated.",
        });
      },
      onError: (error) => {
        toast({
          title: "CT adjustment failed",
          description: error.message,
          variant: "destructive",
        });
      },
    }),
  );

  const deleteCtAdjustment = useMutation(
    trpc.yearEnd.deleteCorporationTaxAdjustment.mutationOptions({
      onSuccess: async () => {
        await invalidateCompliance();
        toast({
          title: "CT adjustment removed",
          description: "The corporation tax draft has been recalculated.",
        });
      },
    }),
  );

  const recalculateVatDraft = useMutation(
    trpc.vat.recalculateDraft.mutationOptions({
      onSuccess: async () => {
        await invalidateCompliance();
        toast({
          title: "VAT draft recalculated",
          description: "The VAT return now reflects the current ledger and adjustments.",
        });
      },
    }),
  );

  const addVatAdjustment = useMutation(
    trpc.vat.addAdjustment.mutationOptions({
      onSuccess: async () => {
        await invalidateCompliance();
        setVatAdjustmentForm(vatAdjustmentDefaultForm());
        toast({
          title: "VAT adjustment added",
          description: "The selected VAT box has been adjusted and the draft rebuilt.",
        });
      },
      onError: (error) => {
        toast({
          title: "VAT adjustment failed",
          description: error.message,
          variant: "destructive",
        });
      },
    }),
  );

  const close = (open: boolean) => {
    if (!open) {
      setParams({ taxReturn: null });
    }
  };

  const saveCtAdjustment = () => {
    const amount = Number(ctAdjustmentForm.amount);

    if (!yearEndPeriod?.periodKey || !ctAdjustmentForm.label.trim() || !Number.isFinite(amount)) {
      return;
    }

    upsertCtAdjustment.mutate({
      periodKey: yearEndPeriod.periodKey,
      category: ctAdjustmentForm.category,
      label: ctAdjustmentForm.label,
      amount,
      note: ctAdjustmentForm.note || null,
    });
  };

  const saveVatAdjustment = () => {
    const amount = Number(vatAdjustmentForm.amount);

    if (!profile || !Number.isFinite(amount) || !vatAdjustmentForm.reason.trim()) {
      return;
    }

    addVatAdjustment.mutate({
      vatReturnId: draft?.id,
      obligationId: draft?.obligationId ?? undefined,
      lineCode: vatAdjustmentForm.lineCode,
      amount,
      reason: vatAdjustmentForm.reason,
      effectiveDate: vatAdjustmentForm.effectiveDate,
    });
  };

  const title = taxReturn === "vat" ? "VAT return" : "Corporation tax return";
  const subtitle =
    taxReturn === "vat"
      ? `${draft?.periodKey ?? "Current period"} · ${formatDate(draft?.periodStart)} to ${formatDate(
          draft?.periodEnd,
        )}`
      : `${yearEndPeriod?.periodKey ?? "Current period"} · ${formatDate(
          ct600Draft?.periodStart,
        )} to ${formatDate(ct600Draft?.periodEnd)}`;
  const status =
    taxReturn === "vat"
      ? (draft?.status ?? "No draft")
      : ct600Draft?.filingReadiness?.isReady
        ? "ready"
        : yearEndPack
          ? "blocked"
          : "not built";

  return (
    <Sheet open={isOpen} onOpenChange={close}>
      <SheetContent
        title="Tax return review"
        style={{ maxWidth: 760 }}
        className="bg-white p-0 dark:bg-[#080808]"
      >
        <div className="flex h-full min-h-0 flex-col">
          <TaxReturnHeader
            type={(taxReturn ?? "ct600") as TaxReturnType}
            title={title}
            subtitle={subtitle}
            status={humanizeToken(status)}
          />

          <Tabs
            key={taxReturn ?? "ct600"}
            defaultValue="summary"
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="border-b px-5 py-3">
              <TabsList className="h-9">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="edit">
                  <Pencil className="mr-2 size-3" />
                  Edit
                </TabsTrigger>
                <TabsTrigger value="payload">Payload</TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-5 p-5">
                {taxReturn === "vat" ? (
                  <VatReturnReview
                    draft={draft}
                    connected={vatDashboardQuery.data?.connected === true}
                    profile={profile}
                    submissionPayload={vatSubmissionPayload}
                    adjustmentForm={vatAdjustmentForm}
                    setAdjustmentForm={setVatAdjustmentForm}
                    addVatAdjustmentPending={addVatAdjustment.isPending}
                    saveVatAdjustment={saveVatAdjustment}
                    recalculatePending={recalculateVatDraft.isPending}
                    recalculate={() =>
                      recalculateVatDraft.mutate({
                        vatReturnId: draft?.id,
                        obligationId: draft?.obligationId ?? undefined,
                      })
                    }
                    profileForm={profileForm}
                    setProfileForm={setProfileForm}
                    saveProfile={saveProfile}
                    savingProfile={upsertProfile.isPending}
                  />
                ) : (
                  <CtReturnReview
                    ct600Draft={ct600Draft}
                    packStatus={yearEndPack?.status ?? null}
                    profile={profile}
                    profileForm={profileForm}
                    setProfileForm={setProfileForm}
                    saveProfile={saveProfile}
                    savingProfile={upsertProfile.isPending}
                    adjustments={ctAdjustments}
                    adjustmentForm={ctAdjustmentForm}
                    setAdjustmentForm={setCtAdjustmentForm}
                    saveAdjustment={saveCtAdjustment}
                    savingAdjustment={upsertCtAdjustment.isPending}
                    deleteAdjustment={(adjustmentId) =>
                      deleteCtAdjustment.mutate({
                        adjustmentId,
                        periodKey: yearEndPeriod?.periodKey,
                      })
                    }
                    deletingAdjustment={deleteCtAdjustment.isPending}
                  />
                )}
              </div>
            </ScrollArea>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CtReturnReview(props: {
  ct600Draft: Ct600DraftPreview | null;
  packStatus: string | null;
  profile: FilingProfilePreview | null | undefined;
  profileForm: ProfileFormState;
  setProfileForm: React.Dispatch<React.SetStateAction<ProfileFormState>>;
  saveProfile: () => void;
  savingProfile: boolean;
  adjustments: CorporationTaxAdjustmentPreview[];
  adjustmentForm: CtAdjustmentFormState;
  setAdjustmentForm: React.Dispatch<React.SetStateAction<CtAdjustmentFormState>>;
  saveAdjustment: () => void;
  savingAdjustment: boolean;
  deleteAdjustment: (adjustmentId: string) => void;
  deletingAdjustment: boolean;
}) {
  const draft = props.ct600Draft;
  const currency = draft?.currency ?? props.profile?.baseCurrency ?? "GBP";

  return (
    <>
      <TabsContent value="summary" className="mt-0 space-y-5">
        {draft ? (
          <>
            <Section title="Return totals">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Turnover">
                  <AmountCell amount={draft.turnover} currency={currency} />
                </Field>
                <Field label="Chargeable profits">
                  <AmountCell amount={draft.chargeableProfits} currency={currency} />
                </Field>
                <Field label="Gross corporation tax">
                  <AmountCell amount={draft.grossCorporationTax} currency={currency} />
                </Field>
                <Field label="Marginal relief">
                  <AmountCell amount={draft.marginalRelief} currency={currency} />
                </Field>
                <Field label="Loans to participators">
                  <AmountCell amount={draft.loansToParticipatorsTax} currency={currency} />
                </Field>
                <Field label="Tax payable">
                  <AmountCell amount={draft.taxPayable} currency={currency} />
                </Field>
              </div>
            </Section>

            <Section title="Company and declaration">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Company">{draft.companyName}</Field>
                <Field label="Company number">{draft.companyNumber ?? "Not set"}</Field>
                <Field label="UTR">{draft.utr ?? "Not set"}</Field>
                <Field label="Declaration">
                  {draft.declarationName} · {draft.declarationStatus}
                </Field>
              </div>
            </Section>

            <Section title="Filing readiness">
              <div className="space-y-3">
                <Badge variant={draft.filingReadiness?.isReady ? "default" : "secondary"}>
                  {draft.filingReadiness?.isReady ? "Ready to submit" : "Needs review"}
                </Badge>
                {draft.filingReadiness?.blockers?.length ? (
                  <ul className="space-y-2 text-sm text-[#606060]">
                    {draft.filingReadiness.blockers.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[#606060]">
                    No blockers remain for the supported small-company CT600 path.
                  </p>
                )}
              </div>
            </Section>

            {draft.financialYearBreakdown?.length ? (
              <Section title="Tax rate split">
                <div className="space-y-2">
                  {draft.financialYearBreakdown.map((row) => (
                    <div
                      key={`${row.financialYear}-${row.chargeType}`}
                      className="grid gap-2 border px-3 py-2 text-sm sm:grid-cols-4"
                    >
                      <div>FY {row.financialYear}</div>
                      <div>{humanizeToken(row.chargeType)}</div>
                      <div>{row.taxRate}%</div>
                      <div className="font-medium">
                        <AmountCell amount={row.netCorporationTax} currency={currency} />
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            ) : null}
          </>
        ) : (
          <div className="border p-4 text-sm text-[#606060]">
            Rebuild the year-end pack before reviewing the CT600 return.
          </div>
        )}
      </TabsContent>

      <TabsContent value="edit" className="mt-0 space-y-5">
        <ProfileEditor
          profile={props.profile}
          form={props.profileForm}
          setForm={props.setProfileForm}
          saveProfile={props.saveProfile}
          saving={props.savingProfile}
          mode="ct600"
        />

        <Section
          title="Corporation tax adjustments"
          description="Add permanent or timing adjustments before rebuilding/submitting the CT600."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={props.adjustmentForm.category}
                onValueChange={(value) =>
                  props.setAdjustmentForm((current) => ({
                    ...current,
                    category: value as CtAdjustmentFormState["category"],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CT_ADJUSTMENT_CATEGORIES.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <InputField
              id="ct-adjustment-label"
              label="Label"
              value={props.adjustmentForm.label}
              onChange={(label) => props.setAdjustmentForm((current) => ({ ...current, label }))}
            />
            <InputField
              id="ct-adjustment-amount"
              label="Amount"
              type="number"
              value={props.adjustmentForm.amount}
              onChange={(amount) => props.setAdjustmentForm((current) => ({ ...current, amount }))}
            />
            <InputField
              id="ct-adjustment-note"
              label="Note"
              value={props.adjustmentForm.note}
              onChange={(note) => props.setAdjustmentForm((current) => ({ ...current, note }))}
            />
          </div>
          <SubmitButton
            isSubmitting={props.savingAdjustment}
            disabled={
              props.savingAdjustment ||
              !props.adjustmentForm.label.trim() ||
              !props.adjustmentForm.amount
            }
            onClick={props.saveAdjustment}
          >
            Save CT adjustment
          </SubmitButton>

          {props.adjustments.length ? (
            <div className="space-y-2">
              {props.adjustments.map((adjustment) => (
                <div
                  key={adjustment.id}
                  className="flex items-center justify-between gap-3 border px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{adjustment.label}</div>
                    <div className="text-xs text-[#606060]">
                      {humanizeToken(adjustment.category)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium">
                      <AmountCell amount={adjustment.amount} currency={currency} />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={props.deletingAdjustment}
                      onClick={() => props.deleteAdjustment(adjustment.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </Section>
      </TabsContent>

      <TabsContent value="payload" className="mt-0 space-y-5">
        <Section title="Submission package">
          <div className="space-y-3 text-sm text-[#606060]">
            <p>
              The CT submission sends a GovTalk XML envelope containing these CT600 values, with the
              statutory accounts and corporation-tax computation attached as encoded iXBRL.
            </p>
            <pre className="max-h-[420px] overflow-auto border bg-[#0C0C0C] p-3 text-xs text-white">
              {JSON.stringify(
                draft
                  ? {
                      companyName: draft.companyName,
                      companyNumber: draft.companyNumber,
                      utr: draft.utr,
                      periodStart: draft.periodStart,
                      periodEnd: draft.periodEnd,
                      turnover: draft.turnover,
                      chargeableProfits: draft.chargeableProfits,
                      grossCorporationTax: draft.grossCorporationTax,
                      marginalRelief: draft.marginalRelief,
                      taxPayable: draft.taxPayable,
                      declarationName: draft.declarationName,
                      declarationStatus: draft.declarationStatus,
                    }
                  : { status: props.packStatus ?? "not built" },
                null,
                2,
              )}
            </pre>
          </div>
        </Section>
      </TabsContent>
    </>
  );
}

function VatReturnReview(props: {
  draft: VatDraftPreview | null;
  connected: boolean;
  profile: FilingProfilePreview | null | undefined;
  submissionPayload: Record<string, unknown> | null;
  adjustmentForm: VatAdjustmentFormState;
  setAdjustmentForm: React.Dispatch<React.SetStateAction<VatAdjustmentFormState>>;
  addVatAdjustmentPending: boolean;
  saveVatAdjustment: () => void;
  recalculatePending: boolean;
  recalculate: () => void;
  profileForm: ProfileFormState;
  setProfileForm: React.Dispatch<React.SetStateAction<ProfileFormState>>;
  saveProfile: () => void;
  savingProfile: boolean;
}) {
  const draft = props.draft;
  const currency = draft?.currency ?? props.profile?.baseCurrency ?? "GBP";
  const lineOptions = draft?.lines.length
    ? draft.lines
    : ([
        { code: "box1", label: "VAT due on sales" },
        { code: "box2", label: "VAT due on acquisitions" },
        { code: "box3", label: "Total VAT due" },
        { code: "box4", label: "VAT reclaimed" },
        { code: "box5", label: "Net VAT due" },
        { code: "box6", label: "Sales excluding VAT" },
        { code: "box7", label: "Purchases excluding VAT" },
        { code: "box8", label: "Goods supplied to EU" },
        { code: "box9", label: "Acquisitions from EU" },
      ] as Array<{ code: VatLineCode; label: string }>);

  return (
    <>
      <TabsContent value="summary" className="mt-0 space-y-5">
        <Section title="VAT boxes">
          {draft ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {draft.lines.map((line) => (
                <div key={line.code} className="flex items-center justify-between border px-3 py-2">
                  <div>
                    <div className="text-sm font-medium">{line.label}</div>
                    <div className="text-xs uppercase text-[#878787]">{line.code}</div>
                  </div>
                  <div className="text-sm font-medium">
                    <AmountCell amount={line.amount} currency={currency} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border p-4 text-sm text-[#606060]">
              Recalculate the draft once the HMRC VAT app and filing profile are ready.
            </div>
          )}
        </Section>

        <Section title="Draft evidence">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Sales items">{draft?.salesCount ?? 0}</Field>
            <Field label="Purchase items">{draft?.purchaseCount ?? 0}</Field>
            <Field label="Adjustments">{draft?.adjustmentCount ?? 0}</Field>
            <Field label="Net VAT due">
              {draft ? <AmountCell amount={draft.netVatDue} currency={currency} /> : "-"}
            </Field>
          </div>
        </Section>
      </TabsContent>

      <TabsContent value="edit" className="mt-0 space-y-5">
        <ProfileEditor
          profile={props.profile}
          form={props.profileForm}
          setForm={props.setProfileForm}
          saveProfile={props.saveProfile}
          saving={props.savingProfile}
          mode="vat"
        />

        <Section
          title="VAT adjustments"
          description="Apply a manual box adjustment before filing, then recalculate the draft."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>VAT box</Label>
              <Select
                value={props.adjustmentForm.lineCode}
                onValueChange={(value) =>
                  props.setAdjustmentForm((current) => ({
                    ...current,
                    lineCode: value as VatLineCode,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {lineOptions.map((line) => (
                    <SelectItem key={line.code} value={line.code}>
                      {line.code.toUpperCase()} · {line.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <InputField
              id="vat-adjustment-amount"
              label="Amount"
              type="number"
              value={props.adjustmentForm.amount}
              onChange={(amount) => props.setAdjustmentForm((current) => ({ ...current, amount }))}
            />
            <InputField
              id="vat-adjustment-date"
              label="Effective date"
              type="date"
              value={props.adjustmentForm.effectiveDate}
              onChange={(effectiveDate) =>
                props.setAdjustmentForm((current) => ({ ...current, effectiveDate }))
              }
            />
            <InputField
              id="vat-adjustment-reason"
              label="Reason"
              value={props.adjustmentForm.reason}
              onChange={(reason) => props.setAdjustmentForm((current) => ({ ...current, reason }))}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SubmitButton
              isSubmitting={props.addVatAdjustmentPending}
              disabled={
                props.addVatAdjustmentPending ||
                !props.adjustmentForm.amount ||
                !props.adjustmentForm.reason.trim()
              }
              onClick={props.saveVatAdjustment}
            >
              Add adjustment
            </SubmitButton>
            <SubmitButton
              isSubmitting={props.recalculatePending}
              disabled={props.recalculatePending || !props.connected}
              onClick={props.recalculate}
              variant="outline"
            >
              <RefreshCw className="mr-2 size-3" />
              Recalculate
            </SubmitButton>
          </div>
        </Section>
      </TabsContent>

      <TabsContent value="payload" className="mt-0 space-y-5">
        <Section title="HMRC VAT API body">
          <p className="text-sm text-[#606060]">
            VAT is submitted as a JSON return to HMRC Making Tax Digital. These are the values that
            will be sent after you accept the filing declaration.
          </p>
          <pre className="max-h-[420px] overflow-auto border bg-[#0C0C0C] p-3 text-xs text-white">
            {JSON.stringify(props.submissionPayload ?? { status: "No VAT draft" }, null, 2)}
          </pre>
        </Section>
      </TabsContent>
    </>
  );
}

function ProfileEditor(props: {
  profile: FilingProfilePreview | null | undefined;
  form: ProfileFormState;
  setForm: React.Dispatch<React.SetStateAction<ProfileFormState>>;
  saveProfile: () => void;
  saving: boolean;
  mode: TaxReturnType;
}) {
  return (
    <Section
      title="Return identity"
      description={
        props.mode === "vat"
          ? "These values drive the VAT return header and HMRC account identity."
          : "These values drive the CT600, accounts attachment, and declaration fields."
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <InputField
          id={`${props.mode}-company-name`}
          label="Company name"
          value={props.form.companyName}
          onChange={(companyName) => props.setForm((current) => ({ ...current, companyName }))}
        />
        <InputField
          id={`${props.mode}-company-number`}
          label="Company number"
          value={props.form.companyNumber}
          onChange={(companyNumber) => props.setForm((current) => ({ ...current, companyNumber }))}
        />
        <InputField
          id={`${props.mode}-utr`}
          label="Corporation tax UTR"
          value={props.form.utr}
          onChange={(utr) => props.setForm((current) => ({ ...current, utr }))}
        />
        <InputField
          id={`${props.mode}-vrn`}
          label="VAT registration number"
          value={props.form.vrn}
          onChange={(vrn) => props.setForm((current) => ({ ...current, vrn }))}
        />
        <InputField
          id={`${props.mode}-base-currency`}
          label="Base currency"
          value={props.form.baseCurrency}
          onChange={(baseCurrency) => props.setForm((current) => ({ ...current, baseCurrency }))}
        />
        <InputField
          id={`${props.mode}-approval-date`}
          label="Approval date"
          type="date"
          value={props.form.approvalDate}
          onChange={(approvalDate) => props.setForm((current) => ({ ...current, approvalDate }))}
        />
        <InputField
          id={`${props.mode}-signing-director`}
          label="Signing director"
          value={props.form.signingDirectorName}
          onChange={(signingDirectorName) =>
            props.setForm((current) => ({ ...current, signingDirectorName }))
          }
        />
        <InputField
          id={`${props.mode}-principal-activity`}
          label="Principal activity"
          value={props.form.principalActivity}
          onChange={(principalActivity) =>
            props.setForm((current) => ({ ...current, principalActivity }))
          }
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${props.mode}-directors`}>Directors</Label>
        <Textarea
          id={`${props.mode}-directors`}
          value={props.form.directors}
          onChange={(event) =>
            props.setForm((current) => ({ ...current, directors: event.target.value }))
          }
          rows={3}
        />
      </div>
      <Separator />
      <SubmitButton
        isSubmitting={props.saving}
        disabled={props.saving || !props.profile}
        onClick={props.saveProfile}
      >
        Save return identity
      </SubmitButton>
    </Section>
  );
}
