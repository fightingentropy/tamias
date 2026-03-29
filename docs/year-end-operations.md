# Year-End Operations

## Overview

The year-end workspace is the annual prep surface for UK compliance. It builds a ledger-backed pack for the active annual period, lets operators add manual journals, corporation-tax adjustments, CT rate inputs, and CT600A close-company loans schedules, and produces an export bundle for downstream accountant or filing workflows. It also supports direct HMRC CT Transaction Engine submission, defaulting to test mode, and direct Companies House annual-accounts submission when the required runtime credentials are configured.

Route:

- `/compliance/year-end`

## Preconditions

Before using the workspace, confirm:

- the team country is `GB`
- the UK filing profile exists and is enabled
- the filing profile has `yearEndMonth`, `yearEndDay`, and `baseCurrency` set

If these are missing, the page will fall back to setup/disabled states rather than building a pack.

## What the Workspace Shows

The page displays:

- the current annual period
- accounts due date
- corporation-tax due date
- current pack status
- latest export timestamp
- Companies House public-register status for the filing-profile company, when configured
- Companies House annual-accounts submission and poll controls, when configured
- trial balance snapshot
- working-paper sections
- corporation-tax summary
- CT rate-input controls for associated companies and exempt distributions
- CT600A close-company loans schedule controls
- manual year-end journals

## Standard Workflow

### 1. Rebuild the pack

Use `Rebuild pack` when:

- underlying transactions changed
- invoices/refunds changed
- payroll runs were imported
- manual year-end journals changed
- CT adjustments changed

Rebuild behavior:

- regenerates the derived ledger for transactions/invoices
- loads manual year-end journals and payroll-import journals
- resolves the active annual period from the filing profile
- ensures annual `accounts` and `corporation_tax` obligations exist
- recomputes the year-end pack snapshot

### 2. Review the trial balance

Check:

- total debits equal total credits
- expected cash, VAT, receivable, payable, equity, and tax balances are present
- obviously missing accruals or reclasses are captured before export

### 3. Add manual year-end journals

Use manual journals for explicit year-end accounting entries such as:

- accruals
- prepayments
- retained earnings adjustments
- reclasses between system accounts

Rules:

- entries must be balanced
- at least two lines are required
- lines are stored as compliance journal entries with `sourceType = manual_adjustment`
- deleting a journal removes it from the shared compliance ledger and rebuild path

### 4. Add corporation-tax adjustments

Use CT adjustments for tax-only schedule changes that should not become accounting journals, for example:

- disallowable entertaining
- tax add-backs
- tax-only deductions

Rules:

- CT adjustments stay inside the year-end pack
- they affect taxable profit and estimated corporation tax due
- they do not alter the trial balance directly

### 5. Save CT rate inputs

Use the CT rate-input card for accounting periods ending on or after 1 April 2023 when the company may fall into the small profits rate or marginal-relief regime.

Rules:

- associated companies are entered excluding the filing company itself
- use `0` where there are no associated companies
- if the accounting period spans two corporation-tax financial years, save either one count for the whole period or separate counts for the first and second financial year
- exempt distributions should include qualifying exempt ABGH distributions from non-group companies
- the saved schedule feeds the CT600 draft, computations attachment, export bundle, and filing-readiness gate

### 6. Save CT600A close-company loans schedules

Use the CT600A card when the company has loans to participators or related relief to report.

Rules:

- Part 1 records outstanding loans and the tax chargeable amount
- Part 2 records relief within 9 months of the period end
- Part 3 records relief due now for repayments, releases, or write-offs after the 9 month window
- row dates and totals are validated against the active period end before the supported filing-ready path is treated as ready
- the saved schedule feeds the CT600 draft, export bundle, and HMRC CT submission XML

### 7. Generate the export bundle

Use `Generate export` once the pack is reviewed.

Current export contents:

- `trial-balance.csv`
- `working-papers.csv`
- `ct-summary.csv`
- `statutory-accounts-draft.html`
- `statutory-accounts-draft.json`
- `ct600-draft.xml`
- `ct600-draft.json`
- `accounts-attachment.ixbrl.xhtml`
- `computations-attachment.ixbrl.xhtml`
- `companies-house-accounts-submission.xml` when the Companies House XML gateway runtime is configured
- `corporation-tax-rate-inputs.json` when CT rate inputs are saved for the period
- `ct600a-close-company-loans.json` when a CT600A schedule is saved for the period
- `manifest.json`

The zip bundle is stored in the vault and can be downloaded from the workspace.

The statutory accounts HTML/JSON artifacts remain draft outputs for review and accountant handoff. For the supported small-company path, `ct600-draft.xml` now includes a computed IRmark, saved CT rate inputs for small profits rate and marginal-relief handling, CT600A when saved, and filing-ready iXBRL account and computation attachments. The year-end workspace can submit that package to the HMRC CT Transaction Engine and poll for responses. Runtime defaults to `test`; switching `HMRC_CT_ENVIRONMENT=production` moves the same submission flow to the live endpoint. Each CT submission also stores a vault bundle containing the exact CT600 XML, both iXBRL attachments, and the request summary used for that submission.

When the Companies House XML gateway presenter credentials are configured on the API runtime, the year-end bundle also includes a `companies-house-accounts-submission.xml` GovTalk envelope built from the same filing-ready iXBRL accounts attachment. The year-end workspace can submit that envelope to the Companies House XML gateway and poll `GetSubmissionStatus` results for the saved submission number.

## Data Sources

The year-end pack currently includes these ledger inputs:

- transaction-derived compliance journals
- invoice and invoice-refund compliance journals
- manual year-end journals
- payroll-import journals

It does not currently include:

- filing-ready statutory accounts output outside the supported small-company path
- supplementary CT schedules other than CT600A or complex relief regimes outside the supported path
- HMRC credential provisioning or recognition work outside the app runtime
- Companies House filing flows beyond annual accounts, registered office, registered email, and PSC discrepancy reporting

## Common Checks

Before export, verify:

- trial balance balances to zero
- retained earnings roll-forward is plausible
- PAYE/NIC liabilities from imported payroll runs show where expected
- VAT balances look reasonable against the VAT workspace
- CT adjustments are explicitly listed and intentional
- CT rate inputs have been saved for post-1 April 2023 periods
- CT600A schedules are present only where loans to participators or related relief apply
- HMRC CT sender credentials are configured before attempting CT submission
- `HMRC_CT_TEST_UTR` is configured for test mode or the filing profile UTR is saved for production mode
- the year-end submission detail panel shows the expected environment before you confirm a live filing
- Companies House XML presenter credentials are configured before attempting annual-accounts submission
- the company authentication code is saved in compliance settings before attempting annual-accounts submission

## Failure Modes

### Pack not building

Likely causes:

- filing profile missing
- UK compliance feature flag disabled
- invalid year-end settings
- malformed manual journal lines

### Export missing

Likely causes:

- pack was never rebuilt
- vault upload failed during export generation
- no file key/auth context when downloading

### Numbers do not match expectations

Start with:

- rebuilding the pack
- checking recent transaction/invoice changes
- checking manual year-end journals
- checking payroll runs imported into the same annual period
- checking CT adjustments separately from accounting journals

## Main Implementation References

- `packages/app-data/src/queries/year-end.ts`
- `apps/api/src/trpc/routers/year-end.ts`
- `apps/dashboard/src/components/compliance/year-end-dashboard.tsx`
- `apps/dashboard/convex/yearEndPacks.ts`
- `apps/dashboard/convex/corporationTaxAdjustments.ts`
