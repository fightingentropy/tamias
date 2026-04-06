"use client";

import { Button } from "@tamias/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@tamias/ui/card";
import { Input } from "@tamias/ui/input";
import { Label } from "@tamias/ui/label";
import { SubmitButton } from "@tamias/ui/submit-button";
import { Switch } from "@tamias/ui/switch";
import { Textarea } from "@tamias/ui/textarea";
import { useToast } from "@tamias/ui/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { VatNumberInput } from "@/components/vat-number-input";
import { useTRPC } from "@/trpc/client";

type FilingProfileFormState = {
  enabled: boolean;
  companyName: string;
  companyNumber: string;
  companyAuthenticationCode: string;
  utr: string;
  vrn: string;
  accountingBasis: "cash" | "accrual";
  filingMode: "client" | "agent";
  agentReferenceNumber: string;
  yearEndMonth: string;
  yearEndDay: string;
  baseCurrency: string;
  principalActivity: string;
  directors: string;
  signingDirectorName: string;
  approvalDate: string;
  averageEmployeeCount: string;
  ordinaryShareCount: string;
  ordinaryShareNominalValue: string;
  dormant: boolean;
  auditExemptionClaimed: boolean;
  membersDidNotRequireAudit: boolean;
  directorsAcknowledgeResponsibilities: boolean;
  accountsPreparedUnderSmallCompaniesRegime: boolean;
};

const defaultState: FilingProfileFormState = {
  enabled: true,
  companyName: "",
  companyNumber: "",
  companyAuthenticationCode: "",
  utr: "",
  vrn: "",
  accountingBasis: "cash",
  filingMode: "client",
  agentReferenceNumber: "",
  yearEndMonth: "3",
  yearEndDay: "31",
  baseCurrency: "GBP",
  principalActivity: "",
  directors: "",
  signingDirectorName: "",
  approvalDate: "",
  averageEmployeeCount: "",
  ordinaryShareCount: "",
  ordinaryShareNominalValue: "",
  dormant: false,
  auditExemptionClaimed: false,
  membersDidNotRequireAudit: false,
  directorsAcknowledgeResponsibilities: false,
  accountsPreparedUnderSmallCompaniesRegime: false,
};

