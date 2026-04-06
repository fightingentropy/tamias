"use client";

import { Checkbox } from "@tamias/ui/checkbox";
import { Badge } from "@tamias/ui/badge";
import { Button } from "@tamias/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@tamias/ui/card";
import { Input } from "@tamias/ui/input";
import { Label } from "@tamias/ui/label";
import { SubmitButton } from "@tamias/ui/submit-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@tamias/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@tamias/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@tamias/ui/table";
import { useToast } from "@tamias/ui/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "@/framework/link";
import { useEffect, useMemo, useState } from "react";
import {
  type EditableJournalLine,
  JournalLinesEditor,
} from "@/components/compliance/journal-lines-editor";
import {
  CT_ADJUSTMENT_CATEGORIES,
  buildLoanReliefRows,
  buildLoanRows,
  createLoanReliefRow,
  createLoanRow,
  describeCompaniesHouseAccountsOutcome,
  describeHmrcCtEnvironment,
  describeHmrcCtOutcome,
  describeHmrcCtReferenceSource,
  emptyLines,
  formatDate,
  formatDateTime,
  getCorporationTaxFinancialYear,
  getHmrcCtErrors,
  getHmrcCtNotices,
  humanizeToken,
  isBlankLoanReliefRow,
  isBlankLoanRow,
  isCompleteLoanReliefRow,
  isCompleteLoanRow,
  payloadArray,
  payloadNumber,
  payloadObject,
  payloadString,
  periodUsesSmallProfitsRules,
  toNullableInteger,
  toNullableNumber,
  toNumber,
  type CloseCompanyLoansSchedule,
  type CorporationTaxAdjustmentCategory,
  type CorporationTaxRateSchedule,
  type CtComputationBreakdown,
  type CtFinancialYearBreakdown,
  type FilingReadiness,
  type LoanReliefRowState,
  type LoanRowState,
  type SubmissionEvent,
  type TrialBalanceLine,
  type WorkingPaperSection,
} from "@/components/compliance/year-end-dashboard.lib";
import { FormatAmount } from "@/components/format-amount";
import { useFileUrl } from "@/hooks/use-file-url";
import { useTRPC } from "@/trpc/client";

