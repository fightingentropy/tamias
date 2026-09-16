# Personal Self Assessment

Tamias 1.2 adds a native Tax tab for a sole trader: a complete UK tax-year view,
separate business-use reviews, CSV working papers, and a restricted 2025/26
Self Assessment submission flow. It does not implement Making Tax Digital for
Income Tax, quarterly updates, amendments or additional personal return pages.

## Working papers

- Tax years run from 6 April to 5 April. The default is the last completed year.
- The backend reads the entire year in one D1 snapshot, independently of the
  app's Activity pagination. Years above 20,000 transactions are explicitly
  refused rather than truncated.
- Amounts are summed in integer pence. Foreign transactions require an existing
  GBP conversion or explicit exclusion. Unreviewed and pending items are omitted
  from totals and listed as outstanding; transfers and archived records are excluded.
- Reviews store the source version, SA103S category, business percentage and note.
  Changes to bank data invalidate prior review. Bulk updates validate all selected
  records together and apply all or none; other teams' records cannot be reviewed.
- Refunds use their original category. CSV exports include original amounts,
  signed business shares, receipt status, draft checks and additional return sections.
  Formula-like text is escaped without changing numeric negative amounts.
- Business working figures are not a calculation of a person's entire tax bill.
  Missing receipt counts are highlighted but do not by themselves prove an expense
  is invalid. Users must check allowable treatment and record completeness.

## Direct filing scope

The implemented XML route submits SA100, one SA103S and SA110 for **2025/26 only**.
It supports one full-year cash-basis business, positive or zero profit, income
below £90,000, the standard Personal Allowance and standard Class 4 NI eligibility.
England/Northern Ireland, Welsh and Scottish income-tax bands are supported.
The return rounds income down and each expense category up to whole pounds.
The tax total is before payments already made and next year's payments on account.

Users must explicitly confirm that this is their only income and that they have
no other charges, deductions or reliefs. Employment, property, dividends, capital
gains, foreign income, partnerships, student loans, residence adjustments, VAT,
losses and capital-allowance adjustments are flagged for completion with HMRC or
an accountant. Low profits require an explicit voluntary Class 2 decision;
calculating contribution weeks and voluntary payments is not supported.

Preparing creates an immutable copy of the identity, rounded calculation, body
XML and IRmark. Submission requires a separate declaration and confirmation of
that exact IRmark. Any changed financial snapshot requires a new preparation.
Filing records require both the relevant `filings.read`/`filings.write` scope and
workspace ownership. Transaction-only API keys do not acquire filing access.

## HMRC setup

The default environment is `test`. Test acceptance does **not** file a real return.
The connection screen lists missing configuration. These are Worker secrets or
isolated `.env.filing` settings, never dashboard/Vite environment variables:

```dotenv
HMRC_SA_ENVIRONMENT=test
HMRC_SA_VENDOR_ID=
HMRC_SA_LIVE_TEAM_IDS=
HMRC_SA_TEST_SENDER_ID=
HMRC_SA_TEST_PASSWORD=
HMRC_SA_TEST_UTR=
```

Register the software and obtain Self Assessment test access from HMRC. Validate
the supported scenarios through HMRC's test service before enabling production.
HMRC confirmed on 16 September 2026 that recognition is optional for this annual
Self Assessment service; it is not a prerequisite for live filing. Existing VAT
OAuth or Corporation Tax credentials do not by themselves establish Self Assessment
readiness.

The Developer Hub application is named **Tamias**. Its existing OAuth client is
shared by the enabled VAT and MTD Income Tax APIs; the runtime currently keeps
these application credentials under `HMRC_VAT_CLIENT_ID` and
`HMRC_VAT_CLIENT_SECRET`. Renaming the application does not require new credentials.
The registered hosted callback is
`https://api.tamias.xyz/apps/hmrc-vat/oauth-callback`, with the separate local
development callback at `http://localhost:3003/apps/hmrc-vat/oauth-callback`.
The hosted Worker must use the hosted callback; local `.env.filing` uses the local
callback. The runtime loader reads `.env.filing`, not the legacy root `.env`.

Check the existing REST application without printing secrets or filing a return:

```sh
bun --no-env-file scripts/run-with-runtime-env.ts filing -- bun --no-env-file scripts/check-hmrc-environment.ts
```

This authenticates only against the sandbox and checks its application-restricted
Hello World endpoint. It does not establish a taxpayer's consent, live access,
MTD filing functionality, or acceptance of an annual XML return. Do not copy CT
test logins into the SA settings merely because their names look similar. ETS
authentication error `1046` means those credentials failed for the requested
service. Tamias preserves this rejection, including when ETS returns
`UndefinedClass` before routing the initial submission.

HMRC supplied dedicated SA100 credentials on 15 September 2026 and confirmed the
vendor record's name as Tamias. The protected local filing environment and hosted
Worker use those settings in **test mode**. A fictional 2025/26 SA100/SA103S/SA110
return completed ETS submission, polling, acceptance with a matching IRmark, and
gateway acknowledgement. This verifies one scenario; it does not establish
software recognition or acceptance of a real return.

On 15 September 2026, the Software Developer Support Team was asked to confirm
recognition for this restricted scope, provide the prescribed scenarios and
expected results, and specify the application checklist and evidence format.
On 16 September, HMRC clarified that recognition is optional and that applications
should follow comprehensive testing, including ETS and relevant calculation
examples, and release of a mature commercial product. Recognition is deferred.
The published RIM v1.2 archive supplies schemas and business rules; passing those
or the single ETS fixture does not establish software recognition.

