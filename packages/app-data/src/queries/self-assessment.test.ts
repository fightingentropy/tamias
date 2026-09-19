import { Database as SQLite, type SQLQueryBindings } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createDatabase,
  type CloudflareD1DatabaseBinding,
  type CloudflareD1PreparedStatementBinding,
} from "../client";
import {
  getSelfAssessmentReport,
  reviewSelfAssessmentTransactions,
  saveSelfAssessmentProfile,
} from "./self-assessment";
import {
  HmrcSelfAssessmentProvider,
  SelfAssessmentProfileSchema,
  GOVTALK_NAMESPACE,
  assertExternalMutationEnvironment,
  type SelfAssessmentIdentity,
} from "@tamias/compliance";
import {
  listSelfAssessmentFilings,
  prepareSelfAssessment,
  submitSelfAssessment,
  pollSelfAssessment,
  selfAssessmentEvidence,
  selfAssessmentConnection,
} from "./self-assessment-filings";

class Statement implements CloudflareD1PreparedStatementBinding {
  constructor(
    readonly sqlite: SQLite,
    readonly sql: string,
    readonly values: SQLQueryBindings[] = [],
  ) {}
  bind(...values: unknown[]) {
    return new Statement(this.sqlite, this.sql, values as SQLQueryBindings[]);
  }
  async first<T>(column?: string) {
    const row = this.sqlite.query(this.sql).get(...this.values) as Record<string, unknown> | null;
    return (column ? (row?.[column] ?? null) : row) as T | null;
  }
  async all<T>() {
    return { success: true, results: this.sqlite.query(this.sql).all(...this.values) as T[] };
  }
  async run<T>() {
    return this.all<T>();
  }
  async raw<T>() {
    return this.sqlite.query(this.sql).values(...this.values) as T[];
  }
}
function setup() {
  const sqlite = new SQLite(":memory:");
  for (const file of [
    "0020_identity_core.sql",
    "0047_transactions.sql",
    "0050_self_assessment.sql",
    "0054_self_assessment_cis.sql",
  ])
    sqlite.exec(
      readFileSync(resolve(import.meta.dir, `../../../../api/migrations/d1/${file}`), "utf8"),
    );
  const d1: CloudflareD1DatabaseBinding = {
    prepare: (sql) => new Statement(sqlite, sql),
    async batch<T>(statements: CloudflareD1PreparedStatementBinding[]) {
      sqlite.exec("BEGIN");
      try {
        const values = [];
        for (const statement of statements) values.push(await statement.all<T>());
        sqlite.exec("COMMIT");
        return values;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
    async exec(query) {
      sqlite.exec(query);
      return { count: 0, duration: 0 };
    },
  };
  function insert(id: string, team = "a", date = "2025-07-01", amount = -100) {
    sqlite
      .query(
        `insert into transactions (id,team_id,created_at,updated_at,date,name,method,amount,currency,internal_id,status,manual)
      values (?,?, '2025-01-01', '2025-01-01', ?, ?, 'card_purchase', ?, 'GBP', ?, 'posted', 0)`,
      )
      .run(id, team, date, id, amount, id);
  }
  return { db: createDatabase({ cloudflare: { d1 } }), sqlite, insert };
}
describe("Self Assessment D1", () => {
  test("persists CIS evidence, allocates a cross-year credit and preserves it for older clients", async () => {
    const { db, sqlite, insert } = setup();
    try {
      insert("cis", "a", "2025-04-08", 800);
      sqlite
        .query("update transactions set category_slug = 'cis-net-payments' where id = 'cis'")
        .run();
      const context = { teamId: "a", taxYear: 2025, userId: "owner" };
      const original = (await getSelfAssessmentReport(db, context)).transactions[0]!;
      const review = {
        transactionId: original.id,
        sourceVersion: original.sourceVersion,
        category: "turnover" as const,
        businessPercent: 100,
        note: "Statement checked",
      };
      await expect(
        reviewSelfAssessmentTransactions(db, { ...context, reviews: [review] }),
      ).rejects.toThrow("incompatible CIS");
      const cis = {
        grossPence: 100000,
        deductionPence: 20000,
        incomeTaxYear: 2025,
        deductionTaxYear: 2024,
        taxYearsUnderReview: [],
        reference: "Verified source years",
      };
      const saved = await reviewSelfAssessmentTransactions(db, {
        ...context,
        reviews: [{ ...review, cis }],
      });
      expect(saved).toMatchObject({ incomePence: 100000, cisDeductionsPence: 0 });
      const earlier = await getSelfAssessmentReport(db, { teamId: "a", taxYear: 2024 });
      expect(earlier).toMatchObject({ incomePence: 0, cisDeductionsPence: 20000 });
      expect(earlier.transactions[0]?.bankTaxYear).toBe(2025);
      const legacy = await reviewSelfAssessmentTransactions(db, {
        ...context,
        reviews: [{ ...review, note: "Updated using an older client" }],
      });
      expect(legacy.transactions[0]?.cis).toEqual(cis);
      expect(legacy.fingerprint).not.toBe(saved.fingerprint);
      expect(
        (await getSelfAssessmentReport(db, { teamId: "b", taxYear: 2024 })).transactions,
      ).toEqual([]);
      await expect(
        reviewSelfAssessmentTransactions(db, {
          ...context,
          reviews: [{ ...review, category: "excluded" }],
        }),
      ).rejects.toThrow("nothing was changed");
      const cleared = await reviewSelfAssessmentTransactions(db, {
        ...context,
        reviews: [{ ...review, category: "excluded", businessPercent: 0, cis: null }],
      });
      expect(cleared.transactions[0]?.cis).toBeNull();
      expect(
        (await getSelfAssessmentReport(db, { teamId: "a", taxYear: 2024 })).cisDeductionsPence,
      ).toBe(0);
    } finally {
      sqlite.close();
    }
  });
  test("unresolved CIS appears in both years and changes to bank data invalidate both", async () => {
    const { db, sqlite, insert } = setup();
    try {
      insert("boundary", "a", "2025-04-09", 560);
      const context = { teamId: "a", taxYear: 2025, userId: "owner" };
      const t = (await getSelfAssessmentReport(db, context)).transactions[0]!;
      const review = {
        transactionId: t.id,
        sourceVersion: t.sourceVersion,
        category: "turnover" as const,
        businessPercent: 100,
        note: "Awaiting contractor",
        cis: {
          grossPence: 70000,
          deductionPence: 14000,
          incomeTaxYear: null,
          deductionTaxYear: null,
          taxYearsUnderReview: [2024, 2025],
          reference: "Conflicting statements",
        },
      };
      await reviewSelfAssessmentTransactions(db, { ...context, reviews: [review] });
      for (const taxYear of [2024, 2025])
        expect(await getSelfAssessmentReport(db, { ...context, taxYear })).toMatchObject({
          incomePence: 0,
          cisDeductionsPence: 0,
          cisPendingCount: 1,
          cisPendingGrossPence: 70000,
          cisPendingDeductionsPence: 14000,
        });
      sqlite.query("update transactions set amount = 600 where id = 'boundary'").run();
      for (const taxYear of [2024, 2025])
        expect(await getSelfAssessmentReport(db, { ...context, taxYear })).toMatchObject({
          needsReview: 1,
          incomePence: 0,
          cisDeductionsPence: 0,
        });
      const fresh = (await getSelfAssessmentReport(db, context)).transactions[0]!;
      await expect(
        reviewSelfAssessmentTransactions(db, {
          ...context,
          reviews: [{ ...review, sourceVersion: fresh.sourceVersion }],
        }),
      ).rejects.toThrow("nothing was changed");
    } finally {
      sqlite.close();
    }
  });
  test("a corrected bank date cannot resurrect an obsolete CIS credit", async () => {
    const { db, sqlite, insert } = setup();
    try {
      insert("moved", "a", "2025-04-09", 800);
      const context = { teamId: "a", taxYear: 2025, userId: "owner" };
      const old = (await getSelfAssessmentReport(db, context)).transactions[0]!;
      await reviewSelfAssessmentTransactions(db, {
        ...context,
        reviews: [
          {
            transactionId: old.id,
            sourceVersion: old.sourceVersion,
            category: "turnover",
            businessPercent: 100,
            note: "",
            cis: {
              grossPence: 100000,
              deductionPence: 20000,
              incomeTaxYear: 2025,
              deductionTaxYear: 2024,
              taxYearsUnderReview: [],
              reference: "Previous statement",
            },
          },
        ],
      });
      sqlite.query("update transactions set date = '2026-04-09' where id = 'moved'").run();
      const current = (await getSelfAssessmentReport(db, { ...context, taxYear: 2026 }))
        .transactions[0]!;
      expect(current.cis?.deductionPence).toBe(20000);
      expect(current.needsReview).toBe(true);
      await reviewSelfAssessmentTransactions(db, {
        ...context,
        taxYear: 2026,
        reviews: [
          {
            transactionId: current.id,
            sourceVersion: current.sourceVersion,
            category: "excluded",
            businessPercent: 0,
            note: "Corrected source is personal",
            cis: null,
          },
        ],
      });
      for (const taxYear of [2024, 2025]) {
        const result = await getSelfAssessmentReport(db, { ...context, taxYear });
        expect(result.transactions).toHaveLength(0);
        expect(result.cisDeductionsPence).toBe(0);
      }
    } finally {
      sqlite.close();
    }
  });
  test("rejects an entire CIS batch for a mismatching amount, currency or business share", async () => {
    const { db, sqlite, insert } = setup();
    try {
      insert("one", "a", "2025-07-01", 800);
      insert("two", "a", "2025-07-02", 801);
      const context = { teamId: "a", taxYear: 2025, userId: "owner" };
      const report = await getSelfAssessmentReport(db, context);
      const reviews = report.transactions.map((t) => ({
        transactionId: t.id,
        sourceVersion: t.sourceVersion,
        category: "turnover" as const,
        businessPercent: 100,
        note: "",
        cis: {
          grossPence: 100000,
          deductionPence: 20000,
          incomeTaxYear: 2025,
          deductionTaxYear: 2025,
          taxYearsUnderReview: [],
          reference: "Statement",
        },
      }));
      await expect(reviewSelfAssessmentTransactions(db, { ...context, reviews })).rejects.toThrow(
        "nothing was changed",
      );
      expect(sqlite.query("select count(*) as n from self_assessment_reviews").get()).toEqual({
        n: 0,
      });
      await expect(
        reviewSelfAssessmentTransactions(db, {
          ...context,
          reviews: [{ ...reviews[0]!, businessPercent: 50 }],
        }),
      ).rejects.toThrow("nothing was changed");
      sqlite
        .query(
          "update transactions set currency = 'EUR', base_currency = 'GBP', base_amount = 800 where id = 'one'",
        )
        .run();
      const foreign = (await getSelfAssessmentReport(db, context)).transactions[0]!;
      await expect(
        reviewSelfAssessmentTransactions(db, {
          ...context,
          reviews: [{ ...reviews[0]!, sourceVersion: foreign.sourceVersion }],
        }),
      ).rejects.toThrow("nothing was changed");
    } finally {
      sqlite.close();
    }
  });
  test("reads the complete year beyond normal page size, scoped to team and dates", async () => {
    const { db, sqlite, insert } = setup();
    try {
      for (let i = 0; i < 350; i++) insert(`a-${i}`);
      insert("private", "b");
      insert("prior", "a", "2025-04-05");
      insert("next", "a", "2026-04-06");
      const report = await getSelfAssessmentReport(db, { teamId: "a", taxYear: 2025 });
      expect(report.transactions).toHaveLength(350);
      expect(report.needsReview).toBe(350);
      expect(report.expensesPence).toBe(0);
      expect((await getSelfAssessmentReport(db, { teamId: "a", taxYear: 2025 })).fingerprint).toBe(
        report.fingerprint,
      );
    } finally {
      sqlite.close();
    }
  });
  test("bulk saves atomically and refuses stale, foreign-team or duplicate selections", async () => {
    const { db, sqlite, insert } = setup();
    try {
      insert("one");
      insert("two");
      insert("foreign", "b");
      let report = await getSelfAssessmentReport(db, { teamId: "a", taxYear: 2025 });
      const reviews = report.transactions.map((t) => ({
        transactionId: t.id,
        sourceVersion: t.sourceVersion,
        category: "office" as const,
        businessPercent: 50,
        note: "Mixed use",
      }));
      sqlite.query("update transactions set amount = -200 where id = 'two'").run();
      await expect(
        reviewSelfAssessmentTransactions(db, {
          teamId: "a",
          taxYear: 2025,
          userId: "user",
          reviews,
        }),
      ).rejects.toThrow("nothing was changed");
      expect(sqlite.query("select count(*) as n from self_assessment_reviews").get()).toEqual({
        n: 0,
      });
      report = await getSelfAssessmentReport(db, { teamId: "a", taxYear: 2025 });
      reviews[1]!.sourceVersion = report.transactions[1]!.sourceVersion;
      report = await reviewSelfAssessmentTransactions(db, {
        teamId: "a",
        taxYear: 2025,
        userId: "user",
        reviews,
      });
      expect(report.expensesPence).toBe(15000);
      expect(report.needsReview).toBe(0);
      await expect(
        reviewSelfAssessmentTransactions(db, {
          teamId: "a",
          taxYear: 2025,
          userId: "user",
          reviews: [{ ...reviews[0]!, transactionId: "foreign" }],
        }),
      ).rejects.toThrow();
      await expect(
        reviewSelfAssessmentTransactions(db, {
          teamId: "a",
          taxYear: 2025,
          userId: "user",
          reviews: [reviews[0]!, reviews[0]!],
        }),
      ).rejects.toThrow("only once");
      expect(
        (await getSelfAssessmentReport(db, { teamId: "a", taxYear: 2025 })).expensesPence,
      ).toBe(15000);
    } finally {
      sqlite.close();
    }
  });
  test("profile and review changes invalidate the exported fingerprint", async () => {
    const { db, sqlite, insert } = setup();
    try {
      insert("one");
      const args = { teamId: "a", taxYear: 2025, userId: "user" };
      const before = await getSelfAssessmentReport(db, args);
      const after = await saveSelfAssessmentProfile(db, {
        ...args,
        profile: SelfAssessmentProfileSchema.parse({ businessName: "Studio" }),
      });
      expect(after.fingerprint).not.toBe(before.fingerprint);
      expect(
        (await getSelfAssessmentReport(db, { teamId: "b", taxYear: 2025 })).profile.businessName,
      ).toBe("");
    } finally {
      sqlite.close();
    }
  });
});

const filingIdentity: SelfAssessmentIdentity = {
  fullName: "Example Taxpayer",
  utr: "1234567890",
  nino: "AB123456C",
  dateOfBirth: "1990-01-01",
  taxpayerStatus: "U",
  onlyThisBusinessIncome: true,
  standardPersonalAllowance: true,
  noOtherChargesOrReliefs: true,
  businessOperatedFullYear: true,
  standardNationalInsurance: true,
  class2Choice: "not_needed",
};
const filingContext = { teamId: "a", taxYear: 2025, userId: "owner" };
async function filingSetup() {
  const fixture = setup();
  fixture.sqlite
    .query(
      "insert into team_memberships (id,team_id,user_id,role,created_at,updated_at) values ('owner','a','owner','owner','2026-01-01','2026-01-01'), ('member','a','member','member','2026-01-01','2026-01-01')",
    )
    .run();
  fixture.insert("sale", "a", "2025-06-01", 40000);
  let report = await saveSelfAssessmentProfile(fixture.db, {
    ...filingContext,
    profile: SelfAssessmentProfileSchema.parse({
      businessName: "Example",
      businessDescription: "Design",
      soleTrader: true,
      cashBasis: true,
      recordsComplete: true,
      adjustmentsReviewed: true,
      otherIncomeReviewed: true,
    }),
  });
  report = await reviewSelfAssessmentTransactions(fixture.db, {
    ...filingContext,
    reviews: report.transactions.map((t) => ({
      transactionId: t.id,
      sourceVersion: t.sourceVersion,
      category: "turnover",
      businessPercent: 100,
      note: "",
    })),
  });
  return { ...fixture, report };
}
async function withFilingEnvironment(
  environment: "test" | "production",
  work: () => Promise<void>,
) {
  const values = {
    HMRC_SA_ENVIRONMENT: environment,
    HMRC_SA_VENDOR_ID: "fixture",
    HMRC_SA_LIVE_TEAM_IDS: filingContext.teamId,
    HMRC_SA_TEST_SENDER_ID: "fixture-id",
    HMRC_SA_TEST_PASSWORD: "fixture-secret",
    // A legacy deployment flag must not make optional recognition a filing requirement.
    HMRC_SA_RECOGNISED: "false",
    TAMIAS_ENVIRONMENT: "production",
    HMRC_SA_LIVE_FILING_ENABLED: "true",
    HMRC_SA_LIVE_FILING_CONFIRMATION: "ENABLE_LIVE_SELF_ASSESSMENT",
    TAMIAS_LIVE_FILING_ENABLED: "false",
    TAMIAS_LIVE_FILING_CONFIRMATION: "",
  };
  const original = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  try {
    await work();
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
describe("Self Assessment durable filing flow", () => {
  test("an externally filed return survives legacy saves and blocks both preparation and an old draft", async () => {
    await withFilingEnvironment("production", async () => {
      const { db, sqlite, report } = await filingSetup();
      let calls = 0;
      const provider = new HmrcSelfAssessmentProvider("production", (async () => {
        calls++;
        throw new Error("A filed return must never reach HMRC");
      }) as unknown as typeof fetch);
      try {
        const draft = await prepareSelfAssessment(db, {
          ...filingContext,
          fingerprint: report.fingerprint,
          identity: filingIdentity,
        });
        await saveSelfAssessmentProfile(db, {
          ...filingContext,
          profile: { ...report.profile, filedElsewhere: true },
        });
        const legacySave = await saveSelfAssessmentProfile(db, {
          ...filingContext,
          profile: report.profile,
        });
        expect(legacySave.profile.filedElsewhere).toBe(true);
        expect(legacySave.transactions).toHaveLength(1);
        await expect(
          prepareSelfAssessment(db, {
            ...filingContext,
            fingerprint: legacySave.fingerprint,
            identity: filingIdentity,
          }),
        ).rejects.toThrow("already filed");
        await expect(
          submitSelfAssessment(
            db,
            {
              ...filingContext,
              id: draft.id,
              declarationAccepted: true,
              confirmedIrMark: draft.irMark,
              senderId: "fixture",
              password: "fixture",
            },
            provider,
          ),
        ).rejects.toThrow("filed outside");
        expect(calls).toBe(0);
        expect((await listSelfAssessmentFilings(db, filingContext)).data[0]?.status).toBe(
          "prepared",
        );
        const corrected = await saveSelfAssessmentProfile(db, {
          ...filingContext,
          profile: { ...report.profile, filedElsewhere: false },
        });
        expect(corrected.profile.filedElsewhere).toBe(false);
      } finally {
        sqlite.close();
      }
    });
  });
  test("production filing uses personal credentials without requiring software recognition", async () => {
    await withFilingEnvironment("production", async () => {
      const { db, sqlite, report } = await filingSetup();
      let submissions = 0;
      const fetcher = async (url: string, init: RequestInit) => {
        expect(url).toBe("https://transaction-engine.tax.service.gov.uk/submission");
        const xml = String(init.body);
        if (xml.includes("<Function>delete</Function>"))
          return new Response("<Function>delete</Function><Qualifier>response</Qualifier>");
        submissions++;
        expect(xml).toContain("<GatewayTest>0</GatewayTest>");
        expect(xml).toContain("<SenderID>personal-fixture-id</SenderID>");
        expect(xml).toContain("<Value>personal-fixture-password</Value>");
        expect(xml).not.toContain("fixture-secret");
        const digest = xml.match(/<IRmark Type="generic">([^<]+)</)![1]!;
        return new Response(
          `<GovTalkMessage xmlns="${GOVTALK_NAMESPACE}"><Header><MessageDetails><Class>HMRC-SA-SA100</Class><Qualifier>response</Qualifier><CorrelationID>${"B".repeat(32)}</CorrelationID></MessageDetails></Header><Body><IRmarkReceipt><DigestValue xmlns="http://www.w3.org/2000/09/xmldsig#">${digest}</DigestValue></IRmarkReceipt></Body></GovTalkMessage>`,
        );
      };
      const provider = new HmrcSelfAssessmentProvider(
        "production",
        fetcher as unknown as typeof fetch,
      );
      try {
        expect(selfAssessmentConnection(filingContext.teamId).ready).toBe(true);
        expect(() =>
          assertExternalMutationEnvironment({ kind: "filing", providerEnvironment: "production" }),
        ).toThrow("Live filing is blocked");
        const prepared = await prepareSelfAssessment(db, {
          ...filingContext,
          fingerprint: report.fingerprint,
          identity: filingIdentity,
        });
        expect(submissions).toBe(0);
        const args = {
          ...filingContext,
          id: prepared.id,
          declarationAccepted: true as const,
          confirmedIrMark: prepared.irMark,
          senderId: "personal-fixture-id",
          password: "personal-fixture-password",
        };
        expect((await submitSelfAssessment(db, args, provider)).status).toBe("accepted");
        expect((await submitSelfAssessment(db, args, provider)).status).toBe("accepted");
        expect(submissions).toBe(1);
        const evidence = JSON.stringify(await selfAssessmentEvidence(db, args));
        expect(evidence).not.toContain(args.senderId);
        expect(evidence).not.toContain(args.password);
      } finally {
        sqlite.close();
      }
    });
  });
  test("workspace and runtime controls still block a prepared live return before any request", async () => {
    await withFilingEnvironment("production", async () => {
      const { db, sqlite, report } = await filingSetup();
      let calls = 0;
      const provider = new HmrcSelfAssessmentProvider("production", (async () => {
        calls++;
        throw new Error("No request should be made");
      }) as unknown as typeof fetch);
      try {
        const prepared = await prepareSelfAssessment(db, {
          ...filingContext,
          fingerprint: report.fingerprint,
          identity: filingIdentity,
        });
        const args = {
          ...filingContext,
          id: prepared.id,
          declarationAccepted: true as const,
          confirmedIrMark: prepared.irMark,
          senderId: "personal-fixture-id",
          password: "personal-fixture-password",
        };
        for (const [key, value] of [
          ["HMRC_SA_LIVE_TEAM_IDS", ""],
          ["HMRC_SA_LIVE_TEAM_IDS", `${filingContext.teamId}-other`],
          ["HMRC_SA_LIVE_FILING_ENABLED", "false"],
          ["HMRC_SA_LIVE_FILING_CONFIRMATION", ""],
          ["TAMIAS_ENVIRONMENT", "development"],
        ] as const) {
          const previous = process.env[key];
          process.env[key] = value;
          try {
            expect((await listSelfAssessmentFilings(db, filingContext)).connection.ready).toBe(
              false,
            );
            await expect(submitSelfAssessment(db, args, provider)).rejects.toThrow("not enabled");
          } finally {
            process.env[key] = previous;
          }
        }
        await expect(
          submitSelfAssessment(db, { ...args, password: undefined }, provider),
        ).rejects.toThrow("Government Gateway");
        expect(calls).toBe(0);
        expect((await listSelfAssessmentFilings(db, filingContext)).data[0]!.status).toBe(
          "prepared",
        );
        expect(selfAssessmentConnection("unlisted-workspace").ready).toBe(false);
      } finally {
        sqlite.close();
      }
    });
  });
  test("requires owner access, freezes review and blocks changed records before any network call", async () => {
    await withFilingEnvironment("test", async () => {
      const { db, sqlite, report } = await filingSetup();
      try {
        await expect(
          listSelfAssessmentFilings(db, { ...filingContext, userId: "member" }),
        ).rejects.toThrow("Only the workspace owner");
        await expect(
          prepareSelfAssessment(db, {
            ...filingContext,
            fingerprint: "stale",
            identity: filingIdentity,
          }),
        ).rejects.toThrow("changed");
        const prepared = await prepareSelfAssessment(db, {
          ...filingContext,
          fingerprint: report.fingerprint,
          identity: filingIdentity,
        });
        expect(prepared.status).toBe("prepared");
        expect(
          (await selfAssessmentEvidence(db, { ...filingContext, id: prepared.id })).returnXml,
        ).not.toContain("Authentication");
        await expect(
          selfAssessmentEvidence(db, { ...filingContext, teamId: "b", id: prepared.id }),
        ).rejects.toThrow();
        await expect(
          submitSelfAssessment(db, {
            ...filingContext,
            id: prepared.id,
            declarationAccepted: true,
            confirmedIrMark: "wrong",
          }),
        ).rejects.toThrow("exact return");
        sqlite.query("update transactions set amount = 50000 where id = 'sale'").run();
        await expect(
          submitSelfAssessment(db, {
            ...filingContext,
            id: prepared.id,
            declarationAccepted: true,
            confirmedIrMark: prepared.irMark,
          }),
        ).rejects.toThrow("changed");
        expect(
          (await listSelfAssessmentFilings(db, filingContext)).data[0]!.calculation.profitPounds,
        ).toBe(40000);
      } finally {
        sqlite.close();
      }
    });
  });
  test("sends once, honours polling interval, persists matching receipt and exports no credentials", async () => {
    await withFilingEnvironment("test", async () => {
      const { db, sqlite, report } = await filingSetup();
      let submissions = 0,
        polls = 0,
        digest = "";
      const correlationId = "A".repeat(32);
      const fetcher = async (url: string, init: RequestInit) => {
        if (String(init.body).includes("<Function>delete</Function>"))
          return new Response("<Function>delete</Function><Qualifier>response</Qualifier>");
        const submission = url.endsWith("/submission");
        if (submission) {
          submissions++;
          digest = String(init.body).match(/<IRmark Type="generic">([^<]+)</)![1]!;
        } else {
          polls++;
        }
        const body = submission
          ? ""
          : `<IRmarkReceipt><DigestValue xmlns="http://www.w3.org/2000/09/xmldsig#">${digest}</DigestValue></IRmarkReceipt>`;
        return new Response(
          `<GovTalkMessage xmlns="${GOVTALK_NAMESPACE}"><Header><MessageDetails><Class>HMRC-SA-SA100</Class><Qualifier>${submission ? "acknowledgement" : "response"}</Qualifier><CorrelationID>${correlationId}</CorrelationID></MessageDetails></Header><GovTalkDetails><ResponseEndPoint PollInterval="30">https://test-transaction-engine.tax.service.gov.uk/poll</ResponseEndPoint></GovTalkDetails><Body>${body}</Body></GovTalkMessage>`,
        );
      };
      const provider = new HmrcSelfAssessmentProvider("test", fetcher as unknown as typeof fetch);
      try {
        const prepared = await prepareSelfAssessment(db, {
          ...filingContext,
          fingerprint: report.fingerprint,
          identity: filingIdentity,
        });
        const args = {
          ...filingContext,
          id: prepared.id,
          declarationAccepted: true as const,
          confirmedIrMark: prepared.irMark,
        };
        expect((await submitSelfAssessment(db, args, provider)).status).toBe("acknowledged");
        await submitSelfAssessment(db, args, provider);
        expect(submissions).toBe(1);
        expect((await pollSelfAssessment(db, args, provider)).status).toBe("acknowledged");
        expect(polls).toBe(0);
        sqlite
          .query("update self_assessment_submissions set next_poll_at = '2020-01-01' where id = ?")
          .run(prepared.id);
        expect((await pollSelfAssessment(db, args, provider)).status).toBe("accepted");
        expect(polls).toBe(1);
        const evidence = await selfAssessmentEvidence(db, args);
        expect(evidence.receiptXml).toContain(digest);
        expect(JSON.stringify(evidence)).not.toContain("fixture-secret");
        expect(JSON.stringify(evidence)).not.toContain("fixture-id");
      } finally {
        sqlite.close();
      }
    });
  });
  test("a timeout stays unknown and prevents a second live return for the year", async () => {
    await withFilingEnvironment("production", async () => {
      const { db, sqlite, report } = await filingSetup();
      let calls = 0;
      const fetcher = async () => {
        calls++;
        throw new Error("Network timeout");
      };
      const provider = new HmrcSelfAssessmentProvider(
        "production",
        fetcher as unknown as typeof fetch,
      );
      try {
        const prepared = await prepareSelfAssessment(db, {
          ...filingContext,
          fingerprint: report.fingerprint,
          identity: filingIdentity,
        });
        const next = await prepareSelfAssessment(db, {
          ...filingContext,
          fingerprint: report.fingerprint,
          identity: filingIdentity,
        });
        const args = {
          ...filingContext,
          id: prepared.id,
          declarationAccepted: true as const,
          confirmedIrMark: prepared.irMark,
          senderId: "fixture",
          password: "fixture",
        };
        expect((await submitSelfAssessment(db, args, provider)).status).toBe("unknown");
        expect((await submitSelfAssessment(db, args, provider)).status).toBe("unknown");
        await expect(
          submitSelfAssessment(
            db,
            { ...args, id: next.id, confirmedIrMark: next.irMark },
            provider,
          ),
        ).rejects.toThrow("already exists");
        expect(calls).toBe(1);
      } finally {
        sqlite.close();
      }
    });
  });
});
