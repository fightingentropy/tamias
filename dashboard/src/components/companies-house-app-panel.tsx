"use client";

import type {
  CompaniesHousePscDiscrepancy,
  CompaniesHousePscDiscrepancyMaterialType,
  CompaniesHousePscDiscrepancyObligedEntityType,
  CompaniesHousePscDiscrepancyReport,
  CompaniesHousePscDiscrepancyType,
  CompaniesHousePscType,
  CompaniesHouseRegisteredEmailAddress,
  CompaniesHouseRegisteredEmailEligibility,
  CompaniesHouseRegisteredOfficeAddress,
  CompaniesHouseTransaction,
  CompaniesHouseValidationStatus,
} from "@tamias/compliance";
import { COMPANIES_HOUSE_PSC_DISCREPANCY_SCOPE } from "@tamias/compliance/types";
import { Badge } from "@tamias/ui/badge";
import { Button } from "@tamias/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@tamias/ui/card";
import { Checkbox } from "@tamias/ui/checkbox";
import { Input } from "@tamias/ui/input";
import { Label } from "@tamias/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@tamias/ui/select";
import { SubmitButton } from "@tamias/ui/submit-button";
import { Textarea } from "@tamias/ui/textarea";
import { useToast } from "@tamias/ui/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { useAppOAuth } from "@/hooks/use-app-oauth";
import { useTRPC } from "@/trpc/client";

type RegisteredOfficeDraftResult = {
  transaction: CompaniesHouseTransaction;
  filing: CompaniesHouseRegisteredOfficeAddress;
  validationStatus: CompaniesHouseValidationStatus;
  currentRegisteredOfficeAddress?: CompaniesHouseRegisteredOfficeAddress;
};

type RegisteredEmailDraftResult = {
  transaction: CompaniesHouseTransaction;
  filing: CompaniesHouseRegisteredEmailAddress;
  validationStatus: CompaniesHouseValidationStatus;
  eligibility?: CompaniesHouseRegisteredEmailEligibility;
};

type PscDiscrepancyResult = {
  report: CompaniesHousePscDiscrepancyReport;
  discrepancies: CompaniesHousePscDiscrepancy[];
  finalReport: CompaniesHousePscDiscrepancyReport;
};

const materialDiscrepancyOptions: Array<{
  value: CompaniesHousePscDiscrepancyMaterialType;
  label: string;
}> = [
  {
    value: "appears-to-conceal-details",
    label: "Appears to conceal details",
  },
  { value: "money-laundering", label: "Money laundering" },
  { value: "terrorist-financing", label: "Terrorist financing" },
];

const pscTypeOptions: Array<{
  value: CompaniesHousePscType;
  label: string;
}> = [
  {
    value: "individual-person-with-significant-control",
    label: "Individual PSC",
  },
  {
    value: "individual-beneficial-owner",
    label: "Individual beneficial owner",
  },
  {
    value: "corporate-entity-person-with-significant-control",
    label: "Corporate entity PSC",
  },
  {
    value: "corporate-entity-beneficial-owner",
    label: "Corporate entity beneficial owner",
  },
  {
    value: "legal-person-person-with-significant-control",
    label: "Legal person PSC",
  },
  {
    value: "legal-person-beneficial-owner",
    label: "Legal person beneficial owner",
  },
  {
    value: "psc-is-missing",
    label: "PSC is missing",
  },
];

const pscDiscrepancyTypeOptions: Array<{
  value: CompaniesHousePscDiscrepancyType;
  label: string;
}> = [
  { value: "Nature of control", label: "Nature of control" },
  { value: "Correspondence address", label: "Correspondence address" },
  { value: "Notified date", label: "Notified date" },
  { value: "Other reason", label: "Other reason" },
  { value: "Name", label: "Name" },
  { value: "Date of birth", label: "Date of birth" },
  { value: "Nationality", label: "Nationality" },
  { value: "Country of residence", label: "Country of residence" },
  { value: "Company name", label: "Company name" },
  { value: "Governing law", label: "Governing law" },
  { value: "Legal form", label: "Legal form" },
  { value: "Company number", label: "Company number" },
  { value: "Place of registration", label: "Place of registration" },
  { value: "Incorporation law", label: "Incorporation law" },
  { value: "Principal office address", label: "Principal office address" },
  { value: "Sanctioned", label: "Sanctioned" },
];

