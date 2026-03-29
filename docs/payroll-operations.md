# Payroll Operations

## Overview

The payroll workspace is an import-first compliance surface. It records payroll into the shared compliance ledger, exposes PAYE liability totals, and generates payroll export bundles. It is not a native payroll engine and does not submit RTI.

Route:

- `/compliance/payroll`

## Preconditions

Before using the workspace, confirm:

- the team country is `GB`
- the UK filing profile exists and is enabled
- the filing profile base currency is set

## Supported Import Modes

### CSV import

The current CSV import expects:

- a header row
- required columns:
  - `accountCode`
  - `debit`
  - `credit`
- optional column:
  - `description`

Each CSV row becomes a journal line in a single payroll-import journal entry.

### Manual journal import

The manual mode is for operators who already know the ledger lines they want to post.

Rules:

- at least two lines are required
- the journal must balance
- account codes should use the UK compliance chart where possible

## Standard Workflow

### 1. Enter the pay period

Set:

- pay period start
- pay period end
- run date
- currency

The run is keyed by pay period, so re-importing the same period updates the existing run instead of creating a duplicate logical period entry.

### 2. Import the run

On import, the system:

- validates the journal balances
- computes an import checksum
- writes a compliance journal entry with `sourceType = payroll_import`
- upserts a `payrollRuns` record
- computes liability totals for:
  - gross pay
  - employer taxes
  - PAYE liability

### 3. Review the liability totals

The workspace surfaces:

- imported run count
- latest run date
- total PAYE liability from imported runs
- per-run liability totals and export status

### 4. Generate the export bundle

Each payroll run can generate a vault-backed export bundle containing:

- `payroll-runs.csv`
- `payroll-journals.csv`
- `liability-summary.csv`
- `manifest.json`

## Idempotency and Re-import Behavior

Payroll imports are period-keyed and checksum-backed.

Operationally that means:

- importing the same pay period updates the stored payroll run
- the compliance journal source remains `payroll_import`
- later year-end rebuilds see the latest imported version for that pay period

## Relationship to Year-End

Imported payroll runs feed the same compliance ledger as VAT and year-end workflows.

As a result:

- payroll journals appear in later year-end pack rebuilds
- PAYE and payroll expense balances can flow into working papers and annual summaries
- payroll does not need a separate annual reporting path

## What This Does Not Do

The payroll workspace does not currently:

- calculate payroll from employee-level inputs
- manage payslips
- submit RTI
- connect directly to Deel or other payroll providers
- reconcile net-pay settlement automatically

## Common Checks

After import, verify:

- debits equal credits
- PAYE liability looks plausible
- gross pay and employer tax amounts reflect the source payroll
- expected liability accounts such as `2210` appear
- the year-end workspace reflects the payroll run after a rebuild

## Common Failure Modes

### Import rejected

Likely causes:

- invalid CSV structure
- missing required columns
- non-numeric amounts
- unbalanced journal lines

### Export missing

Likely causes:

- run was not imported successfully
- vault upload failed during export generation
- no download auth/file key when opening the file URL

### Year-end pack does not reflect payroll

Likely causes:

- the year-end pack has not been rebuilt since import
- the payroll run falls outside the annual period being viewed

## Main Implementation References

- `packages/app-data/src/queries/payroll.ts`
- `apps/api/src/trpc/routers/payroll.ts`
- `apps/dashboard/src/components/compliance/payroll-dashboard.tsx`
- `apps/dashboard/convex/payrollRuns.ts`
- `apps/dashboard/convex/complianceLedger.ts`
