import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createSelfAssessmentFixture } from "./self-assessment-fixture";

// Contract fixture for the isolated iOS UI tests. No HMRC credentials or network calls.
const { report, identity, calculation, bodyXml, irMark } = createSelfAssessmentFixture();
// The API adds an opaque snapshot fingerprint after reading D1. Bind the UI fixture
// to its own fixed snapshot so the prepare request must return the reviewed value.
const fingerprint = createHash("sha256").update(JSON.stringify(report)).digest("hex");
const fixture = {
  report: { ...report, fingerprint },
  filing: {
    id: "11111111-1111-4111-a111-111111111111",
    environment: "test",
    status: "prepared",
    fingerprint,
    irMark,
    correlationId: null,
    createdAt: "2026-09-15T18:00:00Z",
    updatedAt: "2026-09-15T18:00:00Z",
    nextPollAt: null,
    identity,
    calculation,
    receipt: null,
  },
  returnXml: bodyXml,
  receiptXml:
    "<SyntheticUITestReceipt>This is a UI fixture, not an HMRC receipt.</SyntheticUITestReceipt>",
};
writeFileSync(
  new URL("../ios/TamiasUITests/Fixtures/SelfAssessment.json", import.meta.url),
  `${JSON.stringify(fixture, null, 2)}\n`,
);