function parseOptionalInteger(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalNumber(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDirectors(value: string) {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function ComplianceSettingsForm() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery(
    trpc.compliance.getProfile.queryOptions(),
  );
  const [form, setForm] = useState<FilingProfileFormState>(defaultState);

  useEffect(() => {
    if (!data) {
      setForm(defaultState);
      return;
    }

    setForm({
      enabled: data.enabled,
      companyName: data.companyName ?? "",
      companyNumber: data.companyNumber ?? "",
      companyAuthenticationCode: data.companyAuthenticationCode ?? "",
      utr: data.utr ?? "",
      vrn: data.vrn ?? "",
      accountingBasis: data.accountingBasis === "accrual" ? "accrual" : "cash",
      filingMode: data.filingMode === "agent" ? "agent" : "client",
      agentReferenceNumber: data.agentReferenceNumber ?? "",
      yearEndMonth: String(data.yearEndMonth ?? 3),
      yearEndDay: String(data.yearEndDay ?? 31),
      baseCurrency: data.baseCurrency ?? "GBP",
      principalActivity: data.principalActivity ?? "",
      directors: Array.isArray(data.directors) ? data.directors.join("\n") : "",
      signingDirectorName: data.signingDirectorName ?? "",
      approvalDate: data.approvalDate ?? "",
      averageEmployeeCount:
        typeof data.averageEmployeeCount === "number"
          ? String(data.averageEmployeeCount)
          : "",
      ordinaryShareCount:
        typeof data.ordinaryShareCount === "number"
          ? String(data.ordinaryShareCount)
          : "",
      ordinaryShareNominalValue:
        typeof data.ordinaryShareNominalValue === "number"
          ? String(data.ordinaryShareNominalValue)
          : "",
      dormant: data.dormant === true,
      auditExemptionClaimed: data.auditExemptionClaimed === true,
      membersDidNotRequireAudit: data.membersDidNotRequireAudit === true,
      directorsAcknowledgeResponsibilities:
        data.directorsAcknowledgeResponsibilities === true,
      accountsPreparedUnderSmallCompaniesRegime:
        data.accountsPreparedUnderSmallCompaniesRegime === true,
    });
  }, [data]);

  const upsertProfile = useMutation(
    trpc.compliance.upsertProfile.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.compliance.getProfile.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.vat.getDashboard.queryKey(),
          }),
        ]);

        toast({
          title: "Filing profile updated",
          description: "UK compliance settings were saved successfully.",
        });
      },
    }),
  );

  const onSubmit = () => {
    upsertProfile.mutate({
      enabled: form.enabled,
      legalEntityType: "uk_ltd",
      provider: "hmrc-vat",
      companyName: form.companyName || null,
      companyNumber: form.companyNumber || null,
      companyAuthenticationCode: form.companyAuthenticationCode || null,
      utr: form.utr || null,
      vrn: form.vrn || null,
      vatScheme: "standard_quarterly",
      accountingBasis: form.accountingBasis,
      filingMode: form.filingMode,
      agentReferenceNumber:
        form.filingMode === "agent" ? form.agentReferenceNumber || null : null,
      yearEndMonth: Number(form.yearEndMonth),
      yearEndDay: Number(form.yearEndDay),
      baseCurrency: form.baseCurrency || "GBP",
      principalActivity: form.principalActivity || null,
      directors: parseDirectors(form.directors),
      signingDirectorName: form.signingDirectorName || null,
      approvalDate: form.approvalDate || null,
      averageEmployeeCount: parseOptionalInteger(form.averageEmployeeCount),
      ordinaryShareCount: parseOptionalInteger(form.ordinaryShareCount),
      ordinaryShareNominalValue: parseOptionalNumber(
        form.ordinaryShareNominalValue,
      ),
      dormant: form.dormant,
      auditExemptionClaimed: form.auditExemptionClaimed,
      membersDidNotRequireAudit: form.membersDidNotRequireAudit,
      directorsAcknowledgeResponsibilities:
        form.directorsAcknowledgeResponsibilities,
      accountsPreparedUnderSmallCompaniesRegime:
        form.accountsPreparedUnderSmallCompaniesRegime,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>UK filing profile</CardTitle>
        <CardDescription>
          Tamias keeps legal-entity filing settings separate from general
          team country settings. This profile is the entry point for VAT and
          later year-end workflows.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-1">
            <div className="text-sm font-medium">Enable UK compliance</div>
            <div className="text-sm text-[#606060]">
              Keep the workspace hidden until the GB filing profile is ready.
            </div>
          </div>
          <Switch
            checked={form.enabled}
            onCheckedChange={(checked) =>
              setForm((current) => ({ ...current, enabled: checked }))
            }
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="companyName">Company name</Label>
            <Input
              id="companyName"
              value={form.companyName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  companyName: event.target.value,
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyNumber">Company number</Label>
            <Input
              id="companyNumber"
              value={form.companyNumber}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  companyNumber: event.target.value,
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyAuthenticationCode">
              Companies House authentication code
            </Label>
            <Input
              id="companyAuthenticationCode"
              value={form.companyAuthenticationCode}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  companyAuthenticationCode: event.target.value
                    .trim()
                    .toUpperCase(),
                }))
              }
              placeholder="6 to 8 characters"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="utr">UTR</Label>
            <Input
              id="utr"
              value={form.utr}
              onChange={(event) =>
                setForm((current) => ({ ...current, utr: event.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vrn">VAT registration number</Label>
            <VatNumberInput
              value={form.vrn}
              onChange={(vrn) => setForm((current) => ({ ...current, vrn }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="accountingBasis">Accounting basis</Label>
            <select
              id="accountingBasis"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.accountingBasis}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  accountingBasis: event.target.value as "cash" | "accrual",
                }))
              }
            >
              <option value="cash">Cash basis</option>
              <option value="accrual">Accrual basis</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="filingMode">Filing mode</Label>
            <select
              id="filingMode"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.filingMode}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  filingMode: event.target.value as "client" | "agent",
                }))
              }
            >
              <option value="client">Client filing</option>
              <option value="agent">Agent filing</option>
            </select>
          </div>

          {form.filingMode === "agent" && (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="agentReferenceNumber">
                Agent reference number
              </Label>
              <Input
                id="agentReferenceNumber"
                value={form.agentReferenceNumber}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    agentReferenceNumber: event.target.value,
                  }))
                }
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="yearEndMonth">Year-end month</Label>
            <Input
              id="yearEndMonth"
              inputMode="numeric"
              value={form.yearEndMonth}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  yearEndMonth: event.target.value,
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="yearEndDay">Year-end day</Label>
            <Input
              id="yearEndDay"
              inputMode="numeric"
              value={form.yearEndDay}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  yearEndDay: event.target.value,
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="baseCurrency">Base currency</Label>
            <Input
              id="baseCurrency"
              value={form.baseCurrency}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  baseCurrency: event.target.value.toUpperCase(),
                }))
              }
            />
          </div>
        </div>

        <div className="space-y-4 rounded-lg border p-4">
          <div className="space-y-1">
            <div className="text-sm font-medium">
              Statutory filing facts
            </div>
            <div className="text-sm text-[#606060]">
              These facts drive the filing-ready small-company accounts and CT
              pack. Leave them blank if you only want prep/export output.
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="principalActivity">Principal activity</Label>
              <Textarea
                id="principalActivity"
                rows={3}
                value={form.principalActivity}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    principalActivity: event.target.value,
                  }))
                }
                placeholder="Describe the company’s principal activity for the directors’ report."
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="directors">Directors</Label>
              <Textarea
                id="directors"
                rows={4}
                value={form.directors}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    directors: event.target.value,
                  }))
                }
                placeholder={"One director per line\nJane Example\nJohn Example"}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signingDirectorName">Signing director</Label>
              <Input
                id="signingDirectorName"
                value={form.signingDirectorName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    signingDirectorName: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="approvalDate">Approval date</Label>
              <Input
                id="approvalDate"
                type="date"
                value={form.approvalDate}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    approvalDate: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="averageEmployeeCount">
                Average employee count
              </Label>
              <Input
                id="averageEmployeeCount"
                inputMode="numeric"
                value={form.averageEmployeeCount}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    averageEmployeeCount: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ordinaryShareCount">
                Ordinary shares in issue
              </Label>
              <Input
                id="ordinaryShareCount"
                inputMode="numeric"
                value={form.ordinaryShareCount}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    ordinaryShareCount: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ordinaryShareNominalValue">
                Nominal value per ordinary share
              </Label>
              <Input
                id="ordinaryShareNominalValue"
                inputMode="decimal"
                value={form.ordinaryShareNominalValue}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    ordinaryShareNominalValue: event.target.value,
                  }))
                }
                placeholder="1.00"
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-1">
                <div className="text-sm font-medium">Dormant</div>
                <div className="text-xs text-[#606060]">
                  Controls the dormant-company fact in the accounts pack.
                </div>
              </div>
              <Switch
                checked={form.dormant}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, dormant: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-1">
                <div className="text-sm font-medium">
                  Small-company regime statement
                </div>
                <div className="text-xs text-[#606060]">
                  Confirms the accounts were prepared under the small
                  companies regime.
                </div>
              </div>
              <Switch
                checked={form.accountsPreparedUnderSmallCompaniesRegime}
                onCheckedChange={(checked) =>
                  setForm((current) => ({
                    ...current,
                    accountsPreparedUnderSmallCompaniesRegime: checked,
                  }))
                }
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-1">
                <div className="text-sm font-medium">
                  Audit exemption claimed
                </div>
                <div className="text-xs text-[#606060]">
                  Use for the section 477 small-company exemption statement.
                </div>
              </div>
              <Switch
                checked={form.auditExemptionClaimed}
                onCheckedChange={(checked) =>
                  setForm((current) => ({
                    ...current,
                    auditExemptionClaimed: checked,
                  }))
                }
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-1">
                <div className="text-sm font-medium">
                  Members did not require audit
                </div>
                <div className="text-xs text-[#606060]">
                  Confirms the members did not require an audit under section
                  476.
                </div>
              </div>
              <Switch
                checked={form.membersDidNotRequireAudit}
                onCheckedChange={(checked) =>
                  setForm((current) => ({
                    ...current,
                    membersDidNotRequireAudit: checked,
                  }))
                }
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3 md:col-span-2">
              <div className="space-y-1">
                <div className="text-sm font-medium">
                  Directors acknowledge Companies Act responsibilities
                </div>
                <div className="text-xs text-[#606060]">
                  Required for the standard small-company directors’
                  responsibility statement.
                </div>
              </div>
              <Switch
                checked={form.directorsAcknowledgeResponsibilities}
                onCheckedChange={(checked) =>
                  setForm((current) => ({
                    ...current,
                    directorsAcknowledgeResponsibilities: checked,
                  }))
                }
              />
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between gap-4">
        <div className="text-sm text-[#606060]">
          {isLoading
            ? "Loading saved profile..."
            : "Complete the statutory facts above to unlock the filing-ready small-company accounts and CT path."}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setForm(defaultState)}
          >
            Reset
          </Button>
          <SubmitButton
            isSubmitting={upsertProfile.isPending}
            disabled={upsertProfile.isPending}
            onClick={onSubmit}
          >
            Save profile
          </SubmitButton>
        </div>
      </CardFooter>
    </Card>
  );
}