const obligedEntityTypeOptions: Array<{
  value: CompaniesHousePscDiscrepancyObligedEntityType;
  label: string;
}> = [
  { value: "credit-institution", label: "Credit institution" },
  { value: "financial-institution", label: "Financial institution" },
  {
    value: "auditor-external-accountant-or-tax-advisor",
    label: "Auditor, external accountant, or tax advisor",
  },
  {
    value: "notary-or-independent-legal-professional",
    label: "Notary or independent legal professional",
  },
  {
    value: "trust-or-company-service-provider",
    label: "Trust or company service provider",
  },
  {
    value: "estate-agent-or-intermediary",
    label: "Estate agent or intermediary",
  },
  {
    value: "entity-trading-goods-in-cash-over-ten-thousand-euros",
    label: "Cash goods trader over EUR 10,000",
  },
  {
    value: "gambling-service-provider",
    label: "Gambling service provider",
  },
  {
    value: "exchange-service-provider-of-fiat-and-virtual-currencies",
    label: "Fiat and virtual currency exchange provider",
  },
  {
    value: "custodian-wallet-provider",
    label: "Custodian wallet provider",
  },
  {
    value: "art-dealer-galleries-and-auction-houses",
    label: "Art dealer, gallery, or auction house",
  },
  {
    value: "art-dealer-free-ports",
    label: "Art dealer in a free port",
  },
  {
    value: "insolvency-practictioner",
    label: "Insolvency practitioner",
  },
];

