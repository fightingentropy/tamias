import { spawnSync } from "node:child_process";
import { describe, expect, test } from "bun:test";
import {
  buildCt600Draft,
  buildStatutoryAccountsDraft,
  buildYearEndPackSnapshot,
  formatCompaniesHouseSubmissionNumber,
  renderAccountsAttachmentIxbrl,
  renderComputationsAttachmentIxbrl,
  renderCt600DraftXml,
  resolveAnnualPeriod,
} from "./index";

const BASE_PERIOD = {
  periodKey: "2026-03-31",
  periodStart: "2025-04-01",
  periodEnd: "2026-03-31",
  accountsDueDate: "2026-12-31",
  corporationTaxDueDate: "2027-01-01",
} as const;

const HISTORIC_PERIOD = {
  periodKey: "2025-03-31",
  periodStart: "2024-04-01",
  periodEnd: "2025-03-31",
  accountsDueDate: "2025-12-31",
  corporationTaxDueDate: "2026-01-01",
} as const;

const STRADDLE_PERIOD = {
  periodKey: "2023-12-31",
  periodStart: "2023-01-01",
  periodEnd: "2023-12-31",
  accountsDueDate: "2024-09-30",
  corporationTaxDueDate: "2024-10-01",
} as const;

function makeTeam() {
  return {
    id: "team-1",
    name: "Tamias Ltd",
    countryCode: "GB",
    baseCurrency: "GBP",
  } as const;
}

function makeProfile(
  overrides: Partial<{
    provider: "companies-house" | "hmrc-ct";
    companyName: string | null;
    companyNumber: string | null;
    companyAuthenticationCode: string | null;
    utr: string | null;
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
  }> = {},
) {
  return {
    id: "profile-1",
    teamId: "team-1",
    legalEntityType: "uk_ltd" as const,
    provider: overrides.provider ?? ("companies-house" as const),
    enabled: true,
    countryCode: "GB" as const,
    companyName: overrides.companyName ?? "Tamias Ltd",
    companyNumber: overrides.companyNumber ?? "12345678",
    companyAuthenticationCode:
      overrides.companyAuthenticationCode ?? "ABC123",
    utr: overrides.utr ?? "2288403582",
    vrn: null,
    vatScheme: null,
    accountingBasis: "accrual" as const,
    filingMode: "client" as const,
    agentReferenceNumber: null,
    yearEndMonth: 3,
    yearEndDay: 31,
    baseCurrency: "GBP",
    principalActivity: overrides.principalActivity ?? null,
    directors: overrides.directors ?? [],
    signingDirectorName: overrides.signingDirectorName ?? null,
    approvalDate: overrides.approvalDate ?? null,
    averageEmployeeCount: overrides.averageEmployeeCount ?? null,
    ordinaryShareCount: overrides.ordinaryShareCount ?? null,
    ordinaryShareNominalValue: overrides.ordinaryShareNominalValue ?? null,
    dormant: overrides.dormant ?? null,
    auditExemptionClaimed: overrides.auditExemptionClaimed ?? null,
    membersDidNotRequireAudit: overrides.membersDidNotRequireAudit ?? null,
    directorsAcknowledgeResponsibilities:
      overrides.directorsAcknowledgeResponsibilities ?? null,
    accountsPreparedUnderSmallCompaniesRegime:
      overrides.accountsPreparedUnderSmallCompaniesRegime ?? null,
    createdAt: "2026-01-15T00:00:00.000Z",
    updatedAt: "2026-01-15T00:00:00.000Z",
  };
}

function makeReadyProfile(
  overrides: Partial<ReturnType<typeof makeProfile>> = {},
) {
  return {
    ...makeProfile({
      principalActivity: "Software development and bookkeeping platform services",
      directors: ["Erlin Hoxha"],
      signingDirectorName: "Erlin Hoxha",
      approvalDate: "2026-04-10",
      averageEmployeeCount: 3,
      ordinaryShareCount: 100,
      ordinaryShareNominalValue: 1,
      dormant: false,
      auditExemptionClaimed: true,
      membersDidNotRequireAudit: true,
      directorsAcknowledgeResponsibilities: true,
      accountsPreparedUnderSmallCompaniesRegime: true,
    }),
    ...overrides,
  };
}