Run the same synthetic check with the protected configuration:

```sh
bun --no-env-file scripts/run-with-runtime-env.ts filing -- bun --no-env-file scripts/verify-hmrc-self-assessment.ts
```

The checker accepts no real financial input or live endpoint. It stores its
fictional body and HMRC responses in a private, ignored `artifacts/hmrc-sa-*`
directory; Government Gateway passwords are never written to the evidence.
After interruption, resume polling or gateway acknowledgement without sending
another return:

```sh
bun --no-env-file scripts/run-with-runtime-env.ts filing -- bun --no-env-file scripts/verify-hmrc-self-assessment.ts --resume artifacts/<existing-run>
```

Without a saved HMRC correlation ID, the checker keeps the outcome uncertain and
does not resend it. The final business response can direct its gateway
acknowledgement to `/submission`; polling remains restricted to `/poll` on the
configured HMRC environment's HTTPS origin.

Production additionally requires `HMRC_SA_ENVIRONMENT=production`,
`TAMIAS_ENVIRONMENT=production`,
`TAMIAS_LIVE_FILING_ENABLED=true`, and
`TAMIAS_LIVE_FILING_CONFIRMATION=ENABLE_LIVE_FILING`. Do not set these merely
because local tests pass. Live Government Gateway credentials are entered at
submission, used once and never stored in the return or receipt record. The legacy
`HMRC_SA_RECOGNISED` setting is ignored. Enabling live filing does not prepare or
submit a return: the owner must review the figures, make the declaration, and
confirm the specific submission in the app.

The initial personal rollout also requires the owner's workspace ID in
`HMRC_SA_LIVE_TEAM_IDS` (a comma-separated list of exact IDs). An empty list
disables live submission for every workspace. This is a Tamias rollout control,
not an HMRC requirement. The backend applies it when reporting readiness and
again before sending, so another workspace cannot opt itself in. Historical
receipts remain available when live access is disabled.

## Receipts and uncertain outcomes

The exact prepared ID is the idempotency key. A successful transport
acknowledgement means **received**, not accepted. Acceptance requires an HMRC
business response containing a receipt whose digest matches the submitted IRmark.
Polling respects HMRC's interval and validates the response endpoint and reference.
The raw receipt is saved before the transport delete/acknowledgement message.
That message only cleans up the gateway transport state; it does not delete the return.

An interrupted request or timeout is `unknown` and is never automatically resent.
A second live return for the same workspace/year is blocked while a submission is
pending, acknowledged, accepted or unknown. With a correlation ID, check HMRC status;
without one, reconcile with HMRC before an operator changes submission state.
The app can save the original body and receipt as a JSON evidence file without
Government Gateway credentials. Prepared evidence is clearly marked as not sent.

## Validation

Run the focused domain and D1 tests:

```sh
bun test --exit packages/compliance/src/self-assessment.test.ts packages/compliance/src/self-assessment-filing.test.ts packages/app-data/src/queries/self-assessment.test.ts
```

The script below uses HMRC's unmodified XSD and business rules, plus libxml2
canonical XML, to check a synthetic fixture independently of the generator.
Download the [2026 v1.2 technical package](https://assets.publishing.service.gov.uk/media/6a0c2511c510c3913d8267f6/HMRC-RIM-MTR-2026-v1.2.zip)
and place the [W3C signature schema](https://www.w3.org/TR/2001/PR-xmldsig-core-20010820/xmldsig-core-schema.xsd)
beside the extracted XSD files as `xmldsig-core-schema.xsd`.

```sh
bun scripts/self-assessment-fixture.ts /tmp/tamias-sa-fixture.xml
python scripts/validate-self-assessment.py '/path/to/HMRC RIM MTR 2026 v1.2' /tmp/tamias-sa-fixture.xml
```

This validates format, published business rules and IRmark generation. It is not
proof that HMRC has accepted a test or live return, recognised the software or
confirmed an individual taxpayer's circumstances.

The native filing checks use the normal SwiftUI views, API client and workspace
guards with an isolated fictional service. Generate the shared contract fixture
and run them on an existing simulator:

```sh
bun --no-env-file scripts/self-assessment-native-fixture.ts
ios/scripts/xcode.sh generate
SIMULATOR_ID=<existing-simulator-udid> ios/scripts/xcode.sh test -only-testing:TamiasTests/TaxFilingContractTests -only-testing:TamiasUITests/TaxFilingUITests -parallel-testing-enabled NO
```

The fixture service is compiled only into Debug simulator builds, requires both
UI-test launch flags, uses an in-memory credential store and intercepts its
dedicated URLSession without contacting any network. The scenarios cover incomplete
identity and declarations, acceptance, a polling error, an uncertain submission,
rejection, unsupported income and the iOS evidence share sheet. Its receipt is
explicitly fictional. These checks do not establish HMRC acceptance, recognition,
physical-device behavior or a real user's authenticated filing flow.

Validation on 15 September 2026 passed all 51 native unit tests, the five filing
UI scenarios and the existing demo tax-review workflow. The exported simulator
evidence preserved the original fixture body, receipt and IRmark without
credentials. The full repository check and signed Release build also passed;
the Release binary contains none of the fixture host, token or launch-environment
markers. The paired iPhone opened the Tax tab in its demo workspace, so its
authenticated filing check remains pending sign-in.

References: [HMRC technical specifications](https://www.gov.uk/government/publications/self-assessment-technical-specifications-2026-for-individual-returns),
[XML developer setup](https://www.gov.uk/guidance/basic-guide-for-xml-software-developers),
[MTD eligibility](https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax).