function humanizeToken(value?: string | null) {
  if (!value) {
    return "Unknown";
  }

  return value
    .replaceAll(/[_-]+/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function getValidationSummary(status?: CompaniesHouseValidationStatus | null) {
  if (!status) {
    return "Validation pending";
  }

  if (status.isValid === true) {
    return "Valid";
  }

  if (status.isValid === false) {
    return "Invalid";
  }

  return humanizeToken(status.validationStatus ?? status.status);
}

function getValidationMessages(
  status?: CompaniesHouseValidationStatus | null,
): string[] {
  return (status?.errors ?? [])
    .map((error) => {
      const message = error.message;
      if (typeof message === "string") {
        return message;
      }

      const text = error.error;
      if (typeof text === "string") {
        return text;
      }

      return JSON.stringify(error);
    })
    .filter((message): message is string => Boolean(message));
}

function getRegisteredOfficeScopeGranted(
  companyScopes:
    | Array<{
        companyNumber: string;
        scopeKind: string;
      }>
    | undefined,
  companyNumber: string,
) {
  return (
    companyScopes?.some(
      (scope) =>
        scope.companyNumber === companyNumber &&
        scope.scopeKind === "registered-office-address.update",
    ) ?? false
  );
}

function getRegisteredEmailScopeGranted(
  companyScopes:
    | Array<{
        companyNumber: string;
        scopeKind: string;
      }>
    | undefined,
  companyNumber: string,
) {
  return (
    companyScopes?.some(
      (scope) =>
        scope.companyNumber === companyNumber &&
        scope.scopeKind === "registered-email-address.update",
    ) ?? false
  );
}

function getCheckboxId(baseId: string, prefix: string, value?: string) {
  if (!value) {
    return `${baseId}-${prefix}`;
  }

  return `${baseId}-${prefix}-${value.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export function CompaniesHouseAppPanel({ installed }: { installed: boolean }) {
  const baseId = useId();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const connectionQuery = useQuery(
    trpc.companiesHouse.getConnection.queryOptions(),
  );
  const accountsStatusQuery = useQuery(
    trpc.companiesHouse.getAccountsStatus.queryOptions(),
  );

  const connection = connectionQuery.data;
  const accountsStatus = accountsStatusQuery.data;
  const companyNumber =
    connection?.profileCompanyNumber ??
    accountsStatus?.profileCompanyNumber ??
    "";

  const registeredOfficeScopeGranted = companyNumber
    ? getRegisteredOfficeScopeGranted(connection?.companyScopes, companyNumber)
    : false;
  const registeredEmailScopeGranted = companyNumber
    ? getRegisteredEmailScopeGranted(connection?.companyScopes, companyNumber)
    : false;
  const pscDiscrepancyScopeGranted =
    connection?.scopes?.includes(COMPANIES_HOUSE_PSC_DISCREPANCY_SCOPE) ??
    false;
  const officeAddressCheckboxId = getCheckboxId(baseId, "office-address");
  const registeredEmailCheckboxId = getCheckboxId(baseId, "registered-email");

  const invalidateCompaniesHouseQueries = () => {
    queryClient.invalidateQueries({
      queryKey: trpc.apps.get.queryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.companiesHouse.getConnection.queryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.companiesHouse.getAccountsStatus.queryKey(),
    });
  };

  const requestRegisteredOfficeScope = useAppOAuth({
    installUrlEndpoint: companyNumber
      ? `/apps/companies-house/install-url?companyNumber=${encodeURIComponent(companyNumber)}&scopeKind=registered-office-address.update`
      : "/apps/companies-house/install-url",
    onSuccess: invalidateCompaniesHouseQueries,
    onError: (error) => {
      toast({
        title: "Scope request failed",
        description: error.message,
        variant: "error",
      });
    },
  });

  const requestRegisteredEmailScope = useAppOAuth({
    installUrlEndpoint: companyNumber
      ? `/apps/companies-house/install-url?companyNumber=${encodeURIComponent(companyNumber)}&scopeKind=registered-email-address.update`
      : "/apps/companies-house/install-url",
    onSuccess: invalidateCompaniesHouseQueries,
    onError: (error) => {
      toast({
        title: "Scope request failed",
        description: error.message,
        variant: "error",
      });
    },
  });

  const requestPscDiscrepancyScope = useAppOAuth({
    installUrlEndpoint:
      "/apps/companies-house/install-url?scopeKind=psc-discrepancy-reports.write-full",
    onSuccess: invalidateCompaniesHouseQueries,
    onError: (error) => {
      toast({
        title: "Scope request failed",
        description: error.message,
        variant: "error",
      });
    },
  });

  const [officePremises, setOfficePremises] = useState("");
  const [officeAddressLine1, setOfficeAddressLine1] = useState("");
  const [officeAddressLine2, setOfficeAddressLine2] = useState("");
  const [officeLocality, setOfficeLocality] = useState("");
  const [officeRegion, setOfficeRegion] = useState("");
  const [officePostalCode, setOfficePostalCode] = useState("");
  const [officeCountry, setOfficeCountry] = useState("United Kingdom");
  const [acceptOfficeAddress, setAcceptOfficeAddress] = useState(false);
  const [registeredOfficeDraft, setRegisteredOfficeDraft] =
    useState<RegisteredOfficeDraftResult | null>(null);

  const [registeredEmailAddress, setRegisteredEmailAddress] = useState("");
  const [acceptRegisteredEmail, setAcceptRegisteredEmail] = useState(false);
  const [registeredEmailDraft, setRegisteredEmailDraft] =
    useState<RegisteredEmailDraftResult | null>(null);

  const [obligedEntityType, setObligedEntityType] =
    useState<CompaniesHousePscDiscrepancyObligedEntityType>(
      "auditor-external-accountant-or-tax-advisor",
    );
  const [obligedEntityOrganisationName, setObligedEntityOrganisationName] =
    useState("Tamias");
  const [obligedEntityContactName, setObligedEntityContactName] = useState("");
  const [obligedEntityEmail, setObligedEntityEmail] = useState("");
  const [materialDiscrepancies, setMaterialDiscrepancies] = useState<
    CompaniesHousePscDiscrepancyMaterialType[]
  >([]);
  const [pscType, setPscType] = useState<CompaniesHousePscType>(
    "individual-person-with-significant-control",
  );
  const [pscName, setPscName] = useState("");
  const [pscDateOfBirth, setPscDateOfBirth] = useState("");
  const [pscDiscrepancyTypes, setPscDiscrepancyTypes] = useState<
    CompaniesHousePscDiscrepancyType[]
  >([]);
  const [pscDetails, setPscDetails] = useState("");
  const [pscResult, setPscResult] = useState<PscDiscrepancyResult | null>(null);

  const createRegisteredOfficeDraftMutation = useMutation(
    trpc.companiesHouse.createRegisteredOfficeAddressDraft.mutationOptions({
      onSuccess: (data) => {
        setRegisteredOfficeDraft(data);
        toast({
          title: "Registered office draft created",
          description: `Transaction ${data.transaction.id} is ready for review.`,
        });
      },
      onError: (error) => {
        toast({
          title: "Registered office draft failed",
          description: error.message,
          variant: "error",
        });
      },
    }),
  );

  const createRegisteredEmailDraftMutation = useMutation(
    trpc.companiesHouse.createRegisteredEmailAddressDraft.mutationOptions({
      onSuccess: (data) => {
        setRegisteredEmailDraft(data);
        toast({
          title: "Registered email draft created",
          description: `Transaction ${data.transaction.id} is ready for review.`,
        });
      },
      onError: (error) => {
        toast({
          title: "Registered email draft failed",
          description: error.message,
          variant: "error",
        });
      },
    }),
  );

  const submitPscReportMutation = useMutation(
    trpc.companiesHouse.submitPscDiscrepancyReport.mutationOptions({
      onSuccess: (data) => {
        setPscResult(data);
        toast({
          title: "PSC discrepancy report submitted",
          description:
            data.finalReport.links?.self ??
            "Companies House accepted the discrepancy report request.",
        });
      },
      onError: (error) => {
        toast({
          title: "PSC discrepancy report failed",
          description: error.message,
          variant: "error",
        });
      },
    }),
  );

  const closeTransactionMutation = useMutation(
    trpc.companiesHouse.closeTransaction.mutationOptions({
      onSuccess: () => {
        toast({
          title: "Transaction closed",
        });
      },
      onError: (error) => {
        toast({
          title: "Close failed",
          description: error.message,
          variant: "error",
        });
      },
    }),
  );

  const deleteTransactionMutation = useMutation(
    trpc.companiesHouse.deleteTransaction.mutationOptions({
      onSuccess: () => {
        toast({
          title: "Transaction deleted",
        });
      },
      onError: (error) => {
        toast({
          title: "Delete failed",
          description: error.message,
          variant: "error",
        });
      },
    }),
  );

  const refreshRegisteredOfficeDraft = async (transactionId: string) => {
    const data = await queryClient.fetchQuery(
      trpc.companiesHouse.refreshRegisteredOfficeAddressDraft.queryOptions({
        transactionId,
      }),
    );

    setRegisteredOfficeDraft(data);
  };

  const refreshRegisteredEmailDraft = async (transactionId: string) => {
    const data = await queryClient.fetchQuery(
      trpc.companiesHouse.refreshRegisteredEmailAddressDraft.queryOptions({
        transactionId,
      }),
    );

    setRegisteredEmailDraft(data);
  };

  const toggleMaterialDiscrepancy = (
    value: CompaniesHousePscDiscrepancyMaterialType,
    checked: boolean,
  ) => {
    setMaterialDiscrepancies((current) =>
      checked ? [...current, value] : current.filter((item) => item !== value),
    );
  };

  const togglePscDiscrepancyType = (
    value: CompaniesHousePscDiscrepancyType,
    checked: boolean,
  ) => {
    setPscDiscrepancyTypes((current) =>
      checked ? [...current, value] : current.filter((item) => item !== value),
    );
  };

  return (
    <div className="space-y-4 text-sm">
      <Card>
        <CardHeader>
          <CardTitle>Operations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-[#878787]">
          <div className="flex flex-wrap gap-2">
            <Badge variant={installed ? "default" : "secondary"}>
              {installed ? "Connected" : "Not connected"}
            </Badge>
            {companyNumber ? (
              <Badge variant="outline">Company {companyNumber}</Badge>
            ) : (
              <Badge variant="secondary">
                No filing-profile company number
              </Badge>
            )}
            {accountsStatus?.environment ? (
              <Badge variant="outline">
                {humanizeToken(accountsStatus.environment)}
              </Badge>
            ) : null}
          </div>
          <p>
            Request the exact Companies House scopes you need, then create draft
            filings for registered office and registered email changes or submit
            a PSC discrepancy report.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scope Access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">Registered office</span>
                <Badge
                  variant={
                    registeredOfficeScopeGranted ? "default" : "secondary"
                  }
                >
                  {registeredOfficeScopeGranted ? "Granted" : "Missing"}
                </Badge>
              </div>
              <SubmitButton
                variant="outline"
                className="w-full"
                isSubmitting={requestRegisteredOfficeScope.isLoading}
                disabled={!installed || !companyNumber}
                onClick={() => requestRegisteredOfficeScope.connect()}
              >
                Grant scope
              </SubmitButton>
            </div>

            <div className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">Registered email</span>
                <Badge
                  variant={
                    registeredEmailScopeGranted ? "default" : "secondary"
                  }
                >
                  {registeredEmailScopeGranted ? "Granted" : "Missing"}
                </Badge>
              </div>
              <SubmitButton
                variant="outline"
                className="w-full"
                isSubmitting={requestRegisteredEmailScope.isLoading}
                disabled={!installed || !companyNumber}
                onClick={() => requestRegisteredEmailScope.connect()}
              >
                Grant scope
              </SubmitButton>
            </div>

            <div className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">PSC discrepancy</span>
                <Badge
                  variant={pscDiscrepancyScopeGranted ? "default" : "secondary"}
                >
                  {pscDiscrepancyScopeGranted ? "Granted" : "Missing"}
                </Badge>
              </div>
              <SubmitButton
                variant="outline"
                className="w-full"
                isSubmitting={requestPscDiscrepancyScope.isLoading}
                disabled={!installed}
                onClick={() => requestPscDiscrepancyScope.connect()}
              >
                Grant scope
              </SubmitButton>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registered Office Draft</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Premises</Label>
              <Input
                value={officePremises}
                onChange={(event) => setOfficePremises(event.target.value)}
                placeholder="12 High Street"
              />
            </div>
            <div className="space-y-1">
              <Label>Address line 1</Label>
              <Input
                value={officeAddressLine1}
                onChange={(event) => setOfficeAddressLine1(event.target.value)}
                placeholder="High Street"
              />
            </div>
            <div className="space-y-1">
              <Label>Address line 2</Label>
              <Input
                value={officeAddressLine2}
                onChange={(event) => setOfficeAddressLine2(event.target.value)}
                placeholder="Suite or floor"
              />
            </div>
            <div className="space-y-1">
              <Label>Locality</Label>
              <Input
                value={officeLocality}
                onChange={(event) => setOfficeLocality(event.target.value)}
                placeholder="London"
              />
            </div>
            <div className="space-y-1">
              <Label>Region</Label>
              <Input
                value={officeRegion}
                onChange={(event) => setOfficeRegion(event.target.value)}
                placeholder="Greater London"
              />
            </div>
            <div className="space-y-1">
              <Label>Postal code</Label>
              <Input
                value={officePostalCode}
                onChange={(event) => setOfficePostalCode(event.target.value)}
                placeholder="SW1A 1AA"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Country</Label>
              <Input
                value={officeCountry}
                onChange={(event) => setOfficeCountry(event.target.value)}
              />
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-md border p-3">
            <Checkbox
              id={officeAddressCheckboxId}
              checked={acceptOfficeAddress}
              onCheckedChange={(checked) =>
                setAcceptOfficeAddress(Boolean(checked))
              }
              className="mt-0.5"
            />
            <Label
              htmlFor={officeAddressCheckboxId}
              className="text-sm font-normal leading-relaxed text-[#878787]"
            >
              Confirm this is an appropriate office address under the Companies
              Act.
            </Label>
          </div>

          <SubmitButton
            className="w-full"
            isSubmitting={createRegisteredOfficeDraftMutation.isPending}
            disabled={
              !installed || !registeredOfficeScopeGranted || !companyNumber
            }
            onClick={() =>
              createRegisteredOfficeDraftMutation.mutate({
                acceptAppropriateOfficeAddressStatement: acceptOfficeAddress,
                premises: officePremises,
                addressLine1: officeAddressLine1,
                addressLine2: officeAddressLine2 || undefined,
                locality: officeLocality || undefined,
                region: officeRegion || undefined,
                postalCode: officePostalCode,
                country: officeCountry,
              })
            }
          >
            Create draft
          </SubmitButton>

          {registeredOfficeDraft ? (
            <div className="rounded-md border p-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  Transaction {registeredOfficeDraft.transaction.id}
                </Badge>
                <Badge variant="outline">
                  {humanizeToken(registeredOfficeDraft.transaction.status)}
                </Badge>
                <Badge variant="outline">
                  {getValidationSummary(registeredOfficeDraft.validationStatus)}
                </Badge>
              </div>
              <p className="text-[#878787]">
                Draft address:{" "}
                {[
                  registeredOfficeDraft.filing.premises,
                  registeredOfficeDraft.filing.addressLine1,
                  registeredOfficeDraft.filing.addressLine2,
                  registeredOfficeDraft.filing.locality,
                  registeredOfficeDraft.filing.region,
                  registeredOfficeDraft.filing.postalCode,
                  registeredOfficeDraft.filing.country,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              {getValidationMessages(registeredOfficeDraft.validationStatus)
                .length ? (
                <div className="space-y-1 text-[#878787]">
                  {getValidationMessages(
                    registeredOfficeDraft.validationStatus,
                  ).map((message) => (
                    <p key={message}>• {message}</p>
                  ))}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    refreshRegisteredOfficeDraft(
                      registeredOfficeDraft.transaction.id,
                    )
                  }
                >
                  Refresh
                </Button>
                <SubmitButton
                  variant="outline"
                  isSubmitting={closeTransactionMutation.isPending}
                  onClick={() =>
                    closeTransactionMutation.mutate(
                      {
                        transactionId: registeredOfficeDraft.transaction.id,
                      },
                      {
                        onSuccess: async () => {
                          await refreshRegisteredOfficeDraft(
                            registeredOfficeDraft.transaction.id,
                          );
                        },
                      },
                    )
                  }
                >
                  Close transaction
                </SubmitButton>
                <SubmitButton
                  variant="outline"
                  isSubmitting={deleteTransactionMutation.isPending}
                  onClick={() =>
                    deleteTransactionMutation.mutate(
                      {
                        transactionId: registeredOfficeDraft.transaction.id,
                      },
                      {
                        onSuccess: () => {
                          setRegisteredOfficeDraft(null);
                        },
                      },
                    )
                  }
                >
                  Delete transaction
                </SubmitButton>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registered Email Draft</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Registered email address</Label>
            <Input
              value={registeredEmailAddress}
              onChange={(event) =>
                setRegisteredEmailAddress(event.target.value)
              }
              placeholder="company@example.com"
            />
          </div>

          <div className="flex items-start gap-3 rounded-md border p-3">
            <Checkbox
              id={registeredEmailCheckboxId}
              checked={acceptRegisteredEmail}
              onCheckedChange={(checked) =>
                setAcceptRegisteredEmail(Boolean(checked))
              }
              className="mt-0.5"
            />
            <Label
              htmlFor={registeredEmailCheckboxId}
              className="text-sm font-normal leading-relaxed text-[#878787]"
            >
              Confirm this is an appropriate registered email address under the
              Companies Act.
            </Label>
          </div>

          <SubmitButton
            className="w-full"
            isSubmitting={createRegisteredEmailDraftMutation.isPending}
            disabled={
              !installed || !registeredEmailScopeGranted || !companyNumber
            }
            onClick={() =>
              createRegisteredEmailDraftMutation.mutate({
                registeredEmailAddress,
                acceptAppropriateEmailAddressStatement: acceptRegisteredEmail,
              })
            }
          >
            Create draft
          </SubmitButton>

          {registeredEmailDraft ? (
            <div className="rounded-md border p-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  Transaction {registeredEmailDraft.transaction.id}
                </Badge>
                <Badge variant="outline">
                  {humanizeToken(registeredEmailDraft.transaction.status)}
                </Badge>
                <Badge variant="outline">
                  {getValidationSummary(registeredEmailDraft.validationStatus)}
                </Badge>
              </div>
              <p className="text-[#878787]">
                Draft email:{" "}
                {registeredEmailDraft.filing.registeredEmailAddress ??
                  "Unknown"}
              </p>
              {registeredEmailDraft.eligibility?.eligible === false ? (
                <p className="text-[#878787]">
                  Eligibility:{" "}
                  {registeredEmailDraft.eligibility?.reasons?.join(", ") ??
                    "Not eligible"}
                </p>
              ) : null}
              {getValidationMessages(registeredEmailDraft.validationStatus)
                .length ? (
                <div className="space-y-1 text-[#878787]">
                  {getValidationMessages(
                    registeredEmailDraft.validationStatus,
                  ).map((message) => (
                    <p key={message}>• {message}</p>
                  ))}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    refreshRegisteredEmailDraft(
                      registeredEmailDraft.transaction.id,
                    )
                  }
                >
                  Refresh
                </Button>
                <SubmitButton
                  variant="outline"
                  isSubmitting={closeTransactionMutation.isPending}
                  onClick={() =>
                    closeTransactionMutation.mutate(
                      {
                        transactionId: registeredEmailDraft.transaction.id,
                      },
                      {
                        onSuccess: async () => {
                          await refreshRegisteredEmailDraft(
                            registeredEmailDraft.transaction.id,
                          );
                        },
                      },
                    )
                  }
                >
                  Close transaction
                </SubmitButton>
                <SubmitButton
                  variant="outline"
                  isSubmitting={deleteTransactionMutation.isPending}
                  onClick={() =>
                    deleteTransactionMutation.mutate(
                      {
                        transactionId: registeredEmailDraft.transaction.id,
                      },
                      {
                        onSuccess: () => {
                          setRegisteredEmailDraft(null);
                        },
                      },
                    )
                  }
                >
                  Delete transaction
                </SubmitButton>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>PSC Discrepancy Report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Obliged entity type</Label>
              <Select
                value={obligedEntityType}
                onValueChange={(value) =>
                  setObligedEntityType(
                    value as CompaniesHousePscDiscrepancyObligedEntityType,
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {obligedEntityTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Organisation name</Label>
              <Input
                value={obligedEntityOrganisationName}
                onChange={(event) =>
                  setObligedEntityOrganisationName(event.target.value)
                }
              />
            </div>

            <div className="space-y-1">
              <Label>Contact name</Label>
              <Input
                value={obligedEntityContactName}
                onChange={(event) =>
                  setObligedEntityContactName(event.target.value)
                }
              />
            </div>

            <div className="space-y-1">
              <Label>Contact email</Label>
              <Input
                value={obligedEntityEmail}
                onChange={(event) => setObligedEntityEmail(event.target.value)}
                placeholder="ops@example.com"
              />
            </div>
          </div>

          <div className="space-y-2 rounded-md border p-3">
            <Label>Material discrepancies</Label>
            <div className="grid gap-2 md:grid-cols-3">
              {materialDiscrepancyOptions.map((option) => {
                const checkboxId = getCheckboxId(
                  baseId,
                  "material-discrepancy",
                  option.value,
                );

                return (
                  <div key={option.value} className="flex items-center gap-2">
                    <Checkbox
                      id={checkboxId}
                      checked={materialDiscrepancies.includes(option.value)}
                      onCheckedChange={(checked) =>
                        toggleMaterialDiscrepancy(
                          option.value,
                          Boolean(checked),
                        )
                      }
                    />
                    <Label
                      htmlFor={checkboxId}
                      className="text-sm font-normal leading-relaxed text-[#878787]"
                    >
                      {option.label}
                    </Label>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>PSC type</Label>
              <Select
                value={pscType}
                onValueChange={(value) =>
                  setPscType(value as CompaniesHousePscType)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pscTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>PSC name</Label>
              <Input
                value={pscName}
                onChange={(event) => setPscName(event.target.value)}
                placeholder="Jane Example"
              />
            </div>

            <div className="space-y-1">
              <Label>Date of birth</Label>
              <Input
                value={pscDateOfBirth}
                onChange={(event) => setPscDateOfBirth(event.target.value)}
                placeholder="05/1973"
              />
            </div>
          </div>

          <div className="space-y-2 rounded-md border p-3">
            <Label>Discrepancy types</Label>
            <div className="grid gap-2 md:grid-cols-2">
              {pscDiscrepancyTypeOptions.map((option) => {
                const checkboxId = getCheckboxId(
                  baseId,
                  "psc-discrepancy-type",
                  option.value,
                );

                return (
                  <div key={option.value} className="flex items-center gap-2">
                    <Checkbox
                      id={checkboxId}
                      checked={pscDiscrepancyTypes.includes(option.value)}
                      onCheckedChange={(checked) =>
                        togglePscDiscrepancyType(option.value, Boolean(checked))
                      }
                    />
                    <Label
                      htmlFor={checkboxId}
                      className="text-sm font-normal leading-relaxed text-[#878787]"
                    >
                      {option.label}
                    </Label>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-1">
            <Label>Details</Label>
            <Textarea
              value={pscDetails}
              onChange={(event) => setPscDetails(event.target.value)}
              className="min-h-[120px]"
              placeholder="Explain the discrepancy and why it is material."
            />
          </div>

          <SubmitButton
            className="w-full"
            isSubmitting={submitPscReportMutation.isPending}
            disabled={
              !installed || !pscDiscrepancyScopeGranted || !companyNumber
            }
            onClick={() =>
              submitPscReportMutation.mutate({
                materialDiscrepancies,
                obligedEntityType,
                obligedEntityOrganisationName,
                obligedEntityContactName,
                obligedEntityEmail,
                discrepancies: [
                  {
                    details: pscDetails,
                    pscDateOfBirth: pscDateOfBirth || undefined,
                    pscDiscrepancyTypes,
                    pscName: pscName || undefined,
                    pscType,
                  },
                ],
              })
            }
          >
            Submit report
          </SubmitButton>

          {pscResult ? (
            <div className="rounded-md border p-3 space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  {humanizeToken(pscResult.finalReport.status)}
                </Badge>
                {pscResult.finalReport.links?.self ? (
                  <Badge variant="outline">
                    {pscResult.finalReport.links.self}
                  </Badge>
                ) : null}
              </div>
              <p className="text-[#878787]">
                Submitted {pscResult.discrepancies.length} discrepancy
                {pscResult.discrepancies.length === 1 ? "" : "ies"} for company{" "}
                {pscResult.finalReport.companyNumber ?? companyNumber}.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