function makeAdjustment(
  overrides: Partial<{
    category:
      | "depreciation_amortisation"
      | "charitable_donations"
      | "capital_allowances"
      | "capital_allowances_balancing_charges"
      | "losses_brought_forward"
      | "group_relief"
      | "other";
    label: string;
    amount: number;
  }> = {},
) {
  return {
    id: "18ff8dd7-cc67-4dcb-ae6e-bad7157f31a5",
    teamId: "team-1",
    filingProfileId: "profile-1",
    periodKey: BASE_PERIOD.periodKey,
    category: overrides.category ?? "other",
    label: overrides.label ?? "Adjustment",
    amount: overrides.amount ?? 50,
    note: null,
    createdBy: null,
    createdAt: "2026-01-15T00:00:00.000Z",
    updatedAt: "2026-01-15T00:00:00.000Z",
  };
}

function buildBasicSnapshot(adjustments: ReturnType<typeof makeAdjustment>[] = [
  makeAdjustment(),
]) {
  return buildYearEndPackSnapshot({
    period: BASE_PERIOD,
    currency: "GBP",
    exportBundles: [],
    latestExportedAt: null,
    adjustments,
    entries: [
      {
        journalEntryId: "opening-re",
        entryDate: "2025-03-31",
        sourceType: "manual_adjustment",
        sourceId: "opening-re",
        currency: "GBP",
        lines: [
          { accountCode: "1000", debit: 500, credit: 0 },
          { accountCode: "3100", debit: 0, credit: 500 },
        ],
      },
      {
        journalEntryId: "sale",
        entryDate: "2025-04-10",
        sourceType: "transaction",
        sourceId: "sale",
        currency: "GBP",
        lines: [
          { accountCode: "1000", debit: 1200, credit: 0 },
          { accountCode: "4000", debit: 0, credit: 1000 },
          { accountCode: "2200", debit: 0, credit: 200 },
        ],
      },
      {
        journalEntryId: "expense",
        entryDate: "2025-04-12",
        sourceType: "transaction",
        sourceId: "expense",
        currency: "GBP",
        lines: [
          { accountCode: "5000", debit: 300, credit: 0 },
          { accountCode: "1200", debit: 60, credit: 0 },
          { accountCode: "1000", debit: 0, credit: 360 },
        ],
      },
    ],
  });
}

function buildReadySnapshot(
  adjustments: ReturnType<typeof makeAdjustment>[] = [],
) {
  return buildYearEndPackSnapshot({
    period: BASE_PERIOD,
    currency: "GBP",
    exportBundles: [],
    latestExportedAt: null,
    adjustments,
    entries: [
      {
        journalEntryId: "opening-balances",
        entryDate: "2025-03-31",
        sourceType: "manual_adjustment",
        sourceId: "opening-balances",
        currency: "GBP",
        lines: [
          { accountCode: "1000", debit: 1100, credit: 0 },
          { accountCode: "3000", debit: 0, credit: 100 },
          { accountCode: "3100", debit: 0, credit: 1000 },
        ],
      },
      {
        journalEntryId: "sale",
        entryDate: "2025-04-10",
        sourceType: "transaction",
        sourceId: "sale",
        currency: "GBP",
        lines: [
          { accountCode: "1000", debit: 1200, credit: 0 },
          { accountCode: "4000", debit: 0, credit: 1000 },
          { accountCode: "2200", debit: 0, credit: 200 },
        ],
      },
      {
        journalEntryId: "expense",
        entryDate: "2025-04-12",
        sourceType: "transaction",
        sourceId: "expense",
        currency: "GBP",
        lines: [
          { accountCode: "5000", debit: 300, credit: 0 },
          { accountCode: "1200", debit: 60, credit: 0 },
          { accountCode: "1000", debit: 0, credit: 360 },
        ],
      },
    ],
  });
}

function buildHistoricReadySnapshot(
  adjustments: ReturnType<typeof makeAdjustment>[] = [],
) {
  return buildYearEndPackSnapshot({
    period: HISTORIC_PERIOD,
    currency: "GBP",
    exportBundles: [],
    latestExportedAt: null,
    adjustments,
    entries: [
      {
        journalEntryId: "opening-balances",
        entryDate: "2024-03-31",
        sourceType: "manual_adjustment",
        sourceId: "opening-balances",
        currency: "GBP",
        lines: [
          { accountCode: "1000", debit: 1100, credit: 0 },
          { accountCode: "3000", debit: 0, credit: 100 },
          { accountCode: "3100", debit: 0, credit: 1000 },
        ],
      },
      {
        journalEntryId: "sale",
        entryDate: "2024-04-10",
        sourceType: "transaction",
        sourceId: "sale",
        currency: "GBP",
        lines: [
          { accountCode: "1000", debit: 1200, credit: 0 },
          { accountCode: "4000", debit: 0, credit: 1000 },
          { accountCode: "2200", debit: 0, credit: 200 },
        ],
      },
      {
        journalEntryId: "expense",
        entryDate: "2024-04-12",
        sourceType: "transaction",
        sourceId: "expense",
        currency: "GBP",
        lines: [
          { accountCode: "5000", debit: 300, credit: 0 },
          { accountCode: "1200", debit: 60, credit: 0 },
          { accountCode: "1000", debit: 0, credit: 360 },
        ],
      },
    ],
  });
}

