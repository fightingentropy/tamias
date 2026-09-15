import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  buildHmrcSaEnvelope,
  HmrcSelfAssessmentProvider,
  type HmrcSaReceipt,
} from "../packages/compliance/src/providers/hmrc-self-assessment";
import { createSelfAssessmentFixture } from "./self-assessment-fixture";

// Sends only the built-in fictional fixture to ETS. Never accepts a real return or live URL.
if (process.env.HMRC_SA_ENVIRONMENT !== "test") throw new Error("HMRC test mode is required.");
const required = (key: string) => {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`Missing ${key}`);
  return value;
};
const vendorId = required("HMRC_SA_VENDOR_ID");
const senderId = required("HMRC_SA_TEST_SENDER_ID");
const password = required("HMRC_SA_TEST_PASSWORD");
const utr = required("HMRC_SA_TEST_UTR");
if (!/^\d{4}$/.test(vendorId) || !/^\d{10}$/.test(utr))
  throw new Error("Invalid HMRC test registration format.");

const resume = process.argv[2] === "--resume";
const directory = path.resolve(
  (resume ? process.argv[3] : process.argv[2]) ??
    `artifacts/hmrc-sa-${new Date().toISOString().replace(/[:.]/g, "-")}`,
);
if (!resume) {
  mkdirSync(path.dirname(directory), { recursive: true, mode: 0o700 });
  mkdirSync(directory, { mode: 0o700 });
}
type State = {
  environment: "test";
  irMark: string;
  status: "prepared" | HmrcSaReceipt["status"];
  receipt?: Omit<HmrcSaReceipt, "rawXml">;
  responseCount: number;
  nextPollAt?: string;
  transportAcknowledged?: boolean;
  failure?: string;
};
const fixture = createSelfAssessmentFixture(utr);
const state: State = resume
  ? JSON.parse(readFileSync(path.join(directory, "state.json"), "utf8"))
  : { environment: "test", irMark: fixture.irMark, status: "prepared", responseCount: 0 };
if (state.environment !== "test") throw new Error("Only test evidence can be resumed.");
const save = () =>
  writeFileSync(path.join(directory, "state.json"), JSON.stringify(state, null, 2), {
    mode: 0o600,
  });
const safe = (message: string) =>
  [password, senderId, utr].reduce((text, value) => text.split(value).join("[redacted]"), message);
const provider = new HmrcSelfAssessmentProvider("test", async (input, init) => {
  const response = await fetch(input, init);
  if (!response.body) throw new Error("Empty HMRC response.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.length;
    if (size > 1_000_000) {
      await reader.cancel();
      throw new Error("Oversized HMRC response.");
    }
    chunks.push(chunk.value);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (raw.includes(password)) throw new Error("HMRC echoed a credential; response not saved.");
  state.responseCount += 1;
  writeFileSync(path.join(directory, `response-${state.responseCount}.xml`), raw, {
    mode: 0o600,
  });
  save();
  return new Response(raw, { status: response.status, headers: response.headers });
});
function record(receipt: HmrcSaReceipt) {
  const { rawXml, ...summary } = receipt;
  state.status = receipt.status;
  state.receipt = summary;
  state.nextPollAt = new Date(Date.now() + receipt.pollInterval * 1000).toISOString();
  writeFileSync(path.join(directory, "receipt.xml"), rawXml, { mode: 0o600 });
  save();
  console.log(
    JSON.stringify({
      status: receipt.status,
      irMarkMatched: receipt.irMarkMatched,
      errors: receipt.errors.map((e) => ({ number: e.number, text: safe(e.text) })),
    }),
  );
}

try {
  if (!resume) {
    writeFileSync(path.join(directory, "body.xml"), fixture.bodyXml, { mode: 0o600 });
    // Persist uncertain state before sending. Reusing this directory cannot send a second copy.
    state.status = "unknown";
    save();
    console.log(
      JSON.stringify({ environment: "test", syntheticFixture: true, evidence: directory }),
    );
    record(
      await provider.submit(
        buildHmrcSaEnvelope({
          bodyXml: fixture.bodyXml,
          utr,
          senderId,
          password,
          vendorId,
          environment: "test",
        }),
        fixture.irMark,
      ),
    );
  }
  const deadline = Date.now() + 180_000;
  while (
    (state.status === "acknowledged" || state.status === "unknown") &&
    state.receipt?.correlationId &&
    Date.now() < deadline
  ) {
    const wait = Math.max(0, Date.parse(state.nextPollAt ?? "") - Date.now()) || 0;
    if (Date.now() + wait > deadline) break;
    await Bun.sleep(wait);
    record(
      await provider.poll({
        correlationId: state.receipt.correlationId,
        irMark: state.irMark,
        responseEndpoint: state.receipt.responseEndpoint,
      }),
    );
  }
  if (
    ["accepted", "rejected"].includes(state.status) &&
    state.receipt?.correlationId &&
    !state.transportAcknowledged
  ) {
    // The complete business receipt is already on disk before acknowledging gateway cleanup.
    await provider.acknowledgeReceipt({
      correlationId: state.receipt.correlationId,
      responseEndpoint: state.receipt.responseEndpoint,
    });
    state.transportAcknowledged = true;
    delete state.failure;
    save();
  }
  console.log(
    JSON.stringify({
      status: state.status,
      transportAcknowledged: state.transportAcknowledged ?? false,
      evidence: directory,
    }),
  );
  if (state.status !== "accepted") process.exitCode = 1;
} catch (error) {
  state.failure = safe(error instanceof Error ? error.message : "Verification failed.");
  save();
  console.error(
    JSON.stringify({ status: state.status, error: state.failure, evidence: directory }),
  );
  process.exitCode = 1;
}
