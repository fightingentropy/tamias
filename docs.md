# Tamias — engineering documentation

Deep-dive notes for integrations and shared packages. **Day-to-day setup, env, deploys:** see [README.md](README.md).

**Repository layout (current):** [Bun](https://bun.sh) monorepo with root `"type": "module"`. Workspaces: **`dashboard/`** (TanStack Start, SSR, public site host, **`dashboard/convex/`**), **`api/`** (Hono, tRPC, REST, OpenAPI, MCP — bundled with the dashboard in the unified Cloudflare Worker in production), **`worker/`** (queue consumers, workflows, schedules via **`@tamias/worker`** exports), **`packages/*`**. Single root **`wrangler.jsonc`**, root **`playwright.config.ts`**, specs in **`e2e/`**, secrets in root **`.env`** (gitignored). AI assistant prompt markdown lives in **`agent-prompts/`** and is compiled into the API with **`bun run --cwd api prompts:generate`**.

## Table of contents

- [Design system](#design-system)
- [Banking providers](#banking-providers)
- [Accounting integrations](#accounting-integrations)
- [Accounting sync architecture (deep dive)](#accounting-sync-architecture-deep-dive)
- [Categories and tax](#categories-and-tax)
- [Inbox connectors](#inbox-connectors)
- [Data & AI insights](#data--ai-insights)
- [Assistant prompt templates](#assistant-prompt-templates)

---

## Design system

This document captures the current design language of the app so new pages match what is already shipped. It is based on the implemented UI in `dashboard` and `packages/ui`, not on aspirational design ideas.

Use this as the default reference when building new pages, widgets, forms, tables, or public-facing screens.

### Scope

There are two distinct visual modes in the product:

1. **Authenticated product UI**
   - The main app shell used for dashboard, transactions, invoices, inbox, tracker, customers, vault, settings, and compliance.
   - This is the primary design system and should drive most new work.
2. **Public and auth surfaces**
   - Homepage, pricing-style sections, and login.
   - These are more expressive and editorial, but still inherit the same typefaces and restrained palette.

When in doubt, match the authenticated product UI unless the page is clearly marketing or authentication.

### Source Of Truth

The most important files for the design system are:

- `packages/ui/src/globals.css` (theme tokens, **typography CSS variables**, base `body` styles)
- `packages/ui/tailwind.config.ts` (Tailwind theme extensions, **font families**)
- `packages/ui/src/components/*`
- `dashboard/src/start/root-shell.tsx` (document shell, **Google Fonts** for Hedvig)
- `dashboard/src/start/routes/__root.tsx` (root route metadata and layout wiring)
- `dashboard/src/start/components/app-layout-shell.tsx` (authenticated app chrome)
- `dashboard/src/styles/globals.css` (app-level utilities; focus outline caveat below)
- `dashboard/src/components/sidebar.tsx`
- `dashboard/src/components/header.tsx`
- `dashboard/src/components/widgets/*`
- `dashboard/src/components/metrics/*`
- `dashboard/src/components/tables/*`
- `dashboard/src/components/forms/*`
- `dashboard/src/components/sheets/*`
- `dashboard/src/start/routes/index.tsx` (public `/` route entry)
- `dashboard/src/start/routes/login.tsx` and `login.lazy.tsx` (auth surfaces)

### Design Character

Tamias is not a glossy SaaS dashboard. The current product UI feels like:

- a neutral operational workspace
- an editorial financial tool
- a dense but calm data environment
- a system that values clarity over ornament

The design leans on:

- restrained grayscale surfaces
- sharp or lightly rounded edges
- visible borders instead of heavy shadows
- compact controls
- serif accents for warmth, mostly in greetings and marketing headlines
- data-first composition

It avoids:

- bright branded chrome
- playful rounded-pill UI everywhere
- oversized card padding
- decorative gradients in the authenticated shell
- high-saturation charts or controls unless meaning is semantic

### Color And Theme

#### Core palette

The main shell is almost entirely neutral.

Light theme tokens from `packages/ui/src/globals.css`:

- background: white
- foreground: near-black
- card/popover: warm off-white
- border: light warm gray
- muted/secondary/accent: pale neutral grays

Dark theme tokens:

- background: near-black
- card/popover: slightly lifted black
- border/accent/muted: dark charcoal

#### Working rules

- Prefer token-backed colors first: `background`, `foreground`, `border`, `muted`, `muted-foreground`, `card`.
- Existing product chrome also uses repeated explicit values such as `#f7f7f7`, `#e6e6e6`, `#878787`, `#666666`, `#1d1d1d`, and `#131313`.
- If a new component is part of the authenticated shell, it should look natural next to those values.
- Color is usually reserved for data semantics, status, or media, not for structural UI.

#### Shape

- Global radius token is `0.5rem`, but many important surfaces feel flatter than that.
- Badges, tables, skeletons, and many menu treatments are square or nearly square.
- New internal UI should prefer crisp geometry over soft consumer-app rounding.

### Typography

The app uses:

- `Hedvig Letters Sans` for most interface text
- `Hedvig Letters Serif` for selected headings and editorial accents

These are the same type families as [Midday](https://midday.ai)’s website and app. Midday injects them with `next/font`; Tamias loads them from **Google Fonts** in the dashboard shell so the CSS variables stay consistent without Next.js.

#### Implementation (source of truth)

1. **`packages/ui/src/globals.css`** — On `:root`, `--font-hedvig-sans` and `--font-hedvig-serif` are full `font-family` stacks (Hedvig first, then system UI fallbacks). Base `body` uses `font-family: var(--font-hedvig-sans)`.
2. **`dashboard/src/start/root-shell.tsx`** — Preconnect + stylesheet for `Hedvig Letters Sans` and `Hedvig Letters Serif` with `display=swap`.
3. **`packages/ui/tailwind.config.ts`** — `font-sans` / `font-mono` → `var(--font-hedvig-sans)`; `font-serif` → `var(--font-hedvig-serif)`; `font-hedvig-sans` is an alias of the sans stack (e.g. charts).
4. **Root `<body>`** — Applies `font-sans` so the whole app inherits the sans stack unless a component sets `font-serif` or another utility.

Other surfaces (e.g. **PDF invoices** use Inter; **email** uses inline Hedvig via React Email). Those are intentional exceptions for rendering engines, not the product shell.

#### Product shell typography

- Controls and body copy are generally sans.
- Most labels are small and quiet.
- Common muted label styles are `text-xs` or `text-sm` with `#878787` or `#666666`.
- Page utility copy is understated rather than promotional.

#### Common sizes

- Dashboard greeting: about `30px`, serif
- Standard page title areas: modest, not oversized
- Widget titles and labels: `text-xs` to `text-sm`
- Muted descriptions: `text-sm` or `text-[14px]`
- Form labels: usually `text-xs`

#### Usage rules

- Use serif sparingly.
- Serif belongs in greetings, occasional hero headings, or editorial moments.
- Do not use serif for dense controls, table UIs, or long-form operational content.

### Layout Architecture

#### App shell

The authenticated app uses a fixed left rail and a persistent top header.

- Sidebar widths:
  - collapsed: `70px`
  - expanded: `240px`
- Header height: `70px`
- Main content offset on desktop: `md:ml-[70px]`
- Page padding: `px-4 md:px-8`

The shell is desktop-first. Mobile relies on a menu sheet rather than a permanently visible sidebar.

#### Header behavior

- The header can hide/reveal on scroll.
- Pages that should move with that behavior use `ScrollableContent` or related wrappers that translate based on `--header-offset`.
- Data pages should respect this pattern instead of inventing their own sticky-stack behavior.

#### Spatial rhythm

Common spacing patterns:

- `gap-6` between major sections
- `p-6` inside cards, sheets, and major surfaced blocks
- `h-9` controls
- summary grids use `gap-4 sm:gap-6`

The product generally uses tight, repeatable spacing rather than dramatic whitespace.

### Navigation

#### Sidebar

The sidebar is utilitarian:

- fixed left rail
- border-right separator
- no decorative background treatment
- hover expansion on desktop
- icon-first collapsed state

#### Menu items

Main nav items:

- height: `40px`
- icon column: `40px`
- active states use light/dark gray fills and visible borders
- inactive items are muted gray and sharpen on hover

Sub-items:

- shorter rows, around `32px`
- vertical guide line
- same restrained visual language

Navigation should feel precise and workmanlike, not playful.

### Page Anatomy

Most authenticated pages use one of a few repeatable structures.

#### Data table pages

Typical pattern:

1. optional summary cards
2. utility header with search, filters, views, and actions
3. large data table

Examples: invoices, customers, transactions.

Rules:

- Keep tools close to the dataset they act on.
- Use wide, dense tables as a primary layout, not as a small card nested inside another card.
- Prefer one strong page composition over stacked miscellaneous panels.

#### Dashboard pages

The dashboard uses:

- a greeting header with serif accent
- overview/metrics toggle
- draggable widgets or metric cards
- regular grid spacing with fixed-height blocks

Widgets and metric cards are not decorative cards. They are working surfaces.

#### Detail and utility pages

Pages like vault or settings are simpler:

- short top header
- immediate access to the core surface below
- minimal hero treatment

### Core Component Language

#### Buttons

Buttons are compact and squared-off.

- default height is `h-9`
- icon buttons are `h-9 w-9`
- outline and ghost variants are used heavily in the product shell

Use buttons as tools, not as large promotional CTAs, unless on marketing pages.

#### Inputs and selects

Inputs, textareas, and selects are:

- compact
- bordered
- transparent or subdued in fill
- text-first rather than decorative

Use `h-9` controls as the default. Do not introduce oversized consumer-style inputs in internal screens.

#### Cards

Internal cards are mostly:

- bordered
- flat or lightly elevated
- neutral in fill
- generous enough for readability, but still dense

Typical card padding is `p-6`.

#### Badges and tags

Tags are understated and often square-edged. Use them as metadata, not as visual flair.

#### Sheets and dialogs

Editing and creation often happen in sheets rather than full-page flows.

Sheet characteristics:

- right-side sheet
- max width around `520px`
- neutral overlay
- bordered panel
- `p-6` interior

Dialogs follow the same restrained treatment.

If a task is a focused create/edit flow, prefer a sheet before inventing a separate page.

### Forms

Forms in the app are practical and structured.

Patterns:

- small labels
- short descriptions
- accordion sections for longer forms
- scrollable interiors inside sheets
- compact vertical spacing

Guidelines:

- Keep labels quiet and readable.
- Group complexity into sections instead of making a single endless form.
- Use inline helper copy only when it materially reduces confusion.
- Avoid large decorative banners or onboarding prose inside forms.

### Tables

Tables are one of the strongest parts of the product identity.

Characteristics:

- border-led grid structure
- muted headers
- dense operational rows
- sticky behavior where useful
- support for filtering, sorting, selection, drag/reorder, and visibility control

Rules:

- Treat tables as the main event on data pages.
- Keep surrounding UI minimal.
- Avoid wrapping large tables in over-designed cards unless the existing page already does so.

### Widgets And Metrics

Dashboard widgets and metric cards define another major pattern.

#### Widgets

- fixed height around `210px`
- bordered shell
- neutral background
- tiny muted labels
- small bottom actions
- drag customization with wiggle animation

#### Metrics

- first chart spans full width
- following charts appear in two-column rows on large screens
- cards use `p-6`
- values are prominent, but still calm
- legends are tiny and unobtrusive

#### Charts

Charts follow the same grayscale logic:

- neutral axes
- light dashed grids
- dark primary series
- subdued secondary series
- small tooltips with border and minimal padding

If adding charts:

- keep labels and axes small
- use color sparingly
- prefer clarity and comparison over visual spectacle

### States And Feedback

#### Empty states

Empty states are restrained:

- centered
- modest title
- short description
- one outline action

They are not illustrated marketing moments.

#### Loading states

Skeletons are flat and often square. Shimmer exists, but it remains subtle.

#### Notifications and overlays

Overlays use:

- frosted neutral wash
- borders instead of dramatic shadows
- low visual noise

### Motion And Interaction

Motion exists, but it is purposeful.

Examples in the app:

- sidebar expansion
- header hide/reveal on scroll
- widget and metrics customization
- drag overlays
- shimmer loading states
- marketing/homepage animations

Rules:

- Motion should support understanding, not decoration.
- Use short transitions and subtle transforms.
- In the authenticated shell, avoid large entrance choreography.
- Save richer animation for public/marketing storytelling.

### Responsive Behavior

The product is responsive, but it stays desktop-oriented for work-heavy screens.

Patterns:

- sidebar disappears below `md`
- mobile menu becomes a sheet
- summary cards collapse from 4 to 2 to 1 columns
- action density is reduced on smaller screens
- content padding tightens on mobile

When building new internal pages:

- design the desktop working state first
- then reduce and stack for mobile
- do not turn a dense operational page into a totally different visual language on small screens

### Public And Auth Surfaces

Public pages and login intentionally diverge from the main app shell.

#### What changes

- more narrative layout
- bigger typography
- stronger use of serif headings
- centered composition
- richer media and animation
- homepage sections that feel more like storytelling than tools

#### What stays consistent

- same type families
- restrained overall palette
- preference for clean borders and simple structure
- no loud brand-color dependency

Use this mode only for:

- homepage and feature marketing
- pricing and launch-style sections
- auth entry pages

Do not import marketing patterns into the main authenticated workspace.

### Accessibility Caveat

The app currently removes default focus outlines globally in `dashboard/src/styles/globals.css`.

That means any new interactive component should be checked carefully for visible focus treatment. If a control depends on keyboard use, add an explicit focus style instead of relying on browser defaults.

This is an implementation reality that future work should improve, not copy blindly.

### Build Rules For New Pages

When creating a new authenticated page:

1. Start from the existing shell and spacing.
2. Decide whether the page is primarily a table page, dashboard surface, or utility/detail page.
3. Use compact controls and restrained labels.
4. Prefer borders and structure over color and decoration.
5. Keep one dominant working surface.
6. Use sheets for focused create/edit flows.
7. Match existing muted text colors and spacing rhythm.

### Do This

- use neutral surfaces and visible borders
- keep controls compact
- use serif only for selective emphasis
- design around data density and task flow
- reuse summary grids, toolbar rows, tables, sheets, and widget patterns
- make empty states concise and operational
- preserve the shell's `70px` rail/header logic

### Avoid This

- bright brand-color chrome in the product shell
- oversized hero sections on internal pages
- soft rounded consumer-app styling
- nested card-on-card layouts for data-heavy screens
- colorful charts by default
- marketing animations inside operational workflows
- inconsistent spacing or ad hoc one-off component sizes

### Short Design Test

Before shipping a new page, ask:

- Does this look like it belongs next to Transactions, Invoices, and Customers?
- Is the page built around the main job to be done, or around decoration?
- Would this still feel correct in dark mode?
- Are controls, borders, spacing, and typography using the existing rhythm?
- If this is internal, did we accidentally make it look like a landing page?

If any answer is no, bring it back toward the existing product shell.

---

## Banking providers

Tamias uses TrueLayer as its only bank-data provider. The dashboard starts a TrueLayer OAuth flow, the API exchanges the callback code for token metadata, and the worker syncs accounts and transactions through `packages/banking/src/providers/truelayer`.

Active runtime configuration:

- `TRUELAYER_CLIENT_ID`
- `TRUELAYER_CLIENT_SECRET`
- `TRUELAYER_REDIRECT_URI`
- `TRUELAYER_ENVIRONMENT`

The provider facade in `packages/banking/src/index.ts` accepts only `truelayer`. Institution sync, connection health, account discovery, reconnect, deletion, balance refresh, and transaction sync should all stay on that single provider path. Do not add fallback provider branches, compatibility enum cases, retired provider settings, hidden scripts, or stale credential names.

## Accounting integrations

Technical documentation for Tamias's accounting software integrations (Xero, QuickBooks, Fortnox).

### Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Data Flow](#data-flow)
4. [Database Schema](#database-schema)
5. [Export Logic](#export-logic)
6. [Authentication](#authentication)
7. [Worker Jobs](#worker-jobs)
8. [API Reference](#api-reference)
9. [Configuration](#configuration)
10. [Error Handling](#error-handling)

---

### Overview

The accounting integration enables Tamias users to export their enriched financial transactions and attachments (receipts, invoices) to external accounting software. The system uses manual export only, giving users full control over when data is sent to their accounting provider.

#### Supported Providers

| Provider   | Status | OAuth     | Export         | Attachments |
| ---------- | ------ | --------- | -------------- | ----------- |
| Xero       | Active | OAuth 2.0 | Yes            | Yes         |
| QuickBooks | Active | OAuth 2.0 | Yes            | Yes         |
| Fortnox    | Active | OAuth 2.0 | Yes (Vouchers) | Yes         |

#### Key Features

- OAuth 2.0 authentication with automatic token refresh
- Manual export of selected transactions
- Attachment upload with deduplication
- Multi-provider support per team
- Batch processing with progress tracking
- Retry handling with exponential backoff
- Re-export support (creates new entries in accounting provider)
- **Concurrent uploads** with provider-specific rate limiting
- **Adaptive rate limiting** (Xero) based on API quota tracking
- **Date-sorted exports** for chronological ordering in accounting software

---

### Architecture

```mermaid
flowchart TB
    subgraph Dashboard["Dashboard (UI)"]
        UI[React Components]
    end

    subgraph API["API Layer"]
        TRPC[tRPC Router]
        REST[REST API - OAuth]
    end

    subgraph AppData["@tamias/app-data"]
        TXN[(transactions)]
        APPS[(apps)]
        ATT[(transaction_attachments)]
    end

    subgraph Convex["Convex"]
        SYNC[(accountingSyncRecords)]
    end

    subgraph Worker["@tamias/worker - Cloudflare async worker"]
        PROC2[SyncAttachmentsProcessor]
        PROC3[ExportTransactionsProcessor]
    end

    subgraph Accounting["@tamias/accounting"]
        IFACE[AccountingProvider Interface]
        XERO[XeroProvider]
        QB[QuickBooksProvider]
        FNX[FortnoxProvider]
    end

    subgraph External["External APIs"]
        XERO_API[Xero API]
        QB_API[QuickBooks API]
        FNX_API[Fortnox API]
    end

    UI --> TRPC
    UI --> REST
    TRPC --> DB
    REST --> DB

    PROC3 --> PROC2

    PROC2 --> IFACE
    PROC3 --> IFACE

    IFACE --> XERO
    IFACE --> QB
    IFACE --> FNX

    XERO --> XERO_API
    QB --> QB_API
    FNX --> FNX_API

    PROC2 --> DB
    PROC3 --> DB
```

#### Package Structure

```
packages/accounting/
├── src/
│   ├── index.ts              # Factory and exports
│   ├── provider.ts           # AccountingProvider interface
│   ├── types.ts              # Shared types
│   ├── utils.ts              # OAuth state encryption, utilities
│   └── providers/
│       ├── xero.ts           # Xero implementation
│       ├── quickbooks.ts     # QuickBooks implementation
│       └── fortnox.ts        # Fortnox implementation
├── package.json
└── tsconfig.json

worker/src/
├── processors/accounting/
│   ├── index.ts              # Processor exports
│   ├── base.ts               # Shared processor logic
│   ├── sync-attachments.ts   # Attachment upload processor
│   └── export-transactions.ts# Manual export processor
├── cloudflare/
│   └── index.ts              # Cloudflare queue/workflow entrypoint
├── schemas/
│   └── accounting.ts         # Zod schemas for job payloads
└── utils/
    └── accounting-auth.ts    # Token refresh utilities
```

---

### Data Flow

#### Manual Export Flow

```mermaid
sequenceDiagram
    participant User
    participant Dashboard
    participant API
    participant ExportProcessor
    participant Database
    participant Provider
    participant AttachmentProcessor

    User->>Dashboard: Select transactions
    User->>Dashboard: Click "Export to Accounting"
    Dashboard->>API: POST /accounting/export
    API->>ExportProcessor: Trigger export job
    ExportProcessor->>Database: Load transactions
    Database-->>ExportProcessor: Transaction data

    loop For each batch (50)
        ExportProcessor->>Provider: syncTransactions()
        Provider-->>ExportProcessor: Results with IDs
        ExportProcessor->>Database: Upsert sync records

        alt Has attachments
            ExportProcessor->>AttachmentProcessor: Trigger attachment job
        end
    end

    ExportProcessor-->>Dashboard: Export complete
```

#### OAuth Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Dashboard
    participant API
    participant Provider
    participant Database

    User->>Dashboard: Click "Connect Provider"
    Dashboard->>API: GET /apps/{provider}/install-url
    API->>API: Generate encrypted state (teamId)
    API-->>Dashboard: Consent URL
    Dashboard->>Provider: Redirect to consent
    User->>Provider: Authorize access
    Provider->>API: Callback with code + state
    API->>API: Decrypt state, validate
    API->>Provider: Exchange code for tokens
    Provider-->>API: Access + refresh tokens
    API->>Database: Store tokens in apps.config
    API-->>Dashboard: Redirect to success
```

---

### Accounting Sync Store

`accountingSyncRecords` is stored in Convex and tracks export status for each transaction per provider.

```mermaid
erDiagram
    transactions ||--o{ accountingSyncRecords : "has sync status"
    transactions ||--o{ transaction_attachments : "has attachments"
    teams ||--o{ accountingSyncRecords : "owns"
    teams ||--o{ apps : "has integrations"

    transactions {
        uuid id PK
        uuid team_id FK
        date date
        numeric amount
        text name
        text status
        text category_slug
    }

    accountingSyncRecords {
        string id PK
        string transactionId
        string teamId
        string provider
        string providerTenantId
        string providerTransactionId
        string providerEntityType
        object syncedAttachmentMapping
        string syncedAt
        string createdAt
        string syncType
        string status
        string errorMessage
    }

    transaction_attachments {
        uuid id PK
        uuid transaction_id FK
        uuid team_id FK
        text name
        text[] path
        text type
        int size
    }

    apps {
        uuid id PK
        uuid team_id FK
        text app_id
        jsonb config
        jsonb settings
    }
```

#### apps.config Structure

OAuth tokens and settings stored in JSONB config field:

```typescript
interface AccountingProviderConfig {
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO timestamp
  tenantId: string; // Organization ID (realmId for QB)
  tenantName?: string; // Organization name
}
```

---

### Export Logic

#### Transaction Selection

Users manually select which transactions to export. The system validates that transactions are eligible:

| Condition          | Exports | Reason                   |
| ------------------ | ------- | ------------------------ |
| Status = pending   | Yes     | User can export anytime  |
| Status = completed | Yes     | User marked as done      |
| Status = excluded  | No      | User excluded from books |
| Status = archived  | No      | Old transaction          |

#### Re-export Behavior

- **Always creates new entries**: Re-exporting creates new transactions/vouchers in the accounting provider
- **No updates**: Accounting providers have limited or no update support (Fortnox vouchers are immutable)
- **Sync records updated**: The latest provider transaction ID is stored
- **User responsibility**: Users should delete old entries in accounting software if needed

#### Provider-Specific Behavior

| Provider   | Entity Type      | Idempotency         | Notes                             |
| ---------- | ---------------- | ------------------- | --------------------------------- |
| Xero       | BankTransaction  | `updateOrCreate`    | SPEND/RECEIVE, deterministic keys |
| QuickBooks | Purchase/Deposit | `Request-Id` header | Based on amount sign              |
| Fortnox    | Voucher          | None (immutable)    | Posted vouchers, double-entry     |

#### Important: Re-Export Behavior

- **Xero**: Uses `updateOrCreateBankTransactions` - re-exporting the same transaction **updates** it rather than creating duplicates
- **QuickBooks**: Uses idempotency headers but creates new entities on re-export
- **Fortnox**: Vouchers are **immutable** via API - re-exporting always creates a new voucher. Users must manually delete old vouchers in Fortnox if needed

---

### Authentication

#### Token Management

```mermaid
flowchart TD
    A[Job Start] --> B[Load config from DB]
    B --> C{Token expired?}
    C -->|No| D[Use current token]
    C -->|Yes| E[Call provider.refreshTokens]
    E --> F[Atomic DB update]
    F --> G[Return updated config]
    D --> H[Continue with API calls]
    G --> H
```

OAuth tokens are managed through the `ensureValidToken` utility:

```typescript
export const ensureValidToken = async (
  db: Database,
  provider: AccountingProvider,
  config: AccountingProviderConfig,
  teamId: string,
  providerId: string,
): Promise<AccountingProviderConfig> => {
  if (!provider.isTokenExpired(new Date(config.expiresAt))) {
    return config;
  }

  const newTokens = await provider.refreshTokens(config.refreshToken);

  await updateAppTokens(db, {
    teamId,
    appId: providerId,
    ...newTokens,
  });

  return { ...config, ...newTokens };
};
```

---

### Worker Jobs

#### Queue Configuration

```typescript
const accountingQueueOptions: QueueOptions = {
  defaultJobOptions: {
    attempts: 4,
    backoff: {
      type: "exponential",
      delay: 5 * 60 * 1000, // 5 minutes initial
    },
    removeOnComplete: { age: 24 * 3600, count: 100 },
    removeOnFail: { age: 7 * 24 * 3600, count: 500 },
  },
};
```

#### Retry Sequence

```mermaid
flowchart LR
    A[Attempt 1] -->|Fail| B[5 min delay]
    B --> C[Attempt 2]
    C -->|Fail| D[10 min delay]
    D --> E[Attempt 3]
    E -->|Fail| F[20 min delay]
    F --> G[Attempt 4]
    G -->|Fail| H[Permanent Failure]
```

#### Job Types

| Job Name                      | Processor                   | Trigger     | Purpose                        |
| ----------------------------- | --------------------------- | ----------- | ------------------------------ |
| `export-to-accounting`        | ExportTransactionsProcessor | User action | Export selected transactions   |
| `sync-accounting-attachments` | SyncAttachmentsProcessor    | Export job  | Upload attachments to provider |

---

### API Reference

#### AccountingProvider Interface

```typescript
interface AccountingProvider {
  // OAuth
  buildConsentUrl(state: string): Promise<string>;
  exchangeCodeForTokens(code: string): Promise<TokenSet>;
  refreshTokens(refreshToken: string): Promise<TokenSet>;
  isTokenExpired(expiresAt: Date, bufferSeconds?: number): boolean;

  // Tenant Info
  getTenantInfo(tenantId: string): Promise<TenantInfo>;
  getTenants(): Promise<TenantInfo[]>;

  // Accounts
  getAccounts(tenantId: string): Promise<AccountingAccount[]>;

  // Transactions
  syncTransactions(params: SyncTransactionsParams): Promise<SyncResult>;

  // Attachments
  uploadAttachment(params: UploadAttachmentParams): Promise<AttachmentResult>;
  deleteAttachment(params: DeleteAttachmentParams): Promise<DeleteAttachmentResult>;

  // Health Check
  checkConnection(): Promise<{ connected: boolean; error?: string }>;

  // Cleanup (optional)
  disconnect?(): Promise<void>;
}
```

#### Database Queries

```typescript
// Get transactions for export
getTransactionsForAccountingSync(db, {
  teamId: string,
  provider: ProviderType,
  transactionIds: string[],  // Required for manual export
  limit?: number,
}): Promise<TransactionForSync[]>

// Upsert sync record
upsertAccountingSyncRecord(db, {
  transactionId: string,
  teamId: string,
  provider: ProviderType,
  providerTenantId: string,
  providerTransactionId?: string,
  providerEntityType?: string,
  // Maps Tamias attachment IDs to provider attachment IDs
  syncedAttachmentMapping?: Record<string, string | null>,
  syncType: 'manual',
  status: 'synced' | 'failed' | 'pending',
  errorMessage?: string,
}): Promise<AccountingSyncRecord>

// Update attachment mapping after sync
updateSyncedAttachmentMapping(db, {
  syncRecordId: string,
  syncedAttachmentMapping: Record<string, string | null>,
}): Promise<AccountingSyncRecord>
```

---

### Configuration

#### Environment Variables

```bash
# Xero
XERO_CLIENT_ID=your_client_id
XERO_CLIENT_SECRET=your_client_secret
XERO_OAUTH_REDIRECT_URL=https://api.tamias.xyz/v1/apps/xero/oauth-callback

# QuickBooks
QUICKBOOKS_CLIENT_ID=your_client_id
QUICKBOOKS_CLIENT_SECRET=your_client_secret
QUICKBOOKS_OAUTH_REDIRECT_URL=https://api.tamias.xyz/v1/apps/quickbooks/oauth-callback

# Fortnox
FORTNOX_CLIENT_ID=your_client_id
FORTNOX_CLIENT_SECRET=your_client_secret
FORTNOX_OAUTH_REDIRECT_URL=https://api.tamias.xyz/v1/apps/fortnox/oauth-callback

# OAuth state encryption
ACCOUNTING_OAUTH_SECRET=32_byte_encryption_key
```

---

### Error Handling

#### Retry Strategy

| Error Type         | Retry | Notes                    |
| ------------------ | ----- | ------------------------ |
| Network timeout    | Yes   | Exponential backoff      |
| Rate limit (429)   | Yes   | Backoff allows recovery  |
| Auth failure (401) | Yes   | Token refresh attempted  |
| Invalid data (400) | No    | Logged, marked as failed |
| Server error (5xx) | Yes   | Provider may recover     |

#### Error Recording

Failed exports are recorded with error details:

```typescript
await upsertAccountingSyncRecord(db, {
  transactionId: tx.id,
  teamId,
  provider: providerId,
  status: "failed",
  errorMessage: error.message,
});
```

---

### Security Considerations

1. **Token Storage**: OAuth tokens stored encrypted in database
2. **State Parameter**: OAuth state encrypted with HMAC to prevent CSRF
3. **RLS Policies**: Database enforces team-level access control
4. **API Keys**: Provider credentials stored in environment variables
5. **Audit Trail**: Sync records provide full export history

---

### Rate Limiting & Reliability

#### Provider Rate Limits (2025)

| Provider   | Calls/Min | Concurrent | Daily | Notes         |
| ---------- | --------- | ---------- | ----- | ------------- |
| Xero       | 60        | 5          | 5,000 | Per tenant    |
| QuickBooks | 500       | 10         | None  | Per realm     |
| Fortnox    | ~300      | 3          | None  | ~25/5 seconds |

#### Job-Level Rate Limiting

Attachment jobs are created with **calculated delays** to stay under rate limits:

```typescript
// export-transactions.ts
function calculateAttachmentJobDelay(providerId: string, jobIndex: number): number {
  const rateLimit = RATE_LIMITS[providerId]?.callsPerMinute ?? 60;
  const msPerJob = Math.ceil((60000 / rateLimit) * 1.1); // 1.1x buffer
  return jobIndex * msPerJob;
}
// Xero: Job 0 = 0ms, Job 1 = 1100ms, Job 2 = 2200ms, ...
```

**Benefits:**

- Jobs are in "delayed" state, not blocking workers
- Different teams process in parallel (no blocking)
- Zero rate limit errors (jobs are pre-spaced)
- No runtime rate limit checking needed

#### Within-Job Concurrency

For transactions with multiple attachments, uploads are batched:

```typescript
const RATE_LIMITS = {
  xero: { maxConcurrent: 3, callDelayMs: 1500 },
  quickbooks: { maxConcurrent: 10, callDelayMs: 200 },
  fortnox: { maxConcurrent: 3, callDelayMs: 600 },
};
```

#### Transaction Sorting

All providers sort transactions by date before export:

- Ensures chronological order in accounting software
- Fortnox: Voucher numbers assigned in creation order
- Xero/QuickBooks: Cleaner transaction lists

#### Estimated Export Times

| Transactions + Attachments | Xero    | QuickBooks | Fortnox |
| -------------------------- | ------- | ---------- | ------- |
| 200                        | ~4 min  | ~30 sec    | ~1 min  |
| 1000                       | ~18 min | ~2 min     | ~4 min  |
| 2000                       | ~37 min | ~4 min     | ~8 min  |

**Note:** Xero has a daily limit of 5,000 calls. Exports larger than ~4,500 attachments may span multiple days.

---

### Limitations

1. **No Updates**: Re-exporting creates new entries; existing entries cannot be updated
2. **Attachment Deletion**: Partial support - QuickBooks and Fortnox support deletion, Xero does not (attachments remain in Xero)
3. **Bank Account Mapping**: Currently uses first active account; multi-account mapping planned
4. **Rate Limits**: Subject to provider API rate limits (handled automatically with throttling)
5. **Fortnox Vouchers**: Created as posted entries (Fortnox API doesn't support draft vouchers via API)

---

## Accounting sync architecture (deep dive)

Deep technical documentation of the accounting sync system architecture.

### System Components

#### Provider Abstraction Layer

```mermaid
classDiagram
    class AccountingProvider {
        <<interface>>
        +getConsentUrl(state) string
        +exchangeCodeForTokens(code) TokenResponse
        +refreshTokens(refreshToken) TokenResponse
        +isTokenExpired(expiresAt) boolean
        +getAccounts(tenantId) AccountingAccount[]
        +syncTransactions(params) SyncResult
        +uploadAttachment(params) AttachmentResult
    }

    class XeroProvider {
        -client: XeroClient
        +getConsentUrl(state) string
        +exchangeCodeForTokens(code) TokenResponse
        +refreshTokens(refreshToken) TokenResponse
        +isTokenExpired(expiresAt) boolean
        +getAccounts(tenantId) AccountingAccount[]
        +syncTransactions(params) SyncResult
        +uploadAttachment(params) AttachmentResult
    }

    class QuickBooksProvider {
        <<planned>>
    }

    class FortnoxProvider {
        <<planned>>
    }

    AccountingProvider <|.. XeroProvider
    AccountingProvider <|.. QuickBooksProvider
    AccountingProvider <|.. FortnoxProvider
```

#### Worker Pipeline

```mermaid
flowchart TB
    subgraph AsyncQueue["Cloudflare Queue"]
        Q[accounting queue]
    end

    subgraph Registry["Processor Registry"]
        R[Route by job name]
    end

    subgraph Processors["Processors"]
        P1[SyncTransactionsProcessor]
        P2[SyncAttachmentsProcessor]
        P3[ExportTransactionsProcessor]
        P4[SyncSchedulerProcessor]
    end

    Q --> R
    R -->|sync-accounting-transactions| P1
    R -->|sync-accounting-attachments| P2
    R -->|export-to-accounting| P3
    R -->|accounting-sync-scheduler| P4

    P1 --> |triggers| P2
    P4 --> |triggers| P1
```

#### Data Layer

```mermaid
erDiagram
    teams ||--o{ transactions : "owns"
    teams ||--o{ apps : "has"
    teams ||--o{ accountingSyncRecords : "owns"

    transactions ||--o{ transaction_attachments : "has"
    transactions ||--o{ accountingSyncRecords : "tracked by"

    transactions {
        uuid id PK
        uuid team_id FK
        date date
        numeric amount
        text name
        text description
        text status
        text category_slug
    }

    transaction_attachments {
        uuid id PK
        uuid transaction_id FK
        uuid team_id FK
        text name
        text_array path
        text type
        int size
    }

    apps {
        uuid id PK
        uuid team_id FK
        text app_id
        jsonb config
        jsonb settings
    }

    accountingSyncRecords {
        string id PK
        string transactionId
        string teamId
        string provider
        string providerTenantId
        string providerTransactionId
        object syncedAttachmentMapping
        string syncedAt
        string syncType
        string status
        text error_message
    }
```

---

### Sync Algorithm

#### Phase 1: Transaction Selection

```mermaid
flowchart TD
    A[Start Sync Job] --> B[Get synced transaction IDs]
    B --> C[Query fulfilled transactions]
    C --> D{Has results?}
    D -->|No| E[Return empty result]
    D -->|Yes| F[Map to provider format]
    F --> G[Process in batches]

    subgraph Query["Fulfilled Query"]
        C1[team_id matches]
        C2[status NOT IN excluded, archived]
        C3[NOT already synced]
        C4[date within range]
        C5[has attachments OR status = completed]
        C1 --> C2 --> C3 --> C4 --> C5
    end
```

#### Phase 2: Batch Processing

```mermaid
flowchart TD
    A[Batch of 50 transactions] --> B[Call provider.syncTransactions]
    B --> C{Success?}

    C -->|Yes| D[Record as synced]
    C -->|No| E[Record as failed]

    D --> F{Has attachments?}
    F -->|Yes| G[Trigger attachment job]
    F -->|No| H[Continue to next batch]

    E --> H
    G --> H

    H --> I{More batches?}
    I -->|Yes| A
    I -->|No| J[Check attachment updates]
```

#### Phase 3: Attachment Detection

```mermaid
flowchart TD
    A[Query synced records] --> B[JOIN with current attachments]
    B --> C[Compare synced_attachment_ids vs current]

    C --> D{New attachments found?}
    D -->|No| E[Done]
    D -->|Yes| F[For each transaction with changes]

    F --> G[Trigger attachment sync job]
    G --> H{More transactions?}
    H -->|Yes| F
    H -->|No| E
```

---

### Token Lifecycle

#### Refresh Flow

```mermaid
stateDiagram-v2
    [*] --> CheckExpiry: Job starts

    CheckExpiry --> Valid: Token not expired
    CheckExpiry --> Refresh: Token expired

    Refresh --> UpdateDB: Get new tokens
    UpdateDB --> Valid: Atomic update complete

    Valid --> [*]: Continue with API calls

    Refresh --> Error: Refresh failed
    Error --> [*]: Throw error, job retries
```

#### Atomic Update

```mermaid
sequenceDiagram
    participant Job
    participant Provider
    participant Database

    Job->>Provider: refreshTokens(refreshToken)
    Provider-->>Job: New tokens

    Job->>Database: UPDATE apps SET config = config || new_tokens
    Note over Database: JSONB merge preserves other fields
    Database-->>Job: Success

    Job->>Job: Update local config reference
```

---

### Retry Mechanism

#### Async Runtime Configuration

```mermaid
flowchart LR
    subgraph Attempt1["Attempt 1"]
        A1[Execute]
    end

    subgraph Delay1["Delay"]
        D1[5 minutes]
    end

    subgraph Attempt2["Attempt 2"]
        A2[Execute]
    end

    subgraph Delay2["Delay"]
        D2[10 minutes]
    end

    subgraph Attempt3["Attempt 3"]
        A3[Execute]
    end

    subgraph Delay3["Delay"]
        D3[20 minutes]
    end

    subgraph Attempt4["Attempt 4"]
        A4[Execute]
    end

    subgraph Final["Final"]
        F[Permanent Failure]
    end

    A1 -->|fail| D1 --> A2
    A2 -->|fail| D2 --> A3
    A3 -->|fail| D3 --> A4
    A4 -->|fail| F

    A1 -->|success| S1[Done]
    A2 -->|success| S2[Done]
    A3 -->|success| S3[Done]
    A4 -->|success| S4[Done]
```

#### Error Classification

```mermaid
flowchart TD
    E[Error Occurred] --> T{Error Type}

    T -->|Network Timeout| R1[Retry with backoff]
    T -->|Rate Limit 429| R2[Retry with backoff]
    T -->|Auth Error 401| R3[Refresh token, retry]
    T -->|Bad Request 400| F1[Mark failed, no retry]
    T -->|Not Found 404| F2[Mark failed, no retry]
    T -->|Server Error 5xx| R4[Retry with backoff]

    R1 --> Q[Back to queue]
    R2 --> Q
    R3 --> Q
    R4 --> Q

    F1 --> D[Record in database]
    F2 --> D
```

---

### Concurrency Model

#### Queue Worker Settings

```typescript
const workerOptions: WorkerOptions = {
  concurrency: 10, // Max 10 jobs in parallel
  lockDuration: 300000, // 5 minute lock (API can be slow)
  stalledInterval: 5 * 60 * 1000,
  maxStalledCount: 1,
  limiter: {
    max: 20, // Max 20 jobs per second
    duration: 1000,
  },
};
```

#### Job Isolation

```mermaid
flowchart TB
    subgraph Worker["Worker Process"]
        subgraph Job1["Job 1 (Team A)"]
            DB1[DB Connection]
            TOK1[Token State]
            PROC1[Processing]
        end

        subgraph Job2["Job 2 (Team B)"]
            DB2[DB Connection]
            TOK2[Token State]
            PROC2[Processing]
        end

        subgraph Job3["Job 3 (Team C)"]
            DB3[DB Connection]
            TOK3[Token State]
            PROC3[Processing]
        end
    end

    Queue[(Cloudflare Queue)] --> Worker
    DataStore[(Application Data Store)] --> DB1
    DataStore --> DB2
    DataStore --> DB3
```

---

### Data Mapping

#### Tamias to Xero Transaction Mapping

```mermaid
flowchart LR
    subgraph Tamias["Tamias Transaction"]
        M1[id]
        M2[date]
        M3[amount]
        M4[currency]
        M5[name]
        M6[description]
        M7[categorySlug]
    end

    subgraph Xero["Xero BankTransaction"]
        X1[Reference]
        X2[Date]
        X3[LineItems.UnitAmount]
        X4[CurrencyCode]
        X5[Contact.Name]
        X6[LineItems.Description]
        X7[LineItems.AccountCode]
        X8[Type]
    end

    M1 -->|first 8 chars| X1
    M2 --> X2
    M3 -->|abs value| X3
    M3 -->|positive = RECEIVE| X8
    M3 -->|negative = SPEND| X8
    M4 --> X4
    M5 --> X5
    M5 --> X6
    M6 --> X6
    M7 -->|if mapped| X7
```

#### Attachment Upload Flow

```mermaid
sequenceDiagram
    participant Processor
    participant Database
    participant Storage
    participant Provider

    Processor->>Database: Get attachment metadata
    Database-->>Processor: id, name, path, type, size

    Processor->>Storage: Download from vault
    Storage-->>Processor: File blob

    Processor->>Processor: Convert to Buffer

    Processor->>Provider: Upload attachment
    Note over Provider: POST /BankTransactions/{id}/Attachments
    Provider-->>Processor: Attachment ID

    Processor->>Database: Update synced_attachment_ids
```

---

### Performance Characteristics

#### Query Complexity

| Query                     | Complexity | Index Used                        |
| ------------------------- | ---------- | --------------------------------- |
| Get synced IDs            | O(n)       | idx_accounting_sync_team_provider |
| Get transactions for sync | O(n log n) | transactions PK + team_id         |
| Detect attachment changes | O(n)       | Single JOIN, grouped              |
| Upsert sync record        | O(1)       | Unique constraint                 |

#### Batch Sizes

| Operation         | Batch Size | Rationale                            |
| ----------------- | ---------- | ------------------------------------ |
| Transaction sync  | 50         | Balance between API calls and memory |
| Attachment upload | 1          | Sequential for error isolation       |
| Progress updates  | Per batch  | User feedback without overhead       |

#### Rate Limits

| Provider | Limit           | Tamias Handling                             |
| -------- | --------------- | ------------------------------------------- |
| Xero     | 60 calls/minute | Async worker concurrency + provider backoff |
| Xero     | 5000 calls/day  | Batch processing reduces calls              |

---

### Security Model

#### Data Access

```mermaid
flowchart TD
    subgraph RLS["Row Level Security"]
        P1[SELECT: team_id IN user_teams]
        P2[INSERT: team_id IN user_teams]
        P3[UPDATE: team_id IN user_teams]
    end

    subgraph Tables["Protected Tables"]
        T1[accountingSyncRecords]
        T2[transactions]
        T3[apps]
    end

    subgraph Worker["Worker Access"]
        W[Service Role Key]
    end

    RLS --> T1
    RLS --> T2
    RLS --> T3

    W -->|Bypasses RLS| T1
    W -->|Bypasses RLS| T2
    W -->|Bypasses RLS| T3
```

#### Secret Storage

| Secret Type            | Storage          | Access                  |
| ---------------------- | ---------------- | ----------------------- |
| OAuth Client ID/Secret | Environment vars | Worker process only     |
| Access Token           | apps.config (DB) | Encrypted at rest       |
| Refresh Token          | apps.config (DB) | Encrypted at rest       |
| OAuth State            | Encrypted string | HMAC with server secret |

---

## Categories and tax

A comprehensive financial category system for SMBs with international tax rate support.

### Features

- **Hierarchical Categories**: Parent-child structure for comprehensive financial reporting
- **International Tax Rates**: Support for 31+ countries with VAT/GST/sales tax rates
- **Backward Compatibility**: Preserves existing category slugs
- **Built-in Names**: All categories include display names

### Installation

```bash
bun add @tamias/categories
```

### Usage

#### Basic Category Access

```typescript
import { CATEGORIES, getCategoryBySlug, getParentCategory } from "@tamias/categories";

// Get all categories
const allCategories = CATEGORIES;

// Find a specific category
const softwareCategory = getCategoryBySlug("software");

// Get parent category
const parent = getParentCategory("software"); // Returns 'technology'
```

#### Tax Rate Lookup

```typescript
import { getTaxRateForCategory, getTaxTypeForCountry } from "@tamias/categories";

// Get tax rate for a category in a specific country
const taxRate = getTaxRateForCategory("SE", "meals"); // Returns 12 (Sweden, reduced rate)

// Get tax type for a country
const taxType = getTaxTypeForCountry("SE"); // Returns 'vat'
```

#### Category Names

All categories include built-in display names that can be used directly:

```typescript
// Access category names directly
const revenueCategory = getCategoryBySlug("revenue");
console.log(revenueCategory.name); // "Revenue"

const officeSupplies = getCategoryBySlug("office-supplies");
console.log(officeSupplies.name); // "Office Supplies"
```

#### Category Colors

Each category has a predefined color for consistent UI representation:

```typescript
import { getCategoryColor, CATEGORY_COLOR_MAP } from "@tamias/categories";

// Get color for any category
const revenueColor = getCategoryColor("revenue"); // "#00D084" (Green)
const officeSuppliesColor = getCategoryColor("office-supplies"); // "#8ED1FC" (Sky Blue)

// Access the complete color map
const allColors = CATEGORY_COLOR_MAP;
```

**Color Philosophy:**

- **Revenue categories**: Green variations (income, growth)
- **Cost categories**: Orange variations (expenses, caution)
- **Each parent category**: Distinct base color
- **Child categories**: Harmonious variations of parent color

### Category Structure

The system includes 14 parent categories:

1. **Revenue** - Business income streams
2. **Cost of Goods Sold** - Direct production costs
3. **Sales & Marketing** - Marketing and sales expenses
4. **Operations** - Day-to-day operational costs
5. **Professional Services** - External professional services
6. **Human Resources** - Employee-related costs
7. **Travel & Entertainment** - Business travel and entertainment
8. **Technology** - Software and tech subscriptions
9. **Banking & Finance** - Financial services and fees
10. **Assets & CapEx** - Capital expenditures
11. **Liabilities & Debt** - Debt obligations
12. **Taxes & Government** - Tax payments and government fees
13. **Owner / Equity** - Owner transactions and investments
14. **System** - System categories (uncategorized, other)

### Supported Countries

The package includes tax rate configurations for:

- **Nordic**: SE, FI, NO, DK
- **EU**: DE, FR, NL, BE, AT, IT, ES, PL, CZ, PT, LU, EE, LV, LT, SK, SI, RO, HU
- **Other**: US, GB, CA, AU, NZ, CH, IE, TR

### Migration

Existing transactions using legacy category slugs (e.g., "office-supplies", "travel") will continue to work without any data migration needed.

### API Reference

See the TypeScript types for complete API documentation.

---

## Inbox connectors

Email inbox integration package for syncing PDF attachments from Gmail and Outlook accounts.

### Overview

This package provides OAuth-based email provider integrations that:

- Connect user email accounts via OAuth 2.0
- Sync PDF attachments from incoming emails
- Handle token refresh and expiration automatically
- Provide structured error handling for robust sync operations

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     InboxConnector                          │
│  - Orchestrates provider selection                          │
│  - Handles token decryption/encryption                      │
│  - Manages retry logic with token refresh                   │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│      GmailProvider      │     │     OutlookProvider     │
│  - Google OAuth2        │     │  - Microsoft OAuth2     │
│  - Gmail API v1         │     │  - Microsoft Graph API  │
│  - Proactive refresh    │     │  - Custom AuthProvider  │
└─────────────────────────┘     └─────────────────────────┘
              │                               │
              └───────────────┬───────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Structured Errors                        │
│  - InboxAuthError (authentication/authorization)            │
│  - InboxSyncError (transient sync issues)                   │
└─────────────────────────────────────────────────────────────┘
```

### Usage

#### Connecting an Account

```typescript
import { InboxConnector } from "@tamias/inbox/connector";

const connector = new InboxConnector("gmail");

// Get OAuth URL for user to authorize
const authUrl = await connector.connect();

// After user authorizes, exchange code for account
const account = await connector.exchangeCodeForAccount({
  code: authorizationCode,
  teamId: "team_123",
});
```

#### Syncing Attachments

```typescript
const attachments = await connector.getAttachments({
  id: accountId,
  teamId: "team_123",
  maxResults: 50,
  fullSync: false, // true for initial/manual sync
});

for (const attachment of attachments) {
  console.log(attachment.filename, attachment.size);
  // attachment.data contains the file buffer
}
```

### Error Handling

The package uses structured error classes for type-safe error handling.

#### Error Types

##### InboxAuthError

Authentication and authorization errors. Check `requiresReauth` to determine if user action is needed.

```typescript
import { InboxAuthError, isInboxAuthError } from "@tamias/inbox/errors";

try {
  await connector.getAttachments(options);
} catch (error) {
  if (isInboxAuthError(error)) {
    console.log(error.code); // "token_expired" | "refresh_token_invalid" | ...
    console.log(error.provider); // "gmail" | "outlook"
    console.log(error.requiresReauth); // true = user must reconnect

    if (error.requiresReauth) {
      // Mark account as disconnected, prompt user to reconnect
    } else {
      // Transient error, retry may succeed
    }
  }
}
```

**Error Codes:**
| Code | Description | Requires Reauth |
|------|-------------|-----------------|
| `token_expired` | Access token expired | Usually yes |
| `token_invalid` | Access token is invalid | Yes |
| `refresh_token_expired` | Refresh token expired | Yes |
| `refresh_token_invalid` | Refresh token missing/invalid | Yes |
| `unauthorized` | General 401 error | Yes |
| `forbidden` | Permission denied (403) | Yes |
| `consent_required` | User must re-consent (Outlook) | Yes |
| `mfa_required` | MFA challenge required (Outlook) | Yes |

##### InboxSyncError

Non-authentication sync errors. These are typically transient.

```typescript
import { InboxSyncError } from "@tamias/inbox/errors";

if (error instanceof InboxSyncError) {
  console.log(error.code); // "fetch_failed" | "rate_limited" | ...
  console.log(error.isRetryable()); // true for network/rate limit errors
}
```

**Error Codes:**
| Code | Description | Retryable |
|------|-------------|-----------|
| `fetch_failed` | General fetch failure | Maybe |
| `rate_limited` | API rate limit hit | Yes |
| `network_error` | Network connectivity issue | Yes |
| `provider_error` | Provider-specific error | Maybe |

#### Type Guards and Assertions

```typescript
import {
  isInboxAuthError,
  isInboxSyncError,
  assertInboxAuthError,
  assertInboxSyncError,
} from "@tamias/inbox/errors";

// Type guards (return boolean)
if (isInboxAuthError(error)) {
  // error is InboxAuthError
}

// Assertions (narrow type, throw if wrong)
assertInboxAuthError(error);
// error is now InboxAuthError
```

### Token Management

Both providers implement proactive token refresh:

1. **5-minute buffer**: Tokens are refreshed 5 minutes before expiration
2. **Concurrency protection**: Only one refresh operation runs at a time
3. **Automatic persistence**: Refreshed tokens are saved to the database
4. **Token rotation support**: New refresh tokens (if issued) are stored

```typescript
// Providers handle this internally, but you can force a refresh:
await provider.refreshTokens();
```

### Exports

```typescript
// Main connector
import { InboxConnector } from "@tamias/inbox/connector";

// Error classes and utilities
import {
  InboxAuthError,
  InboxSyncError,
  isInboxAuthError,
  isInboxSyncError,
  assertInboxAuthError,
  assertInboxSyncError,
} from "@tamias/inbox/errors";

// Utility functions
import { isAuthenticationError } from "@tamias/inbox/utils";
```

### Environment Variables

#### Gmail

- `GMAIL_CLIENT_ID` - Google OAuth client ID
- `GMAIL_CLIENT_SECRET` - Google OAuth client secret
- `GMAIL_REDIRECT_URI` - OAuth callback URL

#### Outlook

- `OUTLOOK_CLIENT_ID` - Microsoft OAuth client ID
- `OUTLOOK_CLIENT_SECRET` - Microsoft OAuth client secret
- `OUTLOOK_REDIRECT_URI` - OAuth callback URL

---

## Data & AI insights

AI-powered business insights generation for Tamias. This package provides smart metric selection, anomaly detection, and narrative content generation for periodic business summaries.

### Overview

The insights package generates weekly, monthly, quarterly, and yearly business summaries by:

1. **Fetching financial and activity data** from the database
2. **Calculating metrics** with period-over-period comparisons
3. **Selecting the most relevant metrics** using a smart scoring algorithm
4. **Detecting anomalies** (significant changes, low runway, negative profit)
5. **Generating AI-powered narratives** that explain the data in plain language

### Usage

```typescript
import { createInsightsService } from "@tamias/insights";
import { db } from "@tamias/app-data/client";

const service = createInsightsService(db);

const result = await service.generateInsight({
  teamId: "team-uuid",
  periodType: "weekly",
  periodStart: new Date("2024-01-08"),
  periodEnd: new Date("2024-01-14"),
  periodLabel: "Week 2, 2024",
  periodYear: 2024,
  periodNumber: 2,
  currency: "USD",
});

// Result contains:
// - selectedMetrics: Top 4 most relevant metrics
// - allMetrics: Full metrics snapshot
// - anomalies: Detected issues/alerts
// - activity: Invoice, time tracking, customer activity
// - content: AI-generated narrative (sentiment, opener, story, actions)
```

### Environment Variables

```bash
# Required for AI content generation
OPENAI_API_KEY=sk-...
```

### Architecture

```
@tamias/insights
├── index.ts          # InsightsService + team filtering helpers
├── types.ts          # TypeScript type definitions
├── constants.ts      # Configuration constants
├── schemas.ts        # Zod validation schemas
├── metrics/
│   ├── analyzer.ts   # Smart metric selection + anomaly detection
│   ├── calculator.ts # Metric value calculations
│   └── definitions.ts # Metric metadata (labels, units, categories)
├── content/
│   ├── generator.ts  # AI content generation using OpenAI
│   └── prompts.ts    # Prompt templates
└── period/
    └── utils.ts      # Date range calculations for different periods
```

### Key Concepts

#### Smart Metric Selection

Not all metrics are equally important. The `selectTopMetrics()` function scores metrics based on:

- **Priority**: Core financial metrics (revenue, profit) rank higher
- **Data presence**: Metrics with actual data score higher
- **Significant changes**: Large period-over-period changes are prioritized
- **Anomalies**: Low runway or negative profit get boosted
- **Category diversity**: Max 2 metrics from the same category

#### Anomaly Detection

The `detectAnomalies()` function identifies:

- Significant increases/decreases (>25% change)
- Low runway warnings (<6 months)
- Negative profit alerts
- Negative cash flow
- Overdue invoices

#### Period Types

Supports four period types with automatic date calculations:

- `weekly` - ISO week numbers (1-53)
- `monthly` - Calendar months (1-12)
- `quarterly` - Q1-Q4
- `yearly` - Full year

#### Team Filtering (Staging)

For staged rollouts, use the `INSIGHTS_ENABLED_TEAM_IDS` environment variable:

```bash
# Specific teams only
INSIGHTS_ENABLED_TEAM_IDS=uuid-1,uuid-2,uuid-3

# All teams (production)
INSIGHTS_ENABLED_TEAM_IDS=*

# Disabled (default, safe for staging)
INSIGHTS_ENABLED_TEAM_IDS=
```

Check with:

```typescript
import { isTeamEnabledForInsights, getEnabledTeamIds } from "@tamias/insights";

if (isTeamEnabledForInsights(teamId)) {
  // Generate insights
}
```

### Testing

```bash
cd packages/insights
bun test
```

---

## Assistant prompt templates

The API assistant uses markdown templates in **`agent-prompts/`** (`memory-template.md`, `title-instructions.md`, `suggestions-instructions.md`). They are embedded into `api/src/ai/agents/config/generated-prompts.ts` by:

```bash
bun run --cwd api prompts:generate
```

Edit the `.md` files under **`agent-prompts/`**; do not hand-edit the generated TS.