function buildSnapshotForProfit(args: {
  period: typeof BASE_PERIOD | typeof HISTORIC_PERIOD | typeof STRADDLE_PERIOD;
  accountingProfitBeforeTax: number;
}) {
  return buildYearEndPackSnapshot({
    period: args.period,
    currency: "GBP",
    exportBundles: [],
    latestExportedAt: null,
    adjustments: [],
    entries: [
      {
        journalEntryId: "opening-balances",
        entryDate: addDay(args.period.periodStart, -1),
        sourceType: "manual_adjustment",
        sourceId: "opening-balances",
        currency: "GBP",
        lines: [
          { accountCode: "1000", debit: 1100, credit: 0 },
          { accountCode: "3000", debit: 0, credit: 100 },
          { accountCode: "3100", debit: 0, credit: 1000 },
        ],
      },
      {
        journalEntryId: "sale",
        entryDate: args.period.periodStart,
        sourceType: "transaction",
        sourceId: "sale",
        currency: "GBP",
        lines: [
          { accountCode: "1000", debit: args.accountingProfitBeforeTax, credit: 0 },
          { accountCode: "4000", debit: 0, credit: args.accountingProfitBeforeTax },
        ],
      },
    ],
  });
}

function makePack(
  snapshot: ReturnType<typeof buildYearEndPackSnapshot>,
  overrides: Partial<{
    status: "draft" | "ready" | "exported";
    period:
      | typeof BASE_PERIOD
      | typeof HISTORIC_PERIOD
      | typeof STRADDLE_PERIOD;
  }> = {},
) {
  const period = overrides.period ?? BASE_PERIOD;
  return {
    id: "pack-1",
    teamId: "team-1",
    filingProfileId: "profile-1",
    periodKey: period.periodKey,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    accountsDueDate: period.accountsDueDate,
    corporationTaxDueDate: period.corporationTaxDueDate,
    status: overrides.status ?? snapshot.status,
    currency: snapshot.currency,
    trialBalance: snapshot.trialBalance,
    profitAndLoss: snapshot.profitAndLoss,
    balanceSheet: snapshot.balanceSheet,
    retainedEarnings: snapshot.retainedEarnings,
    workingPapers: snapshot.workingPapers,
    corporationTax: snapshot.corporationTax,
    manualJournalCount: 0,
    payrollRunCount: 0,
    exportBundles: [],
    latestExportedAt: null,
    snapshotChecksum: snapshot.snapshotChecksum,
    createdAt: "2026-01-15T00:00:00.000Z",
    updatedAt: "2026-01-15T00:00:00.000Z",
  };
}

function makeCloseCompanyLoansSchedule(
  overrides: Partial<{
    periodKey: string;
    beforeEndPeriod: boolean;
    loansMade: Array<{
      name: string;
      amountOfLoan: number;
    }>;
    taxChargeable: number | null;
    reliefEarlierThan: Array<{
      name: string;
      amountRepaid: number | null;
      amountReleasedOrWrittenOff: number | null;
      date: string;
    }>;
    reliefEarlierDue: number | null;
    loanLaterReliefNow: Array<{
      name: string;
      amountRepaid: number | null;
      amountReleasedOrWrittenOff: number | null;
      date: string;
    }>;
    reliefLaterDue: number | null;
    totalLoansOutstanding: number | null;
  }> = {},
) {
  return {
    id: "schedule-1",
    teamId: "team-1",
    filingProfileId: "profile-1",
    periodKey: overrides.periodKey ?? BASE_PERIOD.periodKey,
    beforeEndPeriod: overrides.beforeEndPeriod ?? true,
    loansMade:
      overrides.loansMade ?? [{ name: "Participator Ltd", amountOfLoan: 1000 }],
    taxChargeable:
      "taxChargeable" in overrides ? (overrides.taxChargeable ?? null) : 337.5,
    reliefEarlierThan:
      overrides.reliefEarlierThan ??
      [
        {
          name: "Participator Ltd",
          amountRepaid: 200,
          amountReleasedOrWrittenOff: null,
          date: "2025-12-30",
        },
      ],
    reliefEarlierDue:
      "reliefEarlierDue" in overrides
        ? (overrides.reliefEarlierDue ?? null)
        : 67.5,
    loanLaterReliefNow:
      overrides.loanLaterReliefNow ??
      [
        {
          name: "Participator Ltd",
          amountRepaid: null,
          amountReleasedOrWrittenOff: 100,
          date: "2026-01-15",
        },
      ],
    reliefLaterDue:
      "reliefLaterDue" in overrides
        ? (overrides.reliefLaterDue ?? null)
        : 33.75,
    totalLoansOutstanding:
      "totalLoansOutstanding" in overrides
        ? (overrides.totalLoansOutstanding ?? null)
        : 700,
    createdBy: null,
    createdAt: "2026-01-15T00:00:00.000Z",
    updatedAt: "2026-01-15T00:00:00.000Z",
  };
}

