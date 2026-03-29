# Inbox Matching Algorithm (V2)

## Overview

The inbox matching system links inbox documents (receipts/invoices) to bank transactions using a deterministic scoring model optimized on real production feedback.

The current algorithm is **embedding-free for inbox matching**. It relies on:

- high-quality financial/date signals,
- robust name similarity,
- team-specific threshold calibration,
- historical alias learning,
- hard-negative memory from declines/unmatches.

This design keeps matching explainable, fast, and stable in production.

## Scope

This document covers:

- core matching in `packages/app-data/src/queries/transaction-matching.ts`,
- scoring utilities in `packages/app-data/src/utils/transaction-matching.ts`,
- orchestration from inbox processing jobs.

It does not cover unrelated transaction embedding features used elsewhere.

## High-Level Flow

```mermaid
graph TD
  A[New Inbox Item] --> B[process-attachment]
  B --> C[batch-process-matching]
  C --> D[findMatches]

  E[New Transaction] --> F[match-transactions-bidirectional]
  F --> G[findInboxMatches]

  D --> H[scoreMatch]
  G --> H
  H --> I{Team thresholds}
  I -->|auto threshold| J[Auto-match + confirm]
  I -->|suggested threshold| K[Create suggestion]
  I -->|below threshold| L[No match yet]
```

## Candidate Retrieval

Candidate search is Convex-backed and efficient:

- Team-bounded (`team_id`) and status-bounded records.
- Date window filter around document/transaction date.
- Excludes already-attached and duplicate pending suggestion scenarios.
- Uses normalized name similarity for name-driven retrieval.
- Uses financial filters:
  - same-currency amount proximity, and/or
  - base-currency/base-amount proximity for cross-currency cases.

The candidate set is narrowed before final ranking, which is then handled by the custom scorer.

## Scoring Model

Final confidence is produced by `scoreMatch()` from:

- `nameScore` from normalized token similarity and containment logic,
- `amountScore` with strict same-currency behavior and base-amount cross-currency handling,
- `currencyScore` (same currency strongest; shared base currency next),
- `dateScore` with invoice/expense-aware timing logic.

Confidence receives additional guarded adjustments:

- exact-amount boosts (especially with supporting name/date evidence),
- cross-currency boost only when name+amount+date align,
- zero-name penalty,
- hard-negative penalty from decline memory.

## Learning Layers

### 1) Alias Memory

For a normalized `(inboxName, transactionName)` pair:

- if a team has repeated confirmations, alias score boosts name matching.

This improves recurring merchant variant matching (e.g. legal entity vs card statement name). Alias learning is scoped per-team — one team's data never influences another team's matching.

### 2) Hard Negative Memory

Declines/unmatches are converted into a **decayed penalty**:

- recent negatives weigh more than old negatives,
- unmatched contributes as a weaker negative than explicit decline,
- confirmations offset negatives,
- strong recent confirmations can override stale negatives,
- penalty is capped to avoid over-suppression.

This prevents repeated bad suggestions while remaining recoverable.

### 3) Dismissal Protection

Previously dismissed exact inbox/transaction pairs are not re-suggested.

## Team Calibration and Thresholding

Calibration is computed from recent labeled outcomes and cached briefly in memory.

- Uses team-specific recent history (confirmed/declined/unmatched).
- Computes baseline heuristics (accuracy/confidence gap).
- Runs threshold optimization sweep and blends with heuristics for stability.
- Produces:
  - `calibratedSuggestedThreshold`
  - `calibratedAutoThreshold` (strict, derived above suggested threshold)

This avoids one global threshold for all teams and improves precision/recall balance per team.

## Auto-Match Policy

Auto-match is conservative and requires both:

1) Confidence above calibrated auto threshold  
2) Pattern safety gate from historical pair behavior (not just one-off confidence)

Pattern gate expectations include repeated confirmations and high historical reliability, with low negative evidence.

If not eligible for auto-match but above suggested threshold, a pending suggestion is created instead.

## Status Model

Inbox:

`new -> analyzing -> pending -> suggested_match/done` (or later `no_match`)

Suggestion:

`pending -> confirmed/declined/unmatched/expired`

`unmatched` is treated as negative feedback for future calibration/penalties.

## Observability and Verification

### Read-Only Evaluation CLI

Use the focused transaction-matching tests for safe verification against local data and fixtures.

Key properties:

- read-only transaction (`BEGIN TRANSACTION READ ONLY`),
- statement timeout,
- forced rollback,
- no write path.

## Why This Version

Compared to the legacy embedding-driven matcher, V2 is:

- simpler to reason about,
- cheaper and faster at runtime,
- easier to debug and verify,
- better aligned with observed production feedback.

## Files of Interest

- `packages/app-data/src/queries/transaction-matching.ts`
- `packages/app-data/src/queries/inbox-matching.ts`
- `packages/app-data/src/queries/transactions.ts`
- `packages/app-data/src/queries/inbox.ts`
- `packages/app-data/src/utils/transaction-matching.ts`
- `packages/app-data/src/test/transaction-matching.golden.test.ts`
