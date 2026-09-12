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
  type SelfAssessmentIdentity,
} from "@tamias/compliance";
import {
  listSelfAssessmentFilings,
  prepareSelfAssessment,
  submitSelfAssessment,
  pollSelfAssessment,
  selfAssessmentEvidence,
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
    HMRC_SA_TEST_SENDER_ID: "fixture-id",
    HMRC_SA_TEST_PASSWORD: "fixture-secret",
    HMRC_SA_RECOGNISED: "true",
    TAMIAS_ENVIRONMENT: "production",
    TAMIAS_LIVE_FILING_ENABLED: "true",
    TAMIAS_LIVE_FILING_CONFIRMATION: "ENABLE_LIVE_FILING",
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