function makeCorporationTaxRateSchedule(
  overrides: Partial<{
    periodKey: string;
    exemptDistributions: number | null;
    associatedCompaniesThisPeriod: number | null;
    associatedCompaniesFirstYear: number | null;
    associatedCompaniesSecondYear: number | null;
  }> = {},
) {
  return {
    id: "ct-rate-schedule-1",
    teamId: "team-1",
    filingProfileId: "profile-1",
    periodKey: overrides.periodKey ?? BASE_PERIOD.periodKey,
    exemptDistributions:
      "exemptDistributions" in overrides
        ? (overrides.exemptDistributions ?? null)
        : null,
    associatedCompaniesThisPeriod:
      "associatedCompaniesThisPeriod" in overrides
        ? (overrides.associatedCompaniesThisPeriod ?? null)
        : 0,
    associatedCompaniesFirstYear:
      "associatedCompaniesFirstYear" in overrides
        ? (overrides.associatedCompaniesFirstYear ?? null)
        : null,
    associatedCompaniesSecondYear:
      "associatedCompaniesSecondYear" in overrides
        ? (overrides.associatedCompaniesSecondYear ?? null)
        : null,
    createdBy: null,
    createdAt: "2026-01-15T00:00:00.000Z",
    updatedAt: "2026-01-15T00:00:00.000Z",
  };
}

function addDay(value: string, days: number) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

