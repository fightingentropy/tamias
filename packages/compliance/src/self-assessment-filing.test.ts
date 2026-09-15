import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  buildSelfAssessmentReport,
  SelfAssessmentProfileSchema,
  taxSourceVersion,
  type TaxSourceTransaction,
} from "./self-assessment";
import {
  buildSelfAssessmentBody,
  calculateSimpleSelfAssessment,
  GOVTALK_NAMESPACE,
  type SelfAssessmentIdentity,
} from "./self-assessment-filing";
import { HmrcSelfAssessmentProvider, parseHmrcSaReceipt } from "./providers/hmrc-self-assessment";

const identity: SelfAssessmentIdentity = {
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
function report(income = 60000, expenses = 0) {
  const transactions: TaxSourceTransaction[] = [income, -expenses].map((amount, index) => ({
    id: String(index),
    amount,
    name: "Example",
    date: "2025-09-01",
    currency: "GBP",
    baseAmount: null,
    baseCurrency: null,
    status: "posted",
    internal: false,
    hasReceipt: true,
    updatedAt: "2026-01-01",
  }));
  return buildSelfAssessmentReport({
    taxYear: 2025,
    now: new Date("2026-09-01"),
    transactions,
    profile: SelfAssessmentProfileSchema.parse({
      businessName: "Example",
      businessDescription: "Design & print",
      soleTrader: true,
      cashBasis: true,
      recordsComplete: true,
      adjustmentsReviewed: true,
      otherIncomeReviewed: true,
    }),
    reviews: transactions.map((t, index) => ({
      transactionId: t.id,
      sourceVersion: taxSourceVersion(t),
      category: index === 0 ? "turnover" : "office",
      businessPercent: 100,
      note: "",
    })),
  });
}
const correlationId = "A".repeat(32);
const mark = createHash("sha1").update("fixture").digest("base64");
function response(qualifier: string, content = "", reference = correlationId) {
  return `<GovTalkMessage xmlns="${GOVTALK_NAMESPACE}"><Header><MessageDetails><Class>HMRC-SA-SA100</Class><Qualifier>${qualifier}</Qualifier><CorrelationID>${reference}</CorrelationID></MessageDetails></Header><GovTalkDetails><ResponseEndPoint PollInterval="15">https://test-transaction-engine.tax.service.gov.uk/poll</ResponseEndPoint></GovTalkDetails><Body>${content}</Body></GovTalkMessage>`;
}
function acceptance(digest = mark) {
  return `<IRmarkReceipt xmlns="http://www.govtalk.gov.uk/taxation/IRmarkReceipt"><Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignedInfo><Reference><DigestValue>${digest}</DigestValue></Reference></SignedInfo></Signature></IRmarkReceipt>`;
}
describe("2025/26 simple Self Assessment", () => {
  test("rounds income down and each expense category up before calculating tax", () => {
    const calculation = calculateSimpleSelfAssessment(report(40000.89, 345.12), identity);
    expect(calculation).toMatchObject({
      incomePounds: 40000,
      expensesPounds: 346,
      profitPounds: 39654,
      incomeTaxPence: 541680,
      class4Pence: 162504,
      totalTaxPence: 704184,
    });
  });
  test("calculates rUK, Welsh and Scottish bands with Class 4", () => {
    expect(calculateSimpleSelfAssessment(report(12570), identity).totalTaxPence).toBe(0);
    expect(calculateSimpleSelfAssessment(report(50270), identity)).toMatchObject({
      incomeTaxPence: 754000,
      class4Pence: 226200,
    });
    expect(calculateSimpleSelfAssessment(report(), identity)).toMatchObject({
      incomeTaxPence: 1143200,
      class4Pence: 245660,
    });
    expect(
      calculateSimpleSelfAssessment(report(), { ...identity, taxpayerStatus: "C" }).totalTaxPence,
    ).toBe(1388860);
    expect(
      calculateSimpleSelfAssessment(report(), { ...identity, taxpayerStatus: "S" }),
    ).toMatchObject({ incomeTaxPence: 1321380, totalTaxPence: 1567040 });
  });
  test("requires an explicit low-profit Class 2 choice and refuses unsupported returns", () => {
    expect(() => calculateSimpleSelfAssessment(report(6000), identity)).toThrow(
      "voluntary Class 2",
    );
    expect(
      calculateSimpleSelfAssessment(report(6000), { ...identity, class2Choice: "do_not_pay" })
        .totalTaxPence,
    ).toBe(0);
    expect(() =>
      calculateSimpleSelfAssessment(report(6000), { ...identity, class2Choice: "pay_voluntarily" }),
    ).toThrow("contribution weeks");
    expect(() =>
      calculateSimpleSelfAssessment(report(), { ...identity, dateOfBirth: "1959-04-06" }),
    ).toThrow("National Insurance review");
    expect(() =>
      calculateSimpleSelfAssessment(report(), {
        ...identity,
        onlyThisBusinessIncome: false,
      } as unknown as SelfAssessmentIdentity),
    ).toThrow();
    expect(() => calculateSimpleSelfAssessment(report(90000), identity)).toThrow(
      "full self-employment",
    );
  });
  test("generates stable credential-free XML and a matching base64/base32 IRmark", () => {
    const result = buildSelfAssessmentBody(report(), identity);
    expect(result.irMark).toBe(createHash("sha1").update(result.canonicalBody).digest("base64"));
    expect(result.irMarkDisplay).toMatch(/^[A-Z2-7]{32}$/);
    expect(result.bodyXml).toContain("Design &amp; print");
    expect(result.bodyXml).toContain("<Turnover>60000.00</Turnover>");
    expect(result.bodyXml).not.toContain("Password");
    expect(buildSelfAssessmentBody(report(), identity).irMark).toBe(result.irMark);
  });
});
describe("HMRC response handling", () => {
  test("preserves the ETS authentication rejection before a service is selected", () => {
    const xml = `<GovTalkMessage xmlns="${GOVTALK_NAMESPACE}"><EnvelopeVersion>2.0</EnvelopeVersion><Header><MessageDetails><Class>UndefinedClass</Class><Qualifier>error</Qualifier><Function>submit</Function><CorrelationID></CorrelationID></MessageDetails></Header><GovTalkDetails><GovTalkErrors><Error><RaisedBy>Gateway</RaisedBy><Number>1046</Number><Type>fatal</Type><Text>Authentication Failure. The supplied user credentials failed validation for the requested service.</Text></Error></GovTalkErrors></GovTalkDetails><Body></Body></GovTalkMessage>`;
    expect(parseHmrcSaReceipt(xml, mark)).toMatchObject({
      status: "rejected",
      correlationId: null,
      irMarkMatched: false,
      errors: [{ number: "1046", text: expect.stringContaining("Authentication Failure") }],
    });
    // A gateway failure during polling says nothing about the existing return.
    expect(() => parseHmrcSaReceipt(xml, mark, correlationId)).toThrow();
    expect(() =>
      parseHmrcSaReceipt(
        xml.replace("<Class>UndefinedClass</Class>", "<Class>HMRC-CT-CT600</Class>"),
        mark,
      ),
    ).toThrow("different service");
  });
  test("never accepts a receipt or acknowledgement for an undefined service", () => {
    for (const xml of [
      response("response", acceptance()),
      response("acknowledgement"),
      response("error"),
    ]) {
      expect(() =>
        parseHmrcSaReceipt(xml.replace("HMRC-SA-SA100", "UndefinedClass"), mark),
      ).toThrow("different service");
    }
  });
  test("distinguishes acknowledgement, IRmark-verified acceptance and rejection", () => {
    expect(parseHmrcSaReceipt(response("acknowledgement"), mark)).toMatchObject({
      status: "acknowledged",
      pollInterval: 15,
    });
    expect(parseHmrcSaReceipt(response("response", acceptance()), mark)).toMatchObject({
      status: "accepted",
      irMarkMatched: true,
    });
    expect(parseHmrcSaReceipt(response("response", acceptance("wrong")), mark).status).toBe(
      "unknown",
    );
    expect(parseHmrcSaReceipt(response("response"), mark).status).toBe("unknown");
    expect(
      parseHmrcSaReceipt(
        response("error", "<Error><Number>3001</Number><Text>Invalid return</Text></Error>"),
        mark,
      ),
    ).toMatchObject({ status: "rejected", errors: [{ number: "3001", text: "Invalid return" }] });
  });
  test("rejects unsafe XML, a different service and mismatched correlation IDs", () => {
    expect(() => parseHmrcSaReceipt("<!DOCTYPE x>" + response("response"), mark)).toThrow(
      "invalid response",
    );
    expect(() =>
      parseHmrcSaReceipt(response("response").replace("HMRC-SA-SA100", "HMRC-CT-CT600"), mark),
    ).toThrow("different service");
    expect(() => parseHmrcSaReceipt(response("response"), mark, "B".repeat(32))).toThrow(
      "does not match",
    );
  });
  test("validates polling origin before making any network request", async () => {
    let calls = 0;
    const fetcher = async () => {
      calls++;
      return new Response(response("acknowledgement"));
    };
    const provider = new HmrcSelfAssessmentProvider("test", fetcher as unknown as typeof fetch);
    for (const responseEndpoint of [
      "https://example.com/poll",
      "https://test-transaction-engine.tax.service.gov.uk/submission",
      "https://secret@test-transaction-engine.tax.service.gov.uk/poll",
    ]) {
      await expect(
        provider.poll({ correlationId, irMark: mark, responseEndpoint }),
      ).rejects.toThrow("not recognised");
    }
    expect(calls).toBe(0);
    expect((await provider.poll({ correlationId, irMark: mark })).status).toBe("acknowledged");
    expect(calls).toBe(1);
  });
  test("acknowledges a saved business receipt at HMRC's returned submission endpoint", async () => {
    const calls: { url: string; body: string }[] = [];
    const provider = new HmrcSelfAssessmentProvider("test", (async (url, init) => {
      calls.push({ url: String(url), body: String(init?.body) });
      return new Response(
        response("response").replace(
          "<CorrelationID>",
          "<Function>delete</Function><CorrelationID>",
        ),
      );
    }) as typeof fetch);
    const responseEndpoint = "https://test-transaction-engine.tax.service.gov.uk/submission";
    await provider.acknowledgeReceipt({ correlationId, responseEndpoint });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(responseEndpoint);
    expect(calls[0]?.body).toContain("<Function>delete</Function>");
    expect(calls[0]?.body).not.toContain("<SenderID>");
  });
  test("rejects unsafe receipt acknowledgement endpoints before sending", async () => {
    let calls = 0;
    const provider = new HmrcSelfAssessmentProvider("test", (async () => {
      calls++;
      return new Response("");
    }) as unknown as typeof fetch);
    for (const responseEndpoint of [
      "https://example.com/submission",
      "https://transaction-engine.tax.service.gov.uk/submission",
      "https://test-transaction-engine.tax.service.gov.uk/other",
      "https://secret@test-transaction-engine.tax.service.gov.uk/submission",
    ]) {
      await expect(
        provider.acknowledgeReceipt({ correlationId, responseEndpoint }),
      ).rejects.toThrow("not recognised");
    }
    expect(calls).toBe(0);
  });
});
