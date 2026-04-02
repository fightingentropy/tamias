# Documentation

This directory contains technical documentation for the Tamias.

## Contents

- **[weekly-insights.md](./weekly-insights.md)** - Technical documentation of the AI-powered weekly insights system including content generation, metric selection, data consistency, and advanced projections (runway dates, quarter pace, payment anomalies).
- **[inbox-matching.md](./inbox-matching.md)** - Detailed documentation of the V2 deterministic inbox matching algorithm with team calibration, hard-negative memory, and read-only verification tooling.
- **[invoice-recurring.md](./invoice-recurring.md)** - Technical documentation of the recurring invoice system including architecture, state machine, generation flow, and key design decisions.
- **[document-processing.md](./document-processing.md)** - Technical documentation of the document processing pipeline including AI classification, graceful degradation, retry functionality, and error handling.
- **[uk-compliance.md](./uk-compliance.md)** - Technical documentation of the UK compliance architecture covering VAT, annual obligations, year-end packs, corporation-tax prep, and payroll import/export flows.
- **[year-end-operations.md](./year-end-operations.md)** - Operator documentation for rebuilding year-end packs, adding manual journals, managing CT adjustments, and exporting annual bundles.
- **[payroll-operations.md](./payroll-operations.md)** - Operator documentation for importing payroll runs, validating PAYE liability outputs, and generating payroll export bundles.

## About

This documentation provides in-depth technical details about core Tamias features and algorithms. It's intended for developers working on the codebase who need to understand the implementation details, data flows, and architectural decisions.

These docs should stay aligned with the implementation and provide more technical depth than the user-facing documentation in `apps/dashboard/src/app/[locale]/site/docs`.