describe("year-end helpers", () => {
  test("resolves the current annual period from year-end settings", () => {
    const period = resolveAnnualPeriod(
      {
        yearEndMonth: 3,
        yearEndDay: 31,
      },
      {
        referenceDate: new Date("2026-03-19T12:00:00.000Z"),
      },
    );

    expect(period.periodKey).toBe("2026-03-31");
    expect(period.periodStart).toBe("2025-04-01");
    expect(period.periodEnd).toBe("2026-03-31");
    expect(period.accountsDueDate).toBe("2026-12-31");
    expect(period.corporationTaxDueDate).toBe("2027-01-01");
  });

  test("resolves the annual period consistently in western time zones", () => {
    const script = `
      import { resolveAnnualPeriod } from ${JSON.stringify(new URL("./index.ts", import.meta.url).href)};
      const period = resolveAnnualPeriod(
        { yearEndMonth: 3, yearEndDay: 31 },
        { referenceDate: new Date("2026-03-19T12:00:00.000Z") },
      );
      process.stdout.write(JSON.stringify(period));
    `;
    const result = spawnSync(process.execPath, ["-e", script], {
      env: {
        ...process.env,
        TZ: "America/Los_Angeles",
      },
      encoding: "utf8",
    });

    if (result.status !== 0) {
      throw new Error(result.stderr || "Failed to resolve annual period in subprocess");
    }

    expect(JSON.parse(result.stdout)).toEqual(BASE_PERIOD);
  });

  test("keeps explicit period keys stable in DST-observing European time zones", () => {
    const script = `
      import { resolveAnnualPeriod } from ${JSON.stringify(new URL("./index.ts", import.meta.url).href)};
      const period = resolveAnnualPeriod(
        { yearEndMonth: 3, yearEndDay: 31 },
        { periodKey: "2026-03-31" },
      );
      process.stdout.write(JSON.stringify(period));
    `;
    const result = spawnSync(process.execPath, ["-e", script], {
      env: {
        ...process.env,
        TZ: "Europe/London",
      },
      encoding: "utf8",
    });

    if (result.status !== 0) {
      throw new Error(result.stderr || "Failed to resolve explicit period key in subprocess");
    }

    expect(JSON.parse(result.stdout)).toEqual(BASE_PERIOD);
  });

  test("builds a deterministic year-end snapshot with CT adjustments", () => {
    const snapshot = buildBasicSnapshot([
      makeAdjustment({
        category: "depreciation_amortisation",
        label: "Depreciation add-back",
        amount: 50,
      }),
    ]);

    expect(snapshot.status).toBe("ready");
    expect(
      snapshot.trialBalance.find((line) => line.accountCode === "4000")?.credit,
    ).toBe(1000);
    expect(snapshot.retainedEarnings.openingBalance).toBe(500);
    expect(snapshot.retainedEarnings.currentPeriodProfit).toBe(700);
    expect(snapshot.retainedEarnings.closingBalance).toBe(1200);
    expect(snapshot.corporationTax.taxableProfit).toBe(750);
    expect(snapshot.corporationTax.estimatedCorporationTaxDue).toBe(142.5);
  });

  test("builds a statutory accounts draft and flags missing filing facts", () => {
    const snapshot = buildBasicSnapshot([
      makeAdjustment({
        category: "depreciation_amortisation",
        label: "Depreciation add-back",
        amount: 50,
      }),
    ]);

    const draft = buildStatutoryAccountsDraft({
      team: makeTeam(),
      profile: makeProfile(),
      pack: makePack(snapshot),
      generatedAt: "2026-03-22T10:00:00.000Z",
    });

    expect(draft.companyName).toBe("Tamias Ltd");
    expect(draft.statementOfFinancialPosition.assets).toBe(1400);
    expect(draft.statementOfFinancialPosition.liabilities).toBe(200);
    expect(draft.statementOfFinancialPosition.netAssets).toBe(1200);
    expect(draft.statementOfFinancialPosition.totalEquity).toBe(1200);
    expect(draft.filingReadiness.isReady).toBe(false);
    expect(draft.filingReadiness.blockers).toContain(
      "Add the principal activity for the directors' report.",
    );
    expect(draft.reviewItems).toContain(
      "The standalone draft HTML is for review only. Use the generated iXBRL attachment for CT submission workflows.",
    );
  });

  test("builds a CT600 draft from structured computation categories", () => {
    const snapshot = buildBasicSnapshot([
      makeAdjustment({
        category: "depreciation_amortisation",
        label: "Depreciation add-back",
        amount: 50,
      }),
    ]);

    const draft = buildCt600Draft({
      team: makeTeam(),
      profile: makeProfile({ provider: "hmrc-ct" }),
      pack: makePack(snapshot),
      generatedAt: "2026-03-22T10:00:00.000Z",
    });

    expect(draft.companyName).toBe("Tamias Ltd");
    expect(draft.utr).toBe("2288403582");
    expect(draft.turnover).toBe(1000);
    expect(draft.chargeableProfits).toBe(750);
    expect(draft.corporationTax).toBe(142.5);
    expect(draft.computationBreakdown.depreciationAmortisationAdjustments).toBe(
      50,
    );
    expect(draft.filingReadiness.isReady).toBe(false);
    expect(draft.filingReadiness.blockers).toContain(
      "Save the CT rate inputs to confirm associated companies and exempt distributions for the period.",
    );
  });

  test("includes CT600A and rolls close-company loans tax into CT600 totals", () => {
    const snapshot = buildHistoricReadySnapshot();
    const schedule = makeCloseCompanyLoansSchedule({
      periodKey: HISTORIC_PERIOD.periodKey,
    });

    const draft = buildCt600Draft({
      team: makeTeam(),
      profile: makeReadyProfile({ provider: "hmrc-ct" }),
      pack: makePack(snapshot, {
        period: HISTORIC_PERIOD,
        status: "ready",
      }),
      closeCompanyLoansSchedule: schedule,
      corporationTaxRateSchedule: makeCorporationTaxRateSchedule({
        periodKey: HISTORIC_PERIOD.periodKey,
      }),
      generatedAt: "2026-03-22T10:00:00.000Z",
    });

    expect(draft.supplementaryPages.ct600a).not.toBeNull();
    expect(draft.loansToParticipatorsTax).toBe(236.25);
    expect(draft.taxChargeable).toBe(369.25);
    expect(draft.taxPayable).toBe(369.25);
    expect(draft.ct600AReliefDue).toBe(true);
    expect(draft.filingReadiness.isReady).toBe(true);

    const xml = renderCt600DraftXml(draft);

    expect(xml).toContain(
      "<SupplementaryPages><CT600A>yes</CT600A></SupplementaryPages>",
    );
    expect(xml).toContain("<LoansByCloseCompanies>");
    expect(xml).toContain("<LoansToParticipators>236.25</LoansToParticipators>");
    expect(xml).toContain("<CT600AreliefDue>yes</CT600AreliefDue>");
    expect(xml).toContain("<BeforeEndPeriod>yes</BeforeEndPeriod>");
    expect(xml).toContain("<TotalLoansOutstanding>700.00</TotalLoansOutstanding>");
  });

  test("blocks the filing-ready path when CT600A Part 1 is incomplete", () => {
    const snapshot = buildHistoricReadySnapshot();
    const draft = buildCt600Draft({
      team: makeTeam(),
      profile: makeReadyProfile({ provider: "hmrc-ct" }),
      pack: makePack(snapshot, {
        period: HISTORIC_PERIOD,
        status: "ready",
      }),
      closeCompanyLoansSchedule: makeCloseCompanyLoansSchedule({
        periodKey: HISTORIC_PERIOD.periodKey,
        taxChargeable: null,
        reliefEarlierThan: [],
        reliefEarlierDue: null,
        loanLaterReliefNow: [],
        reliefLaterDue: null,
        totalLoansOutstanding: null,
      }),
      corporationTaxRateSchedule: makeCorporationTaxRateSchedule({
        periodKey: HISTORIC_PERIOD.periodKey,
      }),
      generatedAt: "2026-03-22T10:00:00.000Z",
    });

    expect(draft.filingReadiness.isReady).toBe(false);
    expect(draft.filingReadiness.blockers).toContain(
      "CT600A Part 1 needs a tax chargeable amount greater than zero when outstanding close-company loans are entered.",
    );
  });

  test("marks the supported path ready and renders richer filing attachments", () => {
    const snapshot = buildReadySnapshot([
      makeAdjustment({
        category: "depreciation_amortisation",
        label: "Depreciation add-back",
        amount: 50,
      }),
      makeAdjustment({
        category: "capital_allowances",
        label: "Capital allowances",
        amount: -20,
      }),
      makeAdjustment({
        category: "charitable_donations",
        label: "Qualifying donation",
        amount: -10,
      }),
      makeAdjustment({
        category: "losses_brought_forward",
        label: "Losses brought forward",
        amount: -30,
      }),
      makeAdjustment({
        category: "group_relief",
        label: "Group relief",
        amount: -40,
      }),
      makeAdjustment({
        category: "capital_allowances_balancing_charges",
        label: "Balancing charge",
        amount: 5,
      }),
    ]);

    const statutoryDraft = buildStatutoryAccountsDraft({
      team: makeTeam(),
      profile: makeReadyProfile(),
      pack: makePack(snapshot),
      corporationTaxRateSchedule: makeCorporationTaxRateSchedule(),
      generatedAt: "2026-03-22T10:00:00.000Z",
    });
    const ct600Draft = buildCt600Draft({
      team: makeTeam(),
      profile: makeReadyProfile({ provider: "hmrc-ct" }),
      pack: makePack(snapshot),
      corporationTaxRateSchedule: makeCorporationTaxRateSchedule(),
      generatedAt: "2026-03-22T10:00:00.000Z",
    });

    expect(statutoryDraft.filingReadiness.isReady).toBe(true);
    expect(ct600Draft.filingReadiness.isReady).toBe(true);
    expect(ct600Draft.computationBreakdown.totalProfitsChargeableToCorporationTax).toBe(
      655,
    );
    expect(ct600Draft.corporationTax).toBe(124.45);

    const accountsAttachment = renderAccountsAttachmentIxbrl(statutoryDraft);
    const computationsAttachment = renderComputationsAttachmentIxbrl(ct600Draft);

    expect(accountsAttachment).toContain("Filing-ready accounts attachment.");
    expect(accountsAttachment).toContain(
      "direp:StatementThatAccountsHaveBeenPreparedInAccordanceWithProvisionsSmallCompaniesRegime",
    );
    expect(accountsAttachment).toContain("bus:NameEntityOfficer");
    expect(accountsAttachment).toContain(
      "core:AverageNumberEmployeesDuringPeriod",
    );
    expect(accountsAttachment).toContain(
      "core:NominalValueAllottedShareCapital",
    );
    expect(accountsAttachment).toContain(
      "core:DescriptionBodyAuthorisingFinancialStatements",
    );
    expect(accountsAttachment).toContain(
      "core:DirectorSigningFinancialStatements",
    );
    expect(accountsAttachment).toContain("bus:AccountingStandardsApplied");
    expect(accountsAttachment).toContain(
      "bus:AccountsStatusAuditedOrUnaudited",
    );
    expect(accountsAttachment).toContain("bus:AccountsType");
    expect(accountsAttachment).toContain("bus:EntityTradingStatus");
    expect(computationsAttachment).toContain(
      "Filing-ready computation attachment.",
    );
    expect(computationsAttachment).toContain("ct-comp:ProfitLossPerAccounts");
    expect(computationsAttachment).toContain(
      "ct-comp:AdjustmentsDepreciation",
    );
    expect(computationsAttachment).toContain(
      "ct-comp:QualifyingUKDonations",
    );
    expect(computationsAttachment).toContain(
      "ct-comp:TradingLossesBroughtForwardValueClaimedAgainstTradingProfits",
    );
    expect(computationsAttachment).toContain('context id="ct-context-trade-detail"');
    expect(computationsAttachment).toContain(
      'dimension="ct-comp:BusinessNameDimension"',
    );
    expect(computationsAttachment).toContain(">ct-comp:Trade<");
    expect(computationsAttachment).toContain(">ct-comp:Post-lossReform<");
    expect(computationsAttachment).toContain(
      'name="ct-comp:ProfitLossPerAccounts" unitRef="unit" contextRef="ct-context-trade-detail"',
    );
    expect(computationsAttachment).toContain(
      'name="ct-comp:NetTradingProfits" unitRef="unit" contextRef="ct-context-summary"',
    );
  });

  test("renders CT600 XML with computed IRmark and encoded attachments", () => {
    const snapshot = buildReadySnapshot();
    const statutoryDraft = buildStatutoryAccountsDraft({
      team: makeTeam(),
      profile: makeReadyProfile(),
      pack: makePack(snapshot),
      corporationTaxRateSchedule: makeCorporationTaxRateSchedule(),
      generatedAt: "2026-03-22T10:00:00.000Z",
    });
    const ct600Draft = buildCt600Draft({
      team: makeTeam(),
      profile: makeReadyProfile({ provider: "hmrc-ct" }),
      pack: makePack(snapshot),
      corporationTaxRateSchedule: makeCorporationTaxRateSchedule(),
      generatedAt: "2026-03-22T10:00:00.000Z",
    });

    const accountsAttachment = renderAccountsAttachmentIxbrl(statutoryDraft);
    const computationsAttachment = renderComputationsAttachmentIxbrl(ct600Draft);
    const xml = renderCt600DraftXml(ct600Draft, {
      accountsAttachmentXhtml: accountsAttachment,
      computationsAttachmentXhtml: computationsAttachment,
    });
    const encodedAccounts = Buffer.from(
      accountsAttachment.replace(/^\s*<\?xml[^>]*\?>\s*/i, ""),
      "utf8",
    ).toString("base64");

    expect(xml).toContain('<IRmark Type="generic">');
    expect(xml).toContain("<ThisPeriodAccounts>yes</ThisPeriodAccounts>");
    expect(xml).toContain(
      "<ThisPeriodComputations>yes</ThisPeriodComputations>",
    );
    expect(xml).toContain(encodedAccounts);
    expect(xml).toContain("supported filing-ready path");
  });

  test("uses the SDS test-service UTR override for CT XML in test mode", () => {
    const previousEnvironment = process.env.HMRC_CT_ENVIRONMENT;
    const previousTestUtr = process.env.HMRC_CT_TEST_UTR;

    process.env.HMRC_CT_ENVIRONMENT = "test";
    process.env.HMRC_CT_TEST_UTR = "8596148860";

    try {
      const draft = buildCt600Draft({
        team: makeTeam(),
        profile: makeReadyProfile({ provider: "hmrc-ct" }),
        pack: makePack(buildReadySnapshot(), { status: "ready" }),
        corporationTaxRateSchedule: makeCorporationTaxRateSchedule(),
        generatedAt: "2026-03-22T10:00:00.000Z",
      });

      const xml = renderCt600DraftXml(draft);

      expect(xml).toContain('<Key Type="UTR">8596148860</Key>');
      expect(xml).toContain("<Reference>8596148860</Reference>");
    } finally {
      if (previousEnvironment === undefined) {
        delete process.env.HMRC_CT_ENVIRONMENT;
      } else {
        process.env.HMRC_CT_ENVIRONMENT = previousEnvironment;
      }

      if (previousTestUtr === undefined) {
        delete process.env.HMRC_CT_TEST_UTR;
      } else {
        process.env.HMRC_CT_TEST_UTR = previousTestUtr;
      }
    }
  });

  test("uses the filing-profile UTR and live gateway flag in production mode", () => {
    const previousEnvironment = process.env.HMRC_CT_ENVIRONMENT;
    const previousTestUtr = process.env.HMRC_CT_TEST_UTR;

    process.env.HMRC_CT_ENVIRONMENT = "production";
    process.env.HMRC_CT_TEST_UTR = "8596148860";

    try {
      const draft = buildCt600Draft({
        team: makeTeam(),
        profile: makeReadyProfile({
          provider: "hmrc-ct",
          utr: "1234567890",
        }),
        pack: makePack(buildReadySnapshot(), { status: "ready" }),
        corporationTaxRateSchedule: makeCorporationTaxRateSchedule(),
        generatedAt: "2026-03-22T10:00:00.000Z",
      });

      const xml = renderCt600DraftXml(draft);

      expect(xml).toContain("<GatewayTest>0</GatewayTest>");
      expect(xml).toContain('<Key Type="UTR">1234567890</Key>');
      expect(xml).toContain("<Reference>1234567890</Reference>");
      expect(xml).not.toContain("8596148860");
    } finally {
      if (previousEnvironment === undefined) {
        delete process.env.HMRC_CT_ENVIRONMENT;
      } else {
        process.env.HMRC_CT_ENVIRONMENT = previousEnvironment;
      }

      if (previousTestUtr === undefined) {
        delete process.env.HMRC_CT_TEST_UTR;
      } else {
        process.env.HMRC_CT_TEST_UTR = previousTestUtr;
      }
    }
  });

  test("formats Companies House submission numbers as zero-padded six-digit values", () => {
    expect(formatCompaniesHouseSubmissionNumber(1)).toBe("000001");
    expect(formatCompaniesHouseSubmissionNumber(12)).toBe("000012");
    expect(formatCompaniesHouseSubmissionNumber(123456)).toBe("123456");
  });

  test("rejects Companies House submission numbers outside the gateway range", () => {
    expect(() => formatCompaniesHouseSubmissionNumber(0)).toThrow(
      "Companies House submission number must be between 1 and 999999",
    );
    expect(() => formatCompaniesHouseSubmissionNumber(1_000_000)).toThrow(
      "Companies House submission number must be between 1 and 999999",
    );
  });

  test("applies marginal relief when profits fall between the thresholds", () => {
    const snapshot = buildSnapshotForProfit({
      period: BASE_PERIOD,
      accountingProfitBeforeTax: 100_000,
    });
    const draft = buildCt600Draft({
      team: makeTeam(),
      profile: makeReadyProfile({ provider: "hmrc-ct" }),
      pack: makePack(snapshot),
      corporationTaxRateSchedule: makeCorporationTaxRateSchedule(),
      generatedAt: "2026-03-22T10:00:00.000Z",
    });

    expect(draft.corporationTax).toBe(25000);
    expect(draft.marginalRelief).toBe(2250);
    expect(draft.netCorporationTaxChargeable).toBe(22750);
    expect(draft.startingOrSmallCompaniesRate).toBe(true);
    expect(draft.financialYearBreakdown).toHaveLength(1);
    expect(draft.financialYearBreakdown[0]?.chargeType).toBe("marginal_relief");

    const xml = renderCt600DraftXml(draft);

    expect(xml).toContain(
      "<MarginalReliefForRingFenceTrades>2250.00</MarginalReliefForRingFenceTrades>",
    );
    expect(xml).toContain(
      "<StartingOrSmallCompaniesRate>yes</StartingOrSmallCompaniesRate>",
    );
  });

  test("splits CT across financial years for an accounting period straddling 1 April 2023", () => {
    const snapshot = buildSnapshotForProfit({
      period: STRADDLE_PERIOD,
      accountingProfitBeforeTax: 175_000,
    });
    const draft = buildCt600Draft({
      team: makeTeam(),
      profile: makeReadyProfile({
        provider: "hmrc-ct",
        approvalDate: "2024-02-20",
      }),
      pack: makePack(snapshot, {
        period: STRADDLE_PERIOD,
        status: "ready",
      }),
      corporationTaxRateSchedule: makeCorporationTaxRateSchedule({
        periodKey: STRADDLE_PERIOD.periodKey,
        associatedCompaniesThisPeriod: 2,
      }),
      generatedAt: "2026-03-22T10:00:00.000Z",
    });

    expect(draft.financialYearBreakdown).toHaveLength(2);
    expect(draft.financialYearBreakdown[0]?.taxRate).toBe(19);
    expect(draft.financialYearBreakdown[1]?.taxRate).toBe(25);
    expect(draft.corporationTax).toBe(41160.96);
    expect(draft.netCorporationTaxChargeable).toBe(41160.96);

    const xml = renderCt600DraftXml(draft);

    expect(xml).toContain("<FinancialYearTwo>");
    expect(xml).toContain("<ThisPeriod>2</ThisPeriod>");
  });
});