export function YearEndDashboard() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [journalDate, setJournalDate] = useState(new Date().toISOString().slice(0, 10));
  const [journalDescription, setJournalDescription] = useState("");
  const [journalReference, setJournalReference] = useState("");
  const [journalLines, setJournalLines] = useState<EditableJournalLine[]>(emptyLines());
  const [ctCategory, setCtCategory] = useState<CorporationTaxAdjustmentCategory>("other");
  const [ctLabel, setCtLabel] = useState("");
  const [ctAmount, setCtAmount] = useState("");
  const [ctNote, setCtNote] = useState("");
  const [ctRateUseSplitYears, setCtRateUseSplitYears] = useState(false);
  const [ctRateAssociatedCompaniesThisPeriod, setCtRateAssociatedCompaniesThisPeriod] =
    useState("");
  const [ctRateAssociatedCompaniesFirstYear, setCtRateAssociatedCompaniesFirstYear] = useState("");
  const [ctRateAssociatedCompaniesSecondYear, setCtRateAssociatedCompaniesSecondYear] =
    useState("");
  const [ctRateExemptDistributions, setCtRateExemptDistributions] = useState("");
  const [closeCompanyBeforeEndPeriod, setCloseCompanyBeforeEndPeriod] = useState(false);
  const [closeCompanyLoansMade, setCloseCompanyLoansMade] = useState<LoanRowState[]>([
    createLoanRow(),
  ]);
  const [closeCompanyTaxChargeable, setCloseCompanyTaxChargeable] = useState("");
  const [closeCompanyReliefEarlierThan, setCloseCompanyReliefEarlierThan] = useState<
    LoanReliefRowState[]
  >([createLoanReliefRow()]);
  const [closeCompanyReliefEarlierDue, setCloseCompanyReliefEarlierDue] = useState("");
  const [closeCompanyLoanLaterReliefNow, setCloseCompanyLoanLaterReliefNow] = useState<
    LoanReliefRowState[]
  >([createLoanReliefRow()]);
  const [closeCompanyReliefLaterDue, setCloseCompanyReliefLaterDue] = useState("");
  const [closeCompanyTotalLoansOutstanding, setCloseCompanyTotalLoansOutstanding] = useState("");
  const [ctDeclarationAccepted, setCtDeclarationAccepted] = useState(false);
  const [ctLiveConfirmationAccepted, setCtLiveConfirmationAccepted] = useState(false);
  const [selectedCtSubmissionId, setSelectedCtSubmissionId] = useState<string | null>(null);
  const [accountsDeclarationAccepted, setAccountsDeclarationAccepted] = useState(false);
  const [taxDetailsExpanded, setTaxDetailsExpanded] = useState(false);
  const [manualJournalsExpanded, setManualJournalsExpanded] = useState(false);

  const dashboardQuery = useQuery(trpc.yearEnd.getDashboard.queryOptions());
  const companiesHouseStatusQuery = useQuery(trpc.companiesHouse.getAccountsStatus.queryOptions());
  const dashboard = dashboardQuery.data;
  const companiesHouseStatus = companiesHouseStatusQuery.data;
  const packQuery = useQuery({
    ...trpc.yearEnd.getPack.queryOptions(),
    enabled: Boolean(dashboard?.profile),
  });
  const workspace = packQuery.data;
  const pack = workspace?.pack ?? null;
  const closeCompanyLoansSchedule = (workspace?.closeCompanyLoansSchedule ??
    null) as CloseCompanyLoansSchedule | null;
  const corporationTaxRateSchedule = (workspace?.corporationTaxRateSchedule ??
    null) as CorporationTaxRateSchedule | null;
  const filingReadiness = (workspace?.filingReadiness ?? null) as FilingReadiness | null;
  const ct600Draft = (workspace?.ct600Draft ?? null) as {
    computationBreakdown?: CtComputationBreakdown;
    grossCorporationTax?: number;
    marginalRelief?: number;
    augmentedProfits?: number;
    exemptDistributions?: number;
    taxRate?: number;
    netCorporationTaxChargeable?: number;
    associatedCompaniesMode?: string;
    associatedCompaniesThisPeriod?: number | null;
    associatedCompaniesFirstYear?: number | null;
    associatedCompaniesSecondYear?: number | null;
    financialYearBreakdown?: CtFinancialYearBreakdown[];
  } | null;
  const period = dashboard?.period ?? null;
  const ctPeriodUsesSmallProfitsRules = periodUsesSmallProfitsRules(period?.periodEnd);
  const ctPeriodSpansTwoFinancialYears = Boolean(
    period &&
    getCorporationTaxFinancialYear(period.periodStart) !==
      getCorporationTaxFinancialYear(period.periodEnd),
  );
  const ctSubmissionsQuery = useQuery({
    ...trpc.yearEnd.listSubmissions.queryOptions(
      period ? { periodKey: period.periodKey } : undefined,
    ),
    enabled: Boolean(period),
  });
  const ctSubmissions = Array.isArray(ctSubmissionsQuery.data)
    ? (ctSubmissionsQuery.data as SubmissionEvent[])
    : [];
  const latestCtSubmission = ctSubmissions[0] ?? null;
  const latestCtPollTarget = ctSubmissions.find((event) => Boolean(event.correlationId)) ?? null;
  const selectedCtSubmission =
    ctSubmissions.find((event) => event.id === selectedCtSubmissionId) ?? latestCtSubmission;
  const selectedCtArtifactBundle = payloadObject(
    selectedCtSubmission?.requestPayload,
    "artifactBundle",
  );
  const accountsSubmissionsQuery = useQuery({
    ...trpc.yearEnd.listAccountsSubmissions.queryOptions(
      period ? { periodKey: period.periodKey } : undefined,
    ),
    enabled: Boolean(period),
  });
  const accountsSubmissions = Array.isArray(accountsSubmissionsQuery.data)
    ? (accountsSubmissionsQuery.data as SubmissionEvent[])
    : [];
  const latestAccountsPollTarget =
    accountsSubmissions.find((event) =>
      Boolean(payloadString(event.requestPayload, "submissionNumber")),
    ) ?? null;
  const latestExportBundle = pack?.exportBundles?.at(-1) ?? null;
  const ctRuntime = dashboard?.ctRuntime ?? null;
  const ctEnvironment = ctRuntime?.environment ?? "test";
  const ctEnvironmentLabel = describeHmrcCtEnvironment(ctEnvironment);
  const ctRuntimeConfigured = ctRuntime?.configured === true;
  const ctSubmissionReferenceReady = ctRuntime?.submissionReference != null;
  const ctSubmissionTargetReady = ctRuntimeConfigured && ctSubmissionReferenceReady;
  const ctIsProduction = ctEnvironment === "production";
  const companiesHouseXmlGatewayReady = companiesHouseStatus?.xmlGatewayConfigured === true;
  const companiesHouseAuthCodeReady =
    companiesHouseStatus?.companyAuthenticationCodeConfigured === true;
  const annualAccountsSubmissionReady =
    Boolean(pack) &&
    pack?.status !== "draft" &&
    filingReadiness?.isReady === true &&
    companiesHouseXmlGatewayReady &&
    companiesHouseAuthCodeReady;
  const nextActions = useMemo(() => {
    const actions: string[] = [];

    if (!pack) {
      actions.push(
        "Rebuild the year-end pack to snapshot the ledger and calculate filing readiness.",
      );
    }

    if (filingReadiness?.blockers?.length) {
      actions.push(...filingReadiness.blockers.slice(0, 3));
    }

    if (!ctRuntimeConfigured) {
      actions.push("Add HMRC CT sender credentials on the API runtime before CT submission.");
    }

    if (!companiesHouseXmlGatewayReady) {
      actions.push(
        "Add Companies House XML presenter credentials on the API runtime before annual accounts submission.",
      );
    }

    if (!companiesHouseAuthCodeReady) {
      actions.push("Save the Companies House authentication code in compliance settings.");
    }

    return Array.from(new Set(actions)).slice(0, 4);
  }, [
    companiesHouseAuthCodeReady,
    companiesHouseXmlGatewayReady,
    ctRuntimeConfigured,
    filingReadiness,
    pack,
  ]);
  const download = useFileUrl(
    latestExportBundle
      ? {
          type: "download",
          filePath: latestExportBundle.filePath,
          filename: latestExportBundle.fileName,
        }
      : null,
  );
  const ctSubmissionArtifactDownload = useFileUrl(
    payloadString(selectedCtArtifactBundle ?? undefined, "filePath") &&
      payloadString(selectedCtArtifactBundle ?? undefined, "fileName")
      ? {
          type: "download",
          filePath: payloadString(selectedCtArtifactBundle ?? undefined, "filePath")!,
          filename: payloadString(selectedCtArtifactBundle ?? undefined, "fileName")!,
        }
      : null,
  );

  const invalidateYearEnd = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: trpc.yearEnd.getDashboard.queryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.yearEnd.getPack.queryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.yearEnd.listSubmissions.queryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.yearEnd.listAccountsSubmissions.queryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.companiesHouse.getAccountsStatus.queryKey(),
      }),
    ]);
  };

  const rebuildPack = useMutation(
    trpc.yearEnd.rebuildPack.mutationOptions({
      onSuccess: async () => {
        await invalidateYearEnd();
        toast({
          title: "Year-end pack rebuilt",
          description:
            "The current annual pack now reflects the latest ledger, manual journals, and CT adjustments.",
        });
      },
    }),
  );

  const generateExport = useMutation(
    trpc.yearEnd.generateExport.mutationOptions({
      onSuccess: async () => {
        await invalidateYearEnd();
        toast({
          title: "Export bundle generated",
          description:
            "The year-end bundle, including draft statutory accounts and CT600 exports, has been stored in the vault for download.",
        });
      },
    }),
  );

  const createJournal = useMutation(
    trpc.yearEnd.upsertManualJournal.mutationOptions({
      onSuccess: async () => {
        await invalidateYearEnd();
        setJournalDescription("");
        setJournalReference("");
        setJournalLines(emptyLines());
        toast({
          title: "Manual journal saved",
          description: "The year-end pack has been rebuilt to include the new journal entry.",
        });
      },
    }),
  );

  const deleteJournal = useMutation(
    trpc.yearEnd.deleteManualJournal.mutationOptions({
      onSuccess: async () => {
        await invalidateYearEnd();
        toast({
          title: "Manual journal deleted",
          description: "The year-end pack has been refreshed.",
        });
      },
    }),
  );

  const createCtAdjustment = useMutation(
    trpc.yearEnd.upsertCorporationTaxAdjustment.mutationOptions({
      onSuccess: async () => {
        await invalidateYearEnd();
        setCtCategory("other");
        setCtLabel("");
        setCtAmount("");
        setCtNote("");
        toast({
          title: "CT adjustment saved",
          description: "The corporation-tax summary has been recalculated.",
        });
      },
    }),
  );

  const deleteCtAdjustment = useMutation(
    trpc.yearEnd.deleteCorporationTaxAdjustment.mutationOptions({
      onSuccess: async () => {
        await invalidateYearEnd();
        toast({
          title: "CT adjustment deleted",
          description: "The corporation-tax summary has been recalculated.",
        });
      },
    }),
  );

  const upsertCorporationTaxRateScheduleMutation = useMutation(
    trpc.yearEnd.upsertCorporationTaxRateSchedule.mutationOptions({
      onSuccess: async () => {
        await invalidateYearEnd();
        toast({
          title: "CT rate inputs saved",
          description:
            "The corporation-tax rate schedule has been stored against the current year-end period.",
        });
      },
      onError: (error) => {
        toast({
          title: "CT rate inputs failed",
          description: error.message,
          variant: "destructive",
        });
      },
    }),
  );

  const deleteCorporationTaxRateScheduleMutation = useMutation(
    trpc.yearEnd.deleteCorporationTaxRateSchedule.mutationOptions({
      onSuccess: async () => {
        await invalidateYearEnd();
        toast({
          title: "CT rate inputs deleted",
          description:
            "The corporation-tax rate schedule has been removed from this year-end period.",
        });
      },
      onError: (error) => {
        toast({
          title: "CT rate inputs delete failed",
          description: error.message,
          variant: "destructive",
        });
      },
    }),
  );

  const upsertCloseCompanyLoansScheduleMutation = useMutation(
    trpc.yearEnd.upsertCloseCompanyLoansSchedule.mutationOptions({
      onSuccess: async () => {
        await invalidateYearEnd();
        toast({
          title: "CT600A schedule saved",
          description:
            "The close-company loans supplement has been stored against the current year-end period.",
        });
      },
      onError: (error) => {
        toast({
          title: "CT600A schedule failed",
          description: error.message,
          variant: "destructive",
        });
      },
    }),
  );

  const deleteCloseCompanyLoansScheduleMutation = useMutation(
    trpc.yearEnd.deleteCloseCompanyLoansSchedule.mutationOptions({
      onSuccess: async () => {
        await invalidateYearEnd();
        toast({
          title: "CT600A schedule deleted",
          description:
            "The close-company loans supplement has been removed from this year-end period.",
        });
      },
      onError: (error) => {
        toast({
          title: "CT600A delete failed",
          description: error.message,
          variant: "destructive",
        });
      },
    }),
  );

  const submitCt600 = useMutation(
    trpc.yearEnd.submitCt600.mutationOptions({
      onSuccess: async (result) => {
        await invalidateYearEnd();
        setCtLiveConfirmationAccepted(false);
        setSelectedCtSubmissionId(null);
        toast({
          title: `CT600 submitted to ${describeHmrcCtEnvironment(
            payloadString(result.request, "environment"),
          )}`,
          description:
            result.receipt.correlationId ??
            "HMRC acknowledged the CT submission without a correlation ID.",
        });
      },
      onError: (error) => {
        toast({
          title: "CT600 submission failed",
          description: error.message,
          variant: "destructive",
        });
      },
    }),
  );

  const pollCt600 = useMutation(
    trpc.yearEnd.pollCt600.mutationOptions({
      onSuccess: async (result) => {
        await invalidateYearEnd();
        setSelectedCtSubmissionId(result.previousSubmission?.id ?? null);
        toast({
          title: "HMRC response polled",
          description:
            result.receipt.summary ?? result.receipt.qualifier ?? "Submission poll completed.",
        });
      },
      onError: (error) => {
        toast({
          title: "CT600 poll failed",
          description: error.message,
          variant: "destructive",
        });
      },
    }),
  );

  const submitAccounts = useMutation(
    trpc.yearEnd.submitAccounts.mutationOptions({
      onSuccess: async (result) => {
        await invalidateYearEnd();
        toast({
          title: "Annual accounts submitted to Companies House",
          description:
            result.request.submissionNumber ?? "Companies House acknowledged the submission.",
        });
      },
      onError: (error) => {
        toast({
          title: "Companies House submission failed",
          description: error.message,
          variant: "destructive",
        });
      },
    }),
  );

  const pollAccounts = useMutation(
    trpc.yearEnd.pollAccounts.mutationOptions({
      onSuccess: async (result) => {
        await invalidateYearEnd();
        const selectedStatus =
          Array.isArray((result.receipt as { statuses?: unknown[] }).statuses) &&
          typeof (result.receipt as { statuses?: unknown[] }).statuses?.[0] === "object" &&
          (result.receipt as { statuses?: unknown[] }).statuses?.[0] !== null
            ? ((result.receipt as { statuses?: unknown[] }).statuses?.[0] as Record<
                string,
                unknown
              >)
            : null;

        toast({
          title: "Companies House status polled",
          description:
            payloadString(selectedStatus ?? undefined, "statusCode") ??
            "Accounts submission poll completed.",
        });
      },
      onError: (error) => {
        toast({
          title: "Companies House poll failed",
          description: error.message,
          variant: "destructive",
        });
      },
    }),
  );

  const trialBalance = useMemo(
    () => (Array.isArray(pack?.trialBalance) ? (pack.trialBalance as TrialBalanceLine[]) : []),
    [pack?.trialBalance],
  );
  const workingPapers = useMemo(
    () => (Array.isArray(pack?.workingPapers) ? (pack.workingPapers as WorkingPaperSection[]) : []),
    [pack?.workingPapers],
  );
  const selectedCtCategory =
    CT_ADJUSTMENT_CATEGORIES.find((item) => item.value === ctCategory) ??
    CT_ADJUSTMENT_CATEGORIES.at(-1)!;
  const ctRateAssociatedCompaniesThisPeriodValue = toNullableInteger(
    ctRateAssociatedCompaniesThisPeriod,
  );
  const ctRateAssociatedCompaniesFirstYearValue = toNullableInteger(
    ctRateAssociatedCompaniesFirstYear,
  );
  const ctRateAssociatedCompaniesSecondYearValue = toNullableInteger(
    ctRateAssociatedCompaniesSecondYear,
  );
  const ctRateExemptDistributionsValue = toNullableNumber(ctRateExemptDistributions);
  const ctRateHasValidInputs = ctPeriodUsesSmallProfitsRules
    ? ctRateUseSplitYears && ctPeriodSpansTwoFinancialYears
      ? ctRateAssociatedCompaniesFirstYearValue != null &&
        ctRateAssociatedCompaniesSecondYearValue != null
      : ctRateAssociatedCompaniesThisPeriodValue != null
    : false;
  const ctRateBreakdown = Array.isArray(ct600Draft?.financialYearBreakdown)
    ? (ct600Draft.financialYearBreakdown as CtFinancialYearBreakdown[])
    : [];
  const normalizedCloseCompanyLoansMade = useMemo(
    () =>
      closeCompanyLoansMade
        .filter((row) => !isBlankLoanRow(row))
        .map((row) => ({
          name: row.name.trim(),
          amountOfLoan: toNullableInteger(row.amountOfLoan),
        })),
    [closeCompanyLoansMade],
  );
  const normalizedCloseCompanyReliefEarlierThan = useMemo(
    () =>
      closeCompanyReliefEarlierThan
        .filter((row) => !isBlankLoanReliefRow(row))
        .map((row) => ({
          name: row.name.trim(),
          amountRepaid: toNullableInteger(row.amountRepaid),
          amountReleasedOrWrittenOff: toNullableInteger(row.amountReleasedOrWrittenOff),
          date: row.date,
        })),
    [closeCompanyReliefEarlierThan],
  );
  const normalizedCloseCompanyLoanLaterReliefNow = useMemo(
    () =>
      closeCompanyLoanLaterReliefNow
        .filter((row) => !isBlankLoanReliefRow(row))
        .map((row) => ({
          name: row.name.trim(),
          amountRepaid: toNullableInteger(row.amountRepaid),
          amountReleasedOrWrittenOff: toNullableInteger(row.amountReleasedOrWrittenOff),
          date: row.date,
        })),
    [closeCompanyLoanLaterReliefNow],
  );
  const closeCompanyHasIncompleteRows =
    closeCompanyLoansMade.some((row) => !isBlankLoanRow(row) && !isCompleteLoanRow(row)) ||
    closeCompanyReliefEarlierThan.some(
      (row) => !isBlankLoanReliefRow(row) && !isCompleteLoanReliefRow(row),
    ) ||
    closeCompanyLoanLaterReliefNow.some(
      (row) => !isBlankLoanReliefRow(row) && !isCompleteLoanReliefRow(row),
    );
  const closeCompanyTaxChargeableValue = toNullableNumber(closeCompanyTaxChargeable);
  const closeCompanyReliefEarlierDueValue = toNullableNumber(closeCompanyReliefEarlierDue);
  const closeCompanyReliefLaterDueValue = toNullableNumber(closeCompanyReliefLaterDue);
  const closeCompanyTotalLoansOutstandingValue = toNullableInteger(
    closeCompanyTotalLoansOutstanding,
  );
  const closeCompanyLoansMadeTotal = normalizedCloseCompanyLoansMade.reduce(
    (total, row) => total + (row.amountOfLoan ?? 0),
    0,
  );
  const closeCompanyReliefEarlierTotal = normalizedCloseCompanyReliefEarlierThan.reduce(
    (total, row) => total + (row.amountRepaid ?? 0) + (row.amountReleasedOrWrittenOff ?? 0),
    0,
  );
  const closeCompanyReliefLaterTotal = normalizedCloseCompanyLoanLaterReliefNow.reduce(
    (total, row) => total + (row.amountRepaid ?? 0) + (row.amountReleasedOrWrittenOff ?? 0),
    0,
  );
  const closeCompanyDerivedTaxPayable = Math.max(
    (closeCompanyTaxChargeableValue ?? 0) -
      (closeCompanyReliefEarlierDueValue ?? 0) -
      (closeCompanyReliefLaterDueValue ?? 0),
    0,
  );
  const closeCompanyHasMeaningfulContent =
    normalizedCloseCompanyLoansMade.length > 0 ||
    normalizedCloseCompanyReliefEarlierThan.length > 0 ||
    normalizedCloseCompanyLoanLaterReliefNow.length > 0 ||
    closeCompanyTaxChargeableValue != null ||
    closeCompanyReliefEarlierDueValue != null ||
    closeCompanyReliefLaterDueValue != null ||
    closeCompanyTotalLoansOutstandingValue != null;

  useEffect(() => {
    const usesSplitYears =
      corporationTaxRateSchedule?.associatedCompaniesFirstYear != null ||
      corporationTaxRateSchedule?.associatedCompaniesSecondYear != null;

    setCtRateUseSplitYears(usesSplitYears && ctPeriodSpansTwoFinancialYears);
    setCtRateAssociatedCompaniesThisPeriod(
      corporationTaxRateSchedule?.associatedCompaniesThisPeriod != null
        ? String(corporationTaxRateSchedule.associatedCompaniesThisPeriod)
        : "",
    );
    setCtRateAssociatedCompaniesFirstYear(
      corporationTaxRateSchedule?.associatedCompaniesFirstYear != null
        ? String(corporationTaxRateSchedule.associatedCompaniesFirstYear)
        : "",
    );
    setCtRateAssociatedCompaniesSecondYear(
      corporationTaxRateSchedule?.associatedCompaniesSecondYear != null
        ? String(corporationTaxRateSchedule.associatedCompaniesSecondYear)
        : "",
    );
    setCtRateExemptDistributions(
      corporationTaxRateSchedule?.exemptDistributions != null
        ? String(corporationTaxRateSchedule.exemptDistributions)
        : "",
    );
  }, [corporationTaxRateSchedule, ctPeriodSpansTwoFinancialYears, period?.periodKey]);

  useEffect(() => {
    setCloseCompanyBeforeEndPeriod(closeCompanyLoansSchedule?.beforeEndPeriod ?? false);
    setCloseCompanyLoansMade(buildLoanRows(closeCompanyLoansSchedule?.loansMade));
    setCloseCompanyTaxChargeable(
      closeCompanyLoansSchedule?.taxChargeable != null
        ? String(closeCompanyLoansSchedule.taxChargeable)
        : "",
    );
    setCloseCompanyReliefEarlierThan(
      buildLoanReliefRows(closeCompanyLoansSchedule?.reliefEarlierThan),
    );
    setCloseCompanyReliefEarlierDue(
      closeCompanyLoansSchedule?.reliefEarlierDue != null
        ? String(closeCompanyLoansSchedule.reliefEarlierDue)
        : "",
    );
    setCloseCompanyLoanLaterReliefNow(
      buildLoanReliefRows(closeCompanyLoansSchedule?.loanLaterReliefNow),
    );
    setCloseCompanyReliefLaterDue(
      closeCompanyLoansSchedule?.reliefLaterDue != null
        ? String(closeCompanyLoansSchedule.reliefLaterDue)
        : "",
    );
    setCloseCompanyTotalLoansOutstanding(
      closeCompanyLoansSchedule?.totalLoansOutstanding != null
        ? String(closeCompanyLoansSchedule.totalLoansOutstanding)
        : "",
    );
  }, [closeCompanyLoansSchedule, period?.periodKey]);

  useEffect(() => {
    setSelectedCtSubmissionId(null);
  }, [period?.periodKey]);

  useEffect(() => {
    if (!ctIsProduction) {
      setCtLiveConfirmationAccepted(false);
    }
  }, [ctIsProduction]);

  useEffect(() => {
    if (
      workspace?.corporationTaxAdjustments?.length ||
      closeCompanyLoansSchedule ||
      corporationTaxRateSchedule
    ) {
      setTaxDetailsExpanded(true);
    }
  }, [
    closeCompanyLoansSchedule,
    corporationTaxRateSchedule,
    workspace?.corporationTaxAdjustments?.length,
  ]);

  useEffect(() => {
    if (workspace?.manualJournals?.length) {
      setManualJournalsExpanded(true);
    }
  }, [workspace?.manualJournals?.length]);

  if (
    dashboardQuery.isLoading ||
    packQuery.isLoading ||
    companiesHouseStatusQuery.isLoading ||
    ctSubmissionsQuery.isLoading
  ) {
    return <div className="text-sm text-[#606060]">Loading year-end workspace...</div>;
  }

  if (!dashboard?.profile || !period) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Set up your UK filing profile first</CardTitle>
          <CardDescription>
            Year-end packs use the shared UK filing profile for year-end dates, base currency, and
            filing defaults.
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
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Annual period</CardTitle>
            <CardDescription>Current pack period</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-lg font-medium">
              {period.periodStart} to {period.periodEnd}
            </div>
            <div className="text-sm text-[#606060]">Period key {period.periodKey}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Accounts due</CardTitle>
            <CardDescription>Companies House prep deadline</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-lg font-medium">{formatDate(period.accountsDueDate)}</div>
            <Badge variant="outline">{period.obligations.accounts.status}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Corporation tax due</CardTitle>
            <CardDescription>HMRC CT prep deadline</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-lg font-medium">{formatDate(period.corporationTaxDueDate)}</div>
            <Badge variant="outline">{period.obligations.corporationTax.status}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pack status</CardTitle>
            <CardDescription>Snapshot and export state</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Badge variant={pack ? "default" : "secondary"}>{pack?.status ?? "Not built"}</Badge>
            <div className="text-sm text-[#606060]">
              {pack?.latestExportedAt
                ? `Latest export ${formatDate(pack.latestExportedAt)}`
                : "No export bundle yet"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Year-end pack</CardTitle>
          <CardDescription>
            Rebuild the annual pack from the shared ledger, then export working papers, CT prep
            schedules, a statutory accounts review pack, and the filing-ready CT600/iXBRL output for
            the supported small-company path, including saved CT rate inputs and CT600A where
            applicable.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <SubmitButton isSubmitting={rebuildPack.isPending} onClick={() => rebuildPack.mutate({})}>
            Rebuild pack
          </SubmitButton>
          <SubmitButton
            isSubmitting={generateExport.isPending}
            disabled={generateExport.isPending || !pack}
            onClick={() => generateExport.mutate({})}
            variant="outline"
          >
            Generate export
          </SubmitButton>
          {download.url ? (
            <Button asChild variant="ghost">
              <a href={download.url}>Download latest bundle</a>
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filing readiness</CardTitle>
          <CardDescription>
            Server-side gate for the supported small-company FRS 102 Section 1A accounts and CT600
            path. Submission stays blocked until every blocker is cleared.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge
              variant={
                filingReadiness?.isReady ? "default" : filingReadiness ? "secondary" : "outline"
              }
            >
              {filingReadiness
                ? filingReadiness.isReady
                  ? "Ready for supported path"
                  : "Blocked"
                : "Build pack first"}
            </Badge>
            <div className="text-sm text-[#606060]">
              {filingReadiness?.supportedPath ??
                "Rebuild the year-end pack to evaluate the supported filing path."}
            </div>
          </div>

          {filingReadiness ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border p-3">
                <div className="mb-2 text-sm font-medium">
                  Blockers ({filingReadiness.blockers.length})
                </div>
                {filingReadiness.blockers.length ? (
                  <ul className="space-y-2 text-sm text-[#606060]">
                    {filingReadiness.blockers.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-[#606060]">
                    No blockers remain for the supported filing path.
                  </div>
                )}
              </div>

              <div className="rounded-lg border p-3">
                <div className="mb-2 text-sm font-medium">
                  Warnings ({filingReadiness.warnings.length})
                </div>
                {filingReadiness.warnings.length ? (
                  <ul className="space-y-2 text-sm text-[#606060]">
                    {filingReadiness.warnings.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-[#606060]">
                    No warnings on the current supported-path draft.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm text-[#606060]">
              Rebuild the pack to calculate filing readiness from the latest ledger, filing profile,
              and CT adjustment categories.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Next actions</CardTitle>
          <CardDescription>
            The shortest path from the current pack state to a filing-ready year-end.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {nextActions.length ? (
            nextActions.map((item, index) => (
              <div key={item} className="flex items-start gap-3 rounded-lg border p-3">
                <Badge variant="outline" className="mt-0.5 shrink-0">
                  {index + 1}
                </Badge>
                <div className="text-sm text-[#606060]">{item}</div>
              </div>
            ))
          ) : (
            <div className="rounded-lg border p-3 text-sm text-[#606060]">
              Core setup blockers are clear. Review the submission sections below before filing.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Corporation tax submission</CardTitle>
          <CardDescription>
            Sends the current filing-ready CT600 XML to the {ctEnvironmentLabel} Transaction Engine
            using the sender credentials configured on the API runtime, then lets you poll the
            latest response using the stored correlation ID. Runtime defaults to test until you
            explicitly switch `HMRC_CT_ENVIRONMENT` to `production`.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-2 rounded-lg border p-3">
              <div className="text-sm text-[#606060]">Current period</div>
              <div className="font-medium">{period.periodKey}</div>
              <div className="text-xs text-[#606060]">
                Submission uses the pack currently shown in this workspace.
              </div>
            </div>
            <div className="space-y-2 rounded-lg border p-3">
              <div className="text-sm text-[#606060]">Latest event</div>
              <Badge variant={latestCtSubmission ? "default" : "secondary"}>
                {latestCtSubmission?.status ?? "No submissions"}
              </Badge>
              <div className="text-xs text-[#606060]">
                {latestCtSubmission
                  ? humanizeToken(latestCtSubmission.eventType)
                  : "Nothing sent to HMRC yet"}
              </div>
            </div>
            <div className="space-y-2 rounded-lg border p-3">
              <div className="text-sm text-[#606060]">Correlation ID</div>
              <div className="font-mono text-xs">
                {latestCtSubmission?.correlationId ?? "Not available"}
              </div>
              <div className="text-xs text-[#606060]">
                Used to poll HMRC Transaction Engine for completion.
              </div>
            </div>
            <div className="space-y-2 rounded-lg border p-3">
              <div className="text-sm text-[#606060]">Runtime</div>
              <Badge variant={ctIsProduction ? "destructive" : "outline"}>
                {humanizeToken(ctEnvironment)}
              </Badge>
              <div className="text-xs text-[#606060]">
                {ctIsProduction
                  ? "Live endpoint is active. Submissions use the filing profile UTR."
                  : "Default-safe mode. Deployed environments stay on test until you switch them."}
              </div>
            </div>
            <div className="space-y-2 rounded-lg border p-3">
              <div className="text-sm text-[#606060]">Submission reference</div>
              <div className="font-mono text-xs break-all">
                {ctRuntime?.submissionReference ?? "Not configured"}
              </div>
              <div className="text-xs text-[#606060]">
                {describeHmrcCtReferenceSource(ctRuntime?.submissionReferenceSource)}
              </div>
            </div>
            <div className="space-y-2 rounded-lg border p-3">
              <div className="text-sm text-[#606060]">Latest poll target</div>
              <div className="text-xs font-medium break-all">
                {payloadString(latestCtPollTarget?.responsePayload, "responseEndpoint") ??
                  "Falls back to the default submission endpoint"}
              </div>
            </div>
          </div>

          {!ctRuntimeConfigured ? (
            <div className="rounded-lg border border-dashed p-3 text-sm text-[#606060]">
              Set `HMRC_CT_SENDER_ID`, `HMRC_CT_SENDER_PASSWORD`, and `HMRC_CT_VENDOR_ID` on the API
              runtime before CT submission.
            </div>
          ) : null}

          {!ctSubmissionReferenceReady ? (
            <div className="rounded-lg border border-dashed p-3 text-sm text-[#606060]">
              {ctIsProduction
                ? "Save the company UTR in compliance settings before switching HMRC CT filing to production."
                : "Set `HMRC_CT_TEST_UTR` on the API runtime or save the company UTR in compliance settings before CT submission."}
            </div>
          ) : null}

          <div className="flex items-start gap-3 rounded-lg border p-3">
            <Checkbox
              id="ct-declaration"
              checked={ctDeclarationAccepted}
              onCheckedChange={(checked) => setCtDeclarationAccepted(checked === true)}
            />
            <div className="space-y-1">
              <Label htmlFor="ct-declaration">
                I have reviewed the current year-end pack and want to submit the CT600 to{" "}
                {ctEnvironmentLabel}.
              </Label>
              <p className="text-xs text-[#606060]">
                {ctIsProduction
                  ? "This uses the filing profile UTR and the live sender credentials from runtime config."
                  : "This uses the SDS test UTR when configured, otherwise the filing profile UTR, together with the test sender credentials from runtime config."}{" "}
                Submission is only enabled when the supported filing-ready path is complete.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  disabled={
                    !pack ||
                    pack.status === "draft" ||
                    !filingReadiness?.isReady ||
                    !ctSubmissionTargetReady ||
                    !ctDeclarationAccepted ||
                    submitCt600.isPending
                  }
                >
                  Submit CT600
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Submit CT600 to {ctEnvironmentLabel}</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tamias will send the current CT600 XML, including encoded iXBRL attachments, to{" "}
                    {ctEnvironmentLabel} using the sender credentials configured on the API runtime,
                    but only when the supported filing-ready path is complete.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {ctIsProduction ? (
                  <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-3">
                    <div className="text-sm font-medium text-red-700">
                      Live filing confirmation required
                    </div>
                    <p className="text-sm text-red-700">
                      This submission will target the HMRC live service using the filing profile
                      UTR. Only continue if this company and return are ready for a real filing.
                    </p>
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="ct-live-confirmation"
                        checked={ctLiveConfirmationAccepted}
                        onCheckedChange={(checked) =>
                          setCtLiveConfirmationAccepted(checked === true)
                        }
                      />
                      <Label htmlFor="ct-live-confirmation" className="text-sm text-red-700">
                        I understand this targets HMRC live and is not a test submission.
                      </Label>
                    </div>
                  </div>
                ) : null}
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      submitCt600.mutate({
                        periodKey: period.periodKey,
                        declarationAccepted: true,
                      })
                    }
                    disabled={
                      submitCt600.isPending || (ctIsProduction && !ctLiveConfirmationAccepted)
                    }
                  >
                    Submit
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <SubmitButton
              isSubmitting={pollCt600.isPending}
              disabled={pollCt600.isPending || !latestCtPollTarget?.correlationId}
              onClick={() =>
                pollCt600.mutate({
                  periodKey: period.periodKey,
                  correlationId: latestCtPollTarget?.correlationId ?? undefined,
                  responseEndpoint: payloadString(
                    latestCtPollTarget?.responsePayload,
                    "responseEndpoint",
                  ),
                })
              }
              variant="outline"
            >
              Poll latest HMRC response
            </SubmitButton>
          </div>

          {ctSubmissions.length ? (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Correlation</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ctSubmissions.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>{formatDateTime(event.createdAt)}</TableCell>
                      <TableCell>{humanizeToken(event.eventType)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{event.status}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {event.correlationId ?? "Not available"}
                      </TableCell>
                      <TableCell>{describeHmrcCtOutcome(event)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedCtSubmissionId(event.id)}
                        >
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {selectedCtSubmission ? (
                <div className="space-y-4 rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-sm font-medium">CT submission details</div>
                      <div className="text-sm text-[#606060]">
                        {humanizeToken(selectedCtSubmission.eventType)} on{" "}
                        {formatDateTime(selectedCtSubmission.createdAt)}
                      </div>
                      <div className="text-xs text-[#606060]">
                        Bundle contents:{" "}
                        {payloadArray(selectedCtSubmission.requestPayload, "artifactFiles")
                          .filter((item): item is string => typeof item === "string")
                          .join(", ") || "Not available"}
                      </div>
                    </div>
                    {ctSubmissionArtifactDownload.url ? (
                      <Button asChild size="sm" variant="outline">
                        <a href={ctSubmissionArtifactDownload.url}>Download sent bundle</a>
                      </Button>
                    ) : null}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-lg border p-3">
                      <div className="text-sm text-[#606060]">Environment</div>
                      <div className="mt-1 font-medium">
                        {humanizeToken(
                          payloadString(selectedCtSubmission.requestPayload, "environment"),
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-sm text-[#606060]">Submission reference</div>
                      <div className="mt-1 font-mono text-xs">
                        {payloadString(
                          selectedCtSubmission.requestPayload,
                          "submissionReference",
                        ) ?? "Not available"}
                      </div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-sm text-[#606060]">Correlation ID</div>
                      <div className="mt-1 font-mono text-xs">
                        {selectedCtSubmission.correlationId ?? "Not available"}
                      </div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-sm text-[#606060]">Summary</div>
                      <div className="mt-1 text-sm">
                        {describeHmrcCtOutcome(selectedCtSubmission)}
                      </div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-sm text-[#606060]">Response endpoint</div>
                      <div className="mt-1 text-xs break-all">
                        {payloadString(selectedCtSubmission.responsePayload, "responseEndpoint") ??
                          "Not available"}
                      </div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-sm text-[#606060]">Poll interval</div>
                      <div className="mt-1 font-medium">
                        {payloadNumber(selectedCtSubmission.responsePayload, "pollInterval") ??
                          "Not available"}
                      </div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-sm text-[#606060]">Gateway timestamp</div>
                      <div className="mt-1 text-sm">
                        {formatDateTime(
                          payloadString(selectedCtSubmission.responsePayload, "gatewayTimestamp"),
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-sm text-[#606060]">Form bundle number</div>
                      <div className="mt-1 font-mono text-xs">
                        {payloadString(selectedCtSubmission.responsePayload, "formBundleNumber") ??
                          "Not available"}
                      </div>
                    </div>
                  </div>

                  {getHmrcCtErrors(selectedCtSubmission).length ? (
                    <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
                      <div className="text-sm font-medium text-red-700">HMRC errors</div>
                      <div className="space-y-2 text-sm text-red-700">
                        {getHmrcCtErrors(selectedCtSubmission).map((error, index) => (
                          <div key={`${error.number ?? "error"}-${index}`}>
                            {(error.number ? `${error.number}: ` : "") +
                              (error.text ?? "Unknown HMRC error")}
                            {error.location ? ` (${error.location})` : ""}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {getHmrcCtNotices(selectedCtSubmission).length ? (
                    <div className="space-y-2 rounded-lg border p-3">
                      <div className="text-sm font-medium">HMRC notices</div>
                      <div className="space-y-2 text-sm text-[#606060]">
                        {getHmrcCtNotices(selectedCtSubmission).map((notice) => (
                          <div key={notice}>{notice}</div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {selectedCtSubmission.errorMessage ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {selectedCtSubmission.errorMessage}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="text-sm text-[#606060]">
              No CT submission events have been recorded for this period yet.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Companies House status</CardTitle>
          <CardDescription>
            Combines the public-register checks for the filing-profile company with the XML-gateway
            annual-accounts filing path. Public register lookups use the API key and optional OAuth
            app connection; direct annual accounts submission uses the Companies House presenter
            credentials configured on the API runtime plus the company authentication code saved in
            compliance settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2 rounded-lg border p-3">
              <div className="text-sm text-[#606060]">XML gateway</div>
              <Badge variant={companiesHouseXmlGatewayReady ? "default" : "secondary"}>
                {companiesHouseXmlGatewayReady ? "Configured" : "Missing config"}
              </Badge>
              <div className="text-xs text-[#606060]">
                {companiesHouseStatus?.xmlGatewayEnvironment
                  ? humanizeToken(companiesHouseStatus.xmlGatewayEnvironment)
                  : "No environment"}
              </div>
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              <div className="text-sm text-[#606060]">Company auth code</div>
              <Badge variant={companiesHouseAuthCodeReady ? "default" : "secondary"}>
                {companiesHouseAuthCodeReady ? "Saved" : "Missing"}
              </Badge>
              <div className="text-xs text-[#606060]">Required for XML annual-accounts filing</div>
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              <div className="text-sm text-[#606060]">Public register</div>
              <div className="text-base font-medium">
                {companiesHouseStatus?.companyProfile?.companyName ??
                  companiesHouseStatus?.profileCompanyName ??
                  "Company not linked"}
              </div>
              <div className="text-xs text-[#606060]">
                {companiesHouseStatus?.companyProfile?.companyNumber ??
                  companiesHouseStatus?.profileCompanyNumber ??
                  "Add a company number in compliance settings"}
              </div>
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              <div className="text-sm text-[#606060]">OAuth app</div>
              <Badge variant={companiesHouseStatus?.connected ? "default" : "secondary"}>
                {companiesHouseStatus?.connected ? "Connected" : "Not connected"}
              </Badge>
              <div className="text-xs text-[#606060]">Optional for the Apps-sheet workflows</div>
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              <div className="text-sm text-[#606060]">Next accounts due</div>
              <div className="text-base font-medium">
                {formatDate(companiesHouseStatus?.nextAccountsDueOn)}
              </div>
              <div className="text-xs text-[#606060]">
                {companiesHouseStatus?.accountsOverdue
                  ? "Marked overdue on Companies House"
                  : "Public due date from the register"}
              </div>
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              <div className="text-sm text-[#606060]">Current pack</div>
              <Badge variant={companiesHouseStatus?.currentPeriodFiled ? "default" : "outline"}>
                {companiesHouseStatus?.currentPeriodFiled
                  ? "Already reflected on register"
                  : companiesHouseStatus?.currentPeriodEnd
                    ? "Not yet reflected"
                    : "No comparison yet"}
              </Badge>
              <div className="text-xs text-[#606060]">
                {companiesHouseStatus?.currentPeriodEnd
                  ? `Pack period end ${formatDate(companiesHouseStatus.currentPeriodEnd)}`
                  : "Build the current year-end pack to compare period end dates"}
              </div>
            </div>
          </div>

          {companiesHouseStatus?.companyProfile ? (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border p-3">
                <div className="text-sm text-[#606060]">Register status</div>
                <div className="mt-1 font-medium">
                  {humanizeToken(companiesHouseStatus.companyProfile.companyStatus)}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-sm text-[#606060]">Latest accounts made up to</div>
                <div className="mt-1 font-medium">
                  {formatDate(companiesHouseStatus.latestAccountsMadeUpTo)}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-sm text-[#606060]">Can file</div>
                <div className="mt-1 font-medium">
                  {companiesHouseStatus.canFile === null
                    ? "Unknown"
                    : companiesHouseStatus.canFile
                      ? "Yes"
                      : "No"}
                </div>
              </div>
            </div>
          ) : null}

          {!companiesHouseStatus?.profileCompanyNumber ? (
            <div className="rounded-lg border border-dashed p-3 text-sm text-[#606060]">
              Add the company number in compliance settings before comparing the year-end pack with
              the Companies House register.
            </div>
          ) : null}

          {!companiesHouseStatus?.apiKeyConfigured ? (
            <div className="rounded-lg border border-dashed p-3 text-sm text-[#606060]">
              Set `COMPANIES_HOUSE_API_KEY` on the API runtime to enable public register checks and
              recent filing history.
            </div>
          ) : null}

          {companiesHouseStatus?.publicDataError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {companiesHouseStatus.publicDataError}
            </div>
          ) : null}

          {!companiesHouseXmlGatewayReady ? (
            <div className="rounded-lg border border-dashed p-3 text-sm text-[#606060]">
              Set `COMPANIES_HOUSE_XML_PRESENTER_ID`,
              `COMPANIES_HOUSE_XML_PRESENTER_AUTHENTICATION_CODE`, and optionally
              `COMPANIES_HOUSE_XML_PACKAGE_REFERENCE` on the API runtime to enable annual accounts
              filing through the Companies House XML gateway.
            </div>
          ) : null}

          {!companiesHouseAuthCodeReady ? (
            <div className="rounded-lg border border-dashed p-3 text-sm text-[#606060]">
              Save the Companies House authentication code in compliance settings before sending
              annual accounts through the XML gateway.
            </div>
          ) : null}

          <div className="space-y-4 rounded-lg border p-4">
            <div className="space-y-1">
              <div className="text-sm font-medium">Annual accounts submission</div>
              <div className="text-sm text-[#606060]">
                Sends the current filing-ready accounts attachment to Companies House through the
                XML gateway. The public-register API and OAuth app are separate from this submission
                path.
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border p-3">
              <Checkbox
                id="accounts-declaration"
                checked={accountsDeclarationAccepted}
                onCheckedChange={(checked) => setAccountsDeclarationAccepted(Boolean(checked))}
              />
              <div className="space-y-1">
                <Label htmlFor="accounts-declaration" className="font-medium">
                  I confirm this annual accounts pack is approved for Companies House submission
                </Label>
                <p className="text-xs text-[#606060]">
                  Tamias will send the current iXBRL accounts attachment using the Companies House
                  presenter credentials configured on the API runtime. Submission is only enabled
                  when the supported filing-ready path is complete and the company authentication
                  code is saved.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    disabled={
                      !period ||
                      !annualAccountsSubmissionReady ||
                      !accountsDeclarationAccepted ||
                      submitAccounts.isPending
                    }
                  >
                    Submit annual accounts
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Submit annual accounts to Companies House</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tamias will send the current iXBRL annual accounts attachment through the
                      Companies House XML gateway using the presenter credentials configured on the
                      API runtime and the company authentication code saved in compliance settings.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        period
                          ? submitAccounts.mutate({
                              periodKey: period.periodKey,
                              declarationAccepted: true,
                            })
                          : undefined
                      }
                      disabled={submitAccounts.isPending}
                    >
                      Submit
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <SubmitButton
                isSubmitting={pollAccounts.isPending}
                disabled={
                  pollAccounts.isPending ||
                  !payloadString(latestAccountsPollTarget?.requestPayload, "submissionNumber")
                }
                onClick={() =>
                  period
                    ? pollAccounts.mutate({
                        periodKey: period.periodKey,
                        submissionNumber:
                          payloadString(
                            latestAccountsPollTarget?.requestPayload,
                            "submissionNumber",
                          ) ?? undefined,
                      })
                    : undefined
                }
                variant="outline"
              >
                Poll latest Companies House status
              </SubmitButton>
            </div>

            {accountsSubmissions.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submission</TableHead>
                    <TableHead>Outcome</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accountsSubmissions.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>{formatDateTime(event.createdAt)}</TableCell>
                      <TableCell>{humanizeToken(event.eventType)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{event.status}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {payloadString(event.requestPayload, "submissionNumber") ?? "Not available"}
                      </TableCell>
                      <TableCell>{describeCompaniesHouseAccountsOutcome(event)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-sm text-[#606060]">
                No Companies House annual accounts submission events have been recorded for this
                period yet.
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/compliance/settings">Open compliance settings</Link>
            </Button>
            {download.url ? (
              <Button asChild variant="ghost" size="sm">
                <a href={download.url}>Download latest bundle</a>
              </Button>
            ) : null}
          </div>

          {companiesHouseStatus?.recentAccountsFilings?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Transaction</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companiesHouseStatus.recentAccountsFilings.map((item) => (
                  <TableRow key={item.transactionId ?? `${item.date}-${item.description}`}>
                    <TableCell>{formatDate(item.date)}</TableCell>
                    <TableCell>{humanizeToken(item.description ?? item.category)}</TableCell>
                    <TableCell>{item.type ?? "Unknown"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {item.transactionId ?? "Unknown"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : companiesHouseStatus?.apiKeyConfigured &&
            companiesHouseStatus?.profileCompanyNumber ? (
            <div className="text-sm text-[#606060]">
              No recent Companies House accounts filings were returned for this company.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <CardTitle>Tax calculations and supporting schedules</CardTitle>
            <CardDescription>
              Trial balance, CT adjustments, CT rate inputs, CT600A data, and working papers. Expand
              this when you need to review or edit the underlying numbers.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setTaxDetailsExpanded((current) => !current)}
          >
            {taxDetailsExpanded ? "Hide details" : "Show details"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border p-3">
              <div className="text-sm text-[#606060]">Trial balance lines</div>
              <div className="mt-1 text-lg font-medium">{trialBalance.length}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-sm text-[#606060]">CT adjustments</div>
              <div className="mt-1 text-lg font-medium">
                {workspace?.corporationTaxAdjustments?.length ?? 0}
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-sm text-[#606060]">CT rate inputs</div>
              <div className="mt-1 text-lg font-medium">
                {corporationTaxRateSchedule ? "Saved" : "Pending"}
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-sm text-[#606060]">CT600A schedule</div>
              <div className="mt-1 text-lg font-medium">
                {closeCompanyLoansSchedule ? "Saved" : "Not started"}
              </div>
            </div>
          </div>

          {taxDetailsExpanded ? (
            <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Trial balance</CardTitle>
                  <CardDescription>Snapshot stored with the current pack rebuild.</CardDescription>
                </CardHeader>
                <CardContent>
                  {trialBalance.length ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Account</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Debit</TableHead>
                          <TableHead className="text-right">Credit</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {trialBalance.map((line) => (
                          <TableRow key={line.accountCode}>
                            <TableCell>
                              <div className="font-medium">{line.accountName}</div>
                              <div className="text-xs text-[#606060]">{line.accountCode}</div>
                            </TableCell>
                            <TableCell className="capitalize">
                              {line.accountType.replace("_", " ")}
                            </TableCell>
                            <TableCell className="text-right">
                              <FormatAmount
                                amount={line.debit}
                                currency={pack?.currency ?? "GBP"}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <FormatAmount
                                amount={line.credit}
                                currency={pack?.currency ?? "GBP"}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <FormatAmount
                                amount={line.balance}
                                currency={pack?.currency ?? "GBP"}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-sm text-[#606060]">
                      Build the pack to snapshot the current trial balance.
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Corporation tax summary</CardTitle>
                    <CardDescription>
                      Structured HMRC computation categories used by the supported filing-ready
                      path.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span>Accounting profit before tax</span>
                      <span className="font-medium">
                        <FormatAmount
                          amount={Number(
                            (
                              pack?.corporationTax as
                                | { accountingProfitBeforeTax?: number }
                                | undefined
                            )?.accountingProfitBeforeTax ?? 0,
                          )}
                          currency={pack?.currency ?? "GBP"}
                        />
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Manual adjustments</span>
                      <span className="font-medium">
                        <FormatAmount
                          amount={Number(
                            (
                              pack?.corporationTax as
                                | { manualAdjustmentsTotal?: number }
                                | undefined
                            )?.manualAdjustmentsTotal ?? 0,
                          )}
                          currency={pack?.currency ?? "GBP"}
                        />
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Estimated CT due</span>
                      <span className="font-medium">
                        <FormatAmount
                          amount={Number(
                            (
                              pack?.corporationTax as
                                | { estimatedCorporationTaxDue?: number }
                                | undefined
                            )?.estimatedCorporationTaxDue ?? 0,
                          )}
                          currency={pack?.currency ?? "GBP"}
                        />
                      </span>
                    </div>

                    {ct600Draft?.computationBreakdown ? (
                      <div className="space-y-2 border-t pt-3">
                        <div className="text-sm font-medium">Supported-path computation</div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Profit or loss per accounts</span>
                          <span className="font-medium">
                            <FormatAmount
                              amount={ct600Draft.computationBreakdown.profitLossPerAccounts}
                              currency={pack?.currency ?? "GBP"}
                            />
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Depreciation and amortisation</span>
                          <span className="font-medium">
                            <FormatAmount
                              amount={
                                ct600Draft.computationBreakdown.depreciationAmortisationAdjustments
                              }
                              currency={pack?.currency ?? "GBP"}
                            />
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Capital allowances</span>
                          <span className="font-medium">
                            <FormatAmount
                              amount={ct600Draft.computationBreakdown.totalCapitalAllowances}
                              currency={pack?.currency ?? "GBP"}
                            />
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Qualifying donations</span>
                          <span className="font-medium">
                            <FormatAmount
                              amount={ct600Draft.computationBreakdown.qualifyingDonations}
                              currency={pack?.currency ?? "GBP"}
                            />
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Losses brought forward</span>
                          <span className="font-medium">
                            <FormatAmount
                              amount={ct600Draft.computationBreakdown.lossesBroughtForward}
                              currency={pack?.currency ?? "GBP"}
                            />
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Group relief claimed</span>
                          <span className="font-medium">
                            <FormatAmount
                              amount={ct600Draft.computationBreakdown.groupReliefClaimed}
                              currency={pack?.currency ?? "GBP"}
                            />
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Total profits chargeable</span>
                          <span className="font-medium">
                            <FormatAmount
                              amount={
                                ct600Draft.computationBreakdown
                                  .totalProfitsChargeableToCorporationTax
                              }
                              currency={pack?.currency ?? "GBP"}
                            />
                          </span>
                        </div>
                      </div>
                    ) : null}

                    <div className="space-y-2 border-t pt-3">
                      <div className="space-y-1">
                        <Label>Category</Label>
                        <Select
                          value={ctCategory}
                          onValueChange={(value) =>
                            setCtCategory(value as CorporationTaxAdjustmentCategory)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose category" />
                          </SelectTrigger>
                          <SelectContent>
                            {CT_ADJUSTMENT_CATEGORIES.map((item) => (
                              <SelectItem key={item.value} value={item.value}>
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="text-xs text-[#606060]">{selectedCtCategory.guidance}</div>
                      </div>
                      <div className="space-y-1">
                        <Label>Adjustment label</Label>
                        <Input
                          value={ctLabel}
                          onChange={(event) => setCtLabel(event.target.value)}
                          placeholder="Disallowable entertaining"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Amount</Label>
                        <Input
                          inputMode="decimal"
                          value={ctAmount}
                          onChange={(event) => setCtAmount(event.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Note</Label>
                        <Input
                          value={ctNote}
                          onChange={(event) => setCtNote(event.target.value)}
                          placeholder="Optional note"
                        />
                      </div>
                      <SubmitButton
                        isSubmitting={createCtAdjustment.isPending}
                        onClick={() =>
                          createCtAdjustment.mutate({
                            category: ctCategory,
                            label: ctLabel,
                            amount: toNumber(ctAmount),
                            note: ctNote || null,
                            periodKey: workspace?.period.periodKey,
                          })
                        }
                        disabled={!ctLabel.trim()}
                      >
                        Add CT adjustment
                      </SubmitButton>
                    </div>

                    <div className="space-y-2 border-t pt-3">
                      {workspace?.corporationTaxAdjustments?.length ? (
                        workspace.corporationTaxAdjustments.map((adjustment) => (
                          <div
                            key={adjustment.id}
                            className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                          >
                            <div>
                              <div className="text-sm font-medium">{adjustment.label}</div>
                              <div className="text-xs text-[#606060]">
                                {humanizeToken(adjustment.category)}
                                {adjustment.note ? ` · ${adjustment.note}` : ""}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-sm font-medium">
                                <FormatAmount
                                  amount={adjustment.amount}
                                  currency={pack?.currency ?? "GBP"}
                                />
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  deleteCtAdjustment.mutate({
                                    adjustmentId: adjustment.id,
                                    periodKey: workspace.period.periodKey,
                                  })
                                }
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-[#606060]">
                          No corporation-tax adjustments yet.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>CT rate inputs</CardTitle>
                    <CardDescription>
                      Confirm the associated-companies counts and qualifying exempt distributions
                      used for small-profits-rate and marginal-relief calculations.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {ctPeriodUsesSmallProfitsRules ? (
                      <>
                        <div className="rounded-lg border p-3 text-sm text-[#606060]">
                          Enter the number of associated companies excluding this company. Use `0`
                          when there are none. Leave exempt distributions blank if none were
                          received from non-group companies in the period.
                        </div>

                        {ctPeriodSpansTwoFinancialYears ? (
                          <div className="flex items-start gap-3 rounded-lg border p-3">
                            <Checkbox
                              id="ct-rate-split-years"
                              checked={ctRateUseSplitYears}
                              onCheckedChange={(checked) =>
                                setCtRateUseSplitYears(checked === true)
                              }
                            />
                            <div className="space-y-1">
                              <Label htmlFor="ct-rate-split-years">
                                Associated-companies count changes across the two CT financial years
                              </Label>
                              <p className="text-xs text-[#606060]">
                                Leave this unticked when the same count applies across the whole
                                return period.
                              </p>
                            </div>
                          </div>
                        ) : null}

                        <div
                          className={`grid gap-3 ${
                            ctRateUseSplitYears && ctPeriodSpansTwoFinancialYears
                              ? "md:grid-cols-3"
                              : "md:grid-cols-2"
                          }`}
                        >
                          {ctRateUseSplitYears && ctPeriodSpansTwoFinancialYears ? (
                            <>
                              <div className="space-y-1">
                                <Label>
                                  Associated companies in FY{" "}
                                  {getCorporationTaxFinancialYear(period.periodStart)}
                                </Label>
                                <Input
                                  inputMode="numeric"
                                  value={ctRateAssociatedCompaniesFirstYear}
                                  onChange={(event) =>
                                    setCtRateAssociatedCompaniesFirstYear(event.target.value)
                                  }
                                  placeholder="0"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label>
                                  Associated companies in FY{" "}
                                  {getCorporationTaxFinancialYear(period.periodStart) + 1}
                                </Label>
                                <Input
                                  inputMode="numeric"
                                  value={ctRateAssociatedCompaniesSecondYear}
                                  onChange={(event) =>
                                    setCtRateAssociatedCompaniesSecondYear(event.target.value)
                                  }
                                  placeholder="0"
                                />
                              </div>
                            </>
                          ) : (
                            <div className="space-y-1">
                              <Label>Associated companies in this period</Label>
                              <Input
                                inputMode="numeric"
                                value={ctRateAssociatedCompaniesThisPeriod}
                                onChange={(event) =>
                                  setCtRateAssociatedCompaniesThisPeriod(event.target.value)
                                }
                                placeholder="0"
                              />
                            </div>
                          )}

                          <div className="space-y-1">
                            <Label>Exempt ABGH distributions</Label>
                            <Input
                              inputMode="decimal"
                              value={ctRateExemptDistributions}
                              onChange={(event) => setCtRateExemptDistributions(event.target.value)}
                              placeholder="Leave blank if none"
                            />
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-4">
                          <div className="rounded-lg border p-3">
                            <div className="text-sm text-[#606060]">Gross CT chargeable</div>
                            <div className="mt-1 font-medium">
                              <FormatAmount
                                amount={ct600Draft?.grossCorporationTax ?? 0}
                                currency={pack?.currency ?? "GBP"}
                              />
                            </div>
                          </div>
                          <div className="rounded-lg border p-3">
                            <div className="text-sm text-[#606060]">Marginal relief</div>
                            <div className="mt-1 font-medium">
                              <FormatAmount
                                amount={ct600Draft?.marginalRelief ?? 0}
                                currency={pack?.currency ?? "GBP"}
                              />
                            </div>
                          </div>
                          <div className="rounded-lg border p-3">
                            <div className="text-sm text-[#606060]">Net CT chargeable</div>
                            <div className="mt-1 font-medium">
                              <FormatAmount
                                amount={ct600Draft?.netCorporationTaxChargeable ?? 0}
                                currency={pack?.currency ?? "GBP"}
                              />
                            </div>
                          </div>
                          <div className="rounded-lg border p-3">
                            <div className="text-sm text-[#606060]">Augmented profits</div>
                            <div className="mt-1 font-medium">
                              <FormatAmount
                                amount={ct600Draft?.augmentedProfits ?? 0}
                                currency={pack?.currency ?? "GBP"}
                              />
                            </div>
                          </div>
                        </div>

                        {ctRateBreakdown.length ? (
                          <div className="rounded-lg border p-3">
                            <div className="mb-3 text-sm font-medium">Financial-year breakdown</div>
                            <div className="space-y-2">
                              {ctRateBreakdown.map((item) => (
                                <div
                                  key={`${item.financialYear}-${item.periodStart}`}
                                  className="grid gap-2 rounded-lg border px-3 py-2 md:grid-cols-6"
                                >
                                  <div>
                                    <div className="text-xs text-[#606060]">FY</div>
                                    <div className="text-sm font-medium">{item.financialYear}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-[#606060]">Basis</div>
                                    <div className="text-sm font-medium">
                                      {humanizeToken(item.chargeType)}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-[#606060]">
                                      Associated companies
                                    </div>
                                    <div className="text-sm font-medium">
                                      {item.associatedCompanies ?? 0}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-[#606060]">Chargeable profits</div>
                                    <div className="text-sm font-medium">
                                      <FormatAmount
                                        amount={item.chargeableProfits}
                                        currency={pack?.currency ?? "GBP"}
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-[#606060]">Tax rate</div>
                                    <div className="text-sm font-medium">
                                      {item.taxRate.toFixed(2)}%
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-[#606060]">Net CT</div>
                                    <div className="text-sm font-medium">
                                      <FormatAmount
                                        amount={item.netCorporationTax}
                                        currency={pack?.currency ?? "GBP"}
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <div className="flex flex-wrap items-center gap-2">
                          <SubmitButton
                            isSubmitting={upsertCorporationTaxRateScheduleMutation.isPending}
                            disabled={!ctRateHasValidInputs}
                            onClick={() =>
                              upsertCorporationTaxRateScheduleMutation.mutate({
                                periodKey: workspace?.period.periodKey,
                                exemptDistributions: ctRateExemptDistributionsValue,
                                associatedCompaniesThisPeriod:
                                  ctRateUseSplitYears && ctPeriodSpansTwoFinancialYears
                                    ? null
                                    : ctRateAssociatedCompaniesThisPeriodValue,
                                associatedCompaniesFirstYear:
                                  ctRateUseSplitYears && ctPeriodSpansTwoFinancialYears
                                    ? ctRateAssociatedCompaniesFirstYearValue
                                    : null,
                                associatedCompaniesSecondYear:
                                  ctRateUseSplitYears && ctPeriodSpansTwoFinancialYears
                                    ? ctRateAssociatedCompaniesSecondYearValue
                                    : null,
                              })
                            }
                          >
                            Save CT rate inputs
                          </SubmitButton>
                          {corporationTaxRateSchedule ? (
                            <Button
                              variant="ghost"
                              onClick={() =>
                                deleteCorporationTaxRateScheduleMutation.mutate({
                                  periodKey: workspace?.period.periodKey,
                                })
                              }
                            >
                              Delete saved inputs
                            </Button>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <div className="rounded-lg border border-dashed p-3 text-sm text-[#606060]">
                        Small profits rate and marginal relief do not apply to periods ending before
                        1 April 2023, so this schedule is not used for the current period.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>CT600A close-company loans</CardTitle>
                    <CardDescription>
                      Save the close-company loans schedule used to generate CT600A in the draft
                      CT600 XML and export bundle.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-start gap-3 rounded-lg border p-3">
                      <Checkbox
                        id="ct600a-before-end-period"
                        checked={closeCompanyBeforeEndPeriod}
                        onCheckedChange={(checked) =>
                          setCloseCompanyBeforeEndPeriod(checked === true)
                        }
                      />
                      <div className="space-y-1">
                        <Label htmlFor="ct600a-before-end-period">
                          Loans or arrangements remained outstanding at the period end
                        </Label>
                        <p className="text-xs text-[#606060]">
                          HMRC box A5. Amount rows should be entered as whole pounds.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg border p-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium">
                            Part 1: Outstanding loans and arrangements
                          </div>
                          <div className="text-xs text-[#606060]">HMRC boxes A10 to A20.</div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setCloseCompanyLoansMade((current) => [...current, createLoanRow()])
                          }
                        >
                          Add row
                        </Button>
                      </div>
                      <div className="space-y-3">
                        {closeCompanyLoansMade.map((row, index) => (
                          <div
                            key={row.id}
                            className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px_auto]"
                          >
                            <Input
                              value={row.name}
                              onChange={(event) =>
                                setCloseCompanyLoansMade((current) =>
                                  current.map((item) =>
                                    item.id === row.id
                                      ? { ...item, name: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                              placeholder={`Participator ${index + 1}`}
                            />
                            <Input
                              inputMode="numeric"
                              value={row.amountOfLoan}
                              onChange={(event) =>
                                setCloseCompanyLoansMade((current) =>
                                  current.map((item) =>
                                    item.id === row.id
                                      ? {
                                          ...item,
                                          amountOfLoan: event.target.value,
                                        }
                                      : item,
                                  ),
                                )
                              }
                              placeholder="Amount of loan"
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setCloseCompanyLoansMade((current) =>
                                  current.length === 1
                                    ? [createLoanRow()]
                                    : current.filter((item) => item.id !== row.id),
                                )
                              }
                            >
                              Delete
                            </Button>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="rounded-lg border p-3">
                          <div className="text-sm text-[#606060]">Total loans (A15)</div>
                          <div className="mt-1 font-medium">
                            <FormatAmount
                              amount={closeCompanyLoansMadeTotal}
                              currency={pack?.currency ?? "GBP"}
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label>Tax chargeable (A20)</Label>
                          <Input
                            inputMode="decimal"
                            value={closeCompanyTaxChargeable}
                            onChange={(event) => setCloseCompanyTaxChargeable(event.target.value)}
                            placeholder="Leave blank if not applicable"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border p-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium">Part 2: Relief within 9 months</div>
                          <div className="text-xs text-[#606060]">HMRC boxes A25 to A45.</div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setCloseCompanyReliefEarlierThan((current) => [
                              ...current,
                              createLoanReliefRow(),
                            ])
                          }
                        >
                          Add row
                        </Button>
                      </div>
                      <div className="space-y-3">
                        {closeCompanyReliefEarlierThan.map((row, index) => (
                          <div
                            key={row.id}
                            className="grid gap-2 md:grid-cols-[minmax(0,1fr)_140px_140px_170px_auto]"
                          >
                            <Input
                              value={row.name}
                              onChange={(event) =>
                                setCloseCompanyReliefEarlierThan((current) =>
                                  current.map((item) =>
                                    item.id === row.id
                                      ? { ...item, name: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                              placeholder={`Participator ${index + 1}`}
                            />
                            <Input
                              inputMode="numeric"
                              value={row.amountRepaid}
                              onChange={(event) =>
                                setCloseCompanyReliefEarlierThan((current) =>
                                  current.map((item) =>
                                    item.id === row.id
                                      ? {
                                          ...item,
                                          amountRepaid: event.target.value,
                                        }
                                      : item,
                                  ),
                                )
                              }
                              placeholder="Repaid"
                            />
                            <Input
                              inputMode="numeric"
                              value={row.amountReleasedOrWrittenOff}
                              onChange={(event) =>
                                setCloseCompanyReliefEarlierThan((current) =>
                                  current.map((item) =>
                                    item.id === row.id
                                      ? {
                                          ...item,
                                          amountReleasedOrWrittenOff: event.target.value,
                                        }
                                      : item,
                                  ),
                                )
                              }
                              placeholder="Released"
                            />
                            <Input
                              type="date"
                              value={row.date}
                              onChange={(event) =>
                                setCloseCompanyReliefEarlierThan((current) =>
                                  current.map((item) =>
                                    item.id === row.id
                                      ? { ...item, date: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setCloseCompanyReliefEarlierThan((current) =>
                                  current.length === 1
                                    ? [createLoanReliefRow()]
                                    : current.filter((item) => item.id !== row.id),
                                )
                              }
                            >
                              Delete
                            </Button>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="rounded-lg border p-3">
                          <div className="text-sm text-[#606060]">Total relief base (A40)</div>
                          <div className="mt-1 font-medium">
                            <FormatAmount
                              amount={closeCompanyReliefEarlierTotal}
                              currency={pack?.currency ?? "GBP"}
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label>Relief due (A45)</Label>
                          <Input
                            inputMode="decimal"
                            value={closeCompanyReliefEarlierDue}
                            onChange={(event) =>
                              setCloseCompanyReliefEarlierDue(event.target.value)
                            }
                            placeholder="Leave blank if not applicable"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border p-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium">
                            Part 3: Relief due now after 9 months
                          </div>
                          <div className="text-xs text-[#606060]">HMRC boxes A50 to A70.</div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setCloseCompanyLoanLaterReliefNow((current) => [
                              ...current,
                              createLoanReliefRow(),
                            ])
                          }
                        >
                          Add row
                        </Button>
                      </div>
                      <div className="space-y-3">
                        {closeCompanyLoanLaterReliefNow.map((row, index) => (
                          <div
                            key={row.id}
                            className="grid gap-2 md:grid-cols-[minmax(0,1fr)_140px_140px_170px_auto]"
                          >
                            <Input
                              value={row.name}
                              onChange={(event) =>
                                setCloseCompanyLoanLaterReliefNow((current) =>
                                  current.map((item) =>
                                    item.id === row.id
                                      ? { ...item, name: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                              placeholder={`Participator ${index + 1}`}
                            />
                            <Input
                              inputMode="numeric"
                              value={row.amountRepaid}
                              onChange={(event) =>
                                setCloseCompanyLoanLaterReliefNow((current) =>
                                  current.map((item) =>
                                    item.id === row.id
                                      ? {
                                          ...item,
                                          amountRepaid: event.target.value,
                                        }
                                      : item,
                                  ),
                                )
                              }
                              placeholder="Repaid"
                            />
                            <Input
                              inputMode="numeric"
                              value={row.amountReleasedOrWrittenOff}
                              onChange={(event) =>
                                setCloseCompanyLoanLaterReliefNow((current) =>
                                  current.map((item) =>
                                    item.id === row.id
                                      ? {
                                          ...item,
                                          amountReleasedOrWrittenOff: event.target.value,
                                        }
                                      : item,
                                  ),
                                )
                              }
                              placeholder="Released"
                            />
                            <Input
                              type="date"
                              value={row.date}
                              onChange={(event) =>
                                setCloseCompanyLoanLaterReliefNow((current) =>
                                  current.map((item) =>
                                    item.id === row.id
                                      ? { ...item, date: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setCloseCompanyLoanLaterReliefNow((current) =>
                                  current.length === 1
                                    ? [createLoanReliefRow()]
                                    : current.filter((item) => item.id !== row.id),
                                )
                              }
                            >
                              Delete
                            </Button>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="rounded-lg border p-3">
                          <div className="text-sm text-[#606060]">Total relief base (A65)</div>
                          <div className="mt-1 font-medium">
                            <FormatAmount
                              amount={closeCompanyReliefLaterTotal}
                              currency={pack?.currency ?? "GBP"}
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label>Relief due now (A70)</Label>
                          <Input
                            inputMode="decimal"
                            value={closeCompanyReliefLaterDue}
                            onChange={(event) => setCloseCompanyReliefLaterDue(event.target.value)}
                            placeholder="Leave blank if not applicable"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="space-y-1">
                        <Label>Total loans outstanding (A75)</Label>
                        <Input
                          inputMode="numeric"
                          value={closeCompanyTotalLoansOutstanding}
                          onChange={(event) =>
                            setCloseCompanyTotalLoansOutstanding(event.target.value)
                          }
                          placeholder="Leave blank if nil"
                        />
                      </div>
                      <div className="rounded-lg border p-3">
                        <div className="text-sm text-[#606060]">Tax payable s455/s464C (A80)</div>
                        <div className="mt-1 font-medium">
                          <FormatAmount
                            amount={closeCompanyDerivedTaxPayable}
                            currency={pack?.currency ?? "GBP"}
                          />
                        </div>
                      </div>
                      <div className="rounded-lg border p-3">
                        <div className="text-sm text-[#606060]">Saved schedule</div>
                        <div className="mt-1 font-medium">
                          {closeCompanyLoansSchedule ? "Present for this period" : "Not saved"}
                        </div>
                      </div>
                    </div>

                    {closeCompanyHasIncompleteRows ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        Complete each CT600A row fully, or clear it, before saving.
                      </div>
                    ) : null}

                    {!closeCompanyHasMeaningfulContent ? (
                      <div className="rounded-lg border border-dashed p-3 text-sm text-[#606060]">
                        Save the schedule only when you have CT600A data for the current period.
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-2">
                      <SubmitButton
                        isSubmitting={upsertCloseCompanyLoansScheduleMutation.isPending}
                        disabled={
                          closeCompanyHasIncompleteRows || !closeCompanyHasMeaningfulContent
                        }
                        onClick={() =>
                          upsertCloseCompanyLoansScheduleMutation.mutate({
                            periodKey: workspace?.period.periodKey,
                            beforeEndPeriod: closeCompanyBeforeEndPeriod,
                            loansMade: normalizedCloseCompanyLoansMade.map((row) => ({
                              name: row.name,
                              amountOfLoan: row.amountOfLoan ?? 0,
                            })),
                            taxChargeable: closeCompanyTaxChargeableValue,
                            reliefEarlierThan: normalizedCloseCompanyReliefEarlierThan,
                            reliefEarlierDue: closeCompanyReliefEarlierDueValue,
                            loanLaterReliefNow: normalizedCloseCompanyLoanLaterReliefNow,
                            reliefLaterDue: closeCompanyReliefLaterDueValue,
                            totalLoansOutstanding: closeCompanyTotalLoansOutstandingValue,
                          })
                        }
                      >
                        Save CT600A schedule
                      </SubmitButton>
                      {closeCompanyLoansSchedule ? (
                        <Button
                          variant="ghost"
                          onClick={() =>
                            deleteCloseCompanyLoansScheduleMutation.mutate({
                              periodKey: workspace?.period.periodKey,
                            })
                          }
                        >
                          Delete saved schedule
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Working papers</CardTitle>
                    <CardDescription>
                      Current closing balances grouped into core year-end sections.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {workingPapers.length ? (
                      workingPapers.map((section) => (
                        <div key={section.key} className="rounded-lg border p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <div className="text-sm font-medium">{section.label}</div>
                            <div className="text-sm text-[#606060]">
                              <FormatAmount
                                amount={section.total}
                                currency={pack?.currency ?? "GBP"}
                              />
                            </div>
                          </div>
                          <div className="space-y-1 text-sm text-[#606060]">
                            {section.lines.length ? (
                              section.lines.map((line) => (
                                <div
                                  key={`${section.key}-${line.accountCode}`}
                                  className="flex items-center justify-between"
                                >
                                  <span>
                                    {line.accountCode} {line.accountName}
                                  </span>
                                  <span>
                                    <FormatAmount
                                      amount={line.balance}
                                      currency={pack?.currency ?? "GBP"}
                                    />
                                  </span>
                                </div>
                              ))
                            ) : (
                              <div>No balances in this section.</div>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-[#606060]">
                        Build the pack to generate the working-paper sections.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <CardTitle>Manual year-end journals</CardTitle>
            <CardDescription>
              Add explicit debit and credit adjustments to the annual pack when the ledger needs a
              year-end-only posting.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setManualJournalsExpanded((current) => !current)}
          >
            {manualJournalsExpanded ? "Hide journal editor" : "Open journal editor"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border p-3">
              <div className="text-sm text-[#606060]">Saved journals</div>
              <div className="mt-1 text-lg font-medium">
                {workspace?.manualJournals?.length ?? 0}
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-sm text-[#606060]">Last entry date</div>
              <div className="mt-1 text-lg font-medium">
                {workspace?.manualJournals?.[0]?.entryDate ?? "Not yet added"}
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-sm text-[#606060]">Status</div>
              <div className="mt-1 text-lg font-medium">
                {workspace?.manualJournals?.length
                  ? "Review and edit as needed"
                  : "No manual journals yet"}
              </div>
            </div>
          </div>

          {manualJournalsExpanded ? (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <Label>Effective date</Label>
                  <Input
                    type="date"
                    value={journalDate}
                    onChange={(event) => setJournalDate(event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Description</Label>
                  <Input
                    value={journalDescription}
                    onChange={(event) => setJournalDescription(event.target.value)}
                    placeholder="Year-end accrual"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Reference</Label>
                  <Input
                    value={journalReference}
                    onChange={(event) => setJournalReference(event.target.value)}
                    placeholder="YE-001"
                  />
                </div>
              </div>

              <JournalLinesEditor
                lines={journalLines}
                onChange={setJournalLines}
                addLabel="Add journal line"
              />

              <SubmitButton
                isSubmitting={createJournal.isPending}
                disabled={!journalDescription.trim()}
                onClick={() =>
                  createJournal.mutate({
                    effectiveDate: journalDate,
                    description: journalDescription,
                    reference: journalReference || null,
                    lines: journalLines.map((line) => ({
                      accountCode: line.accountCode,
                      description: line.description || null,
                      debit: toNumber(line.debit),
                      credit: toNumber(line.credit),
                    })),
                  })
                }
              >
                Save manual journal
              </SubmitButton>

              <div className="space-y-2 border-t pt-4">
                {workspace?.manualJournals?.length ? (
                  workspace.manualJournals.map((journal) => (
                    <div
                      key={journal.sourceId}
                      className="flex flex-col gap-3 rounded-lg border p-3 lg:flex-row lg:items-center lg:justify-between"
                    >
                      <div className="space-y-1">
                        <div className="text-sm font-medium">
                          {journal.description || "Manual journal"}
                        </div>
                        <div className="text-xs text-[#606060]">
                          {journal.entryDate}
                          {journal.reference ? ` · ${journal.reference}` : ""}
                        </div>
                        <div className="text-xs text-[#606060]">
                          {journal.lines
                            .map(
                              (line) =>
                                `${line.accountCode} D${line.debit ?? 0} C${line.credit ?? 0}`,
                            )
                            .join(" | ")}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          deleteJournal.mutate({
                            journalId: journal.sourceId,
                            periodKey: workspace.period.periodKey,
                          })
                        }
                      >
                        Delete
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-[#606060]">
                    No manual journals for this annual period yet.
                  </div>
                )}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
