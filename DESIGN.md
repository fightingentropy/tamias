# Tamias Design Reference

This document captures the current design language of the app so new pages match what is already shipped. It is based on the implemented UI in `apps/dashboard` and `packages/ui`, not on aspirational design ideas.

Use this as the default reference when building new pages, widgets, forms, tables, or public-facing screens.

## Scope

There are two distinct visual modes in the product:

1. **Authenticated product UI**
   - The main app shell used for dashboard, transactions, invoices, inbox, tracker, customers, vault, settings, and compliance.
   - This is the primary design system and should drive most new work.
2. **Public and auth surfaces**
   - Homepage, pricing-style sections, and login.
   - These are more expressive and editorial, but still inherit the same typefaces and restrained palette.

When in doubt, match the authenticated product UI unless the page is clearly marketing or authentication.

## Source Of Truth

The most important files for the design system are:

- `packages/ui/src/globals.css`
- `packages/ui/tailwind.config.ts`
- `packages/ui/src/components/*`
- `apps/dashboard/src/styles/globals.css`
- `apps/dashboard/src/app/[locale]/layout.tsx`
- `apps/dashboard/src/app/[locale]/(app)/(sidebar)/layout.tsx`
- `apps/dashboard/src/components/sidebar.tsx`
- `apps/dashboard/src/components/header.tsx`
- `apps/dashboard/src/components/widgets/*`
- `apps/dashboard/src/components/metrics/*`
- `apps/dashboard/src/components/tables/*`
- `apps/dashboard/src/components/forms/*`
- `apps/dashboard/src/components/sheets/*`
- `apps/dashboard/src/components/public-homepage.tsx`
- `apps/dashboard/src/app/[locale]/(public)/login/page.tsx`

## Design Character

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

## Color And Theme

### Core palette

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

### Working rules

- Prefer token-backed colors first: `background`, `foreground`, `border`, `muted`, `muted-foreground`, `card`.
- Existing product chrome also uses repeated explicit values such as `#f7f7f7`, `#e6e6e6`, `#878787`, `#666666`, `#1d1d1d`, and `#131313`.
- If a new component is part of the authenticated shell, it should look natural next to those values.
- Color is usually reserved for data semantics, status, or media, not for structural UI.

### Shape

- Global radius token is `0.5rem`, but many important surfaces feel flatter than that.
- Badges, tables, skeletons, and many menu treatments are square or nearly square.
- New internal UI should prefer crisp geometry over soft consumer-app rounding.

## Typography

The app uses:

- `Hedvig Letters Sans` for most interface text
- `Hedvig Letters Serif` for selected headings and editorial accents

### Product shell typography

- Controls and body copy are generally sans.
- Most labels are small and quiet.
- Common muted label styles are `text-xs` or `text-sm` with `#878787` or `#666666`.
- Page utility copy is understated rather than promotional.

### Common sizes

- Dashboard greeting: about `30px`, serif
- Standard page title areas: modest, not oversized
- Widget titles and labels: `text-xs` to `text-sm`
- Muted descriptions: `text-sm` or `text-[14px]`
- Form labels: usually `text-xs`

### Usage rules

- Use serif sparingly.
- Serif belongs in greetings, occasional hero headings, or editorial moments.
- Do not use serif for dense controls, table UIs, or long-form operational content.

## Layout Architecture

### App shell

The authenticated app uses a fixed left rail and a persistent top header.

- Sidebar widths:
  - collapsed: `70px`
  - expanded: `240px`
- Header height: `70px`
- Main content offset on desktop: `md:ml-[70px]`
- Page padding: `px-4 md:px-8`

The shell is desktop-first. Mobile relies on a menu sheet rather than a permanently visible sidebar.

### Header behavior

- The header can hide/reveal on scroll.
- Pages that should move with that behavior use `ScrollableContent` or related wrappers that translate based on `--header-offset`.
- Data pages should respect this pattern instead of inventing their own sticky-stack behavior.

### Spatial rhythm

Common spacing patterns:

- `gap-6` between major sections
- `p-6` inside cards, sheets, and major surfaced blocks
- `h-9` controls
- summary grids use `gap-4 sm:gap-6`

The product generally uses tight, repeatable spacing rather than dramatic whitespace.

## Navigation

### Sidebar

The sidebar is utilitarian:

- fixed left rail
- border-right separator
- no decorative background treatment
- hover expansion on desktop
- icon-first collapsed state

### Menu items

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

## Page Anatomy

Most authenticated pages use one of a few repeatable structures.

### Data table pages

Typical pattern:

1. optional summary cards
2. utility header with search, filters, views, and actions
3. large data table

Examples: invoices, customers, transactions.

Rules:

- Keep tools close to the dataset they act on.
- Use wide, dense tables as a primary layout, not as a small card nested inside another card.
- Prefer one strong page composition over stacked miscellaneous panels.

### Dashboard pages

The dashboard uses:

- a greeting header with serif accent
- overview/metrics toggle
- draggable widgets or metric cards
- regular grid spacing with fixed-height blocks

Widgets and metric cards are not decorative cards. They are working surfaces.

### Detail and utility pages

Pages like vault or settings are simpler:

- short top header
- immediate access to the core surface below
- minimal hero treatment

## Core Component Language

### Buttons

Buttons are compact and squared-off.

- default height is `h-9`
- icon buttons are `h-9 w-9`
- outline and ghost variants are used heavily in the product shell

Use buttons as tools, not as large promotional CTAs, unless on marketing pages.

### Inputs and selects

Inputs, textareas, and selects are:

- compact
- bordered
- transparent or subdued in fill
- text-first rather than decorative

Use `h-9` controls as the default. Do not introduce oversized consumer-style inputs in internal screens.

### Cards

Internal cards are mostly:

- bordered
- flat or lightly elevated
- neutral in fill
- generous enough for readability, but still dense

Typical card padding is `p-6`.

### Badges and tags

Tags are understated and often square-edged. Use them as metadata, not as visual flair.

### Sheets and dialogs

Editing and creation often happen in sheets rather than full-page flows.

Sheet characteristics:

- right-side sheet
- max width around `520px`
- neutral overlay
- bordered panel
- `p-6` interior

Dialogs follow the same restrained treatment.

If a task is a focused create/edit flow, prefer a sheet before inventing a separate page.

## Forms

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

## Tables

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

## Widgets And Metrics

Dashboard widgets and metric cards define another major pattern.

### Widgets

- fixed height around `210px`
- bordered shell
- neutral background
- tiny muted labels
- small bottom actions
- drag customization with wiggle animation

### Metrics

- first chart spans full width
- following charts appear in two-column rows on large screens
- cards use `p-6`
- values are prominent, but still calm
- legends are tiny and unobtrusive

### Charts

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

## States And Feedback

### Empty states

Empty states are restrained:

- centered
- modest title
- short description
- one outline action

They are not illustrated marketing moments.

### Loading states

Skeletons are flat and often square. Shimmer exists, but it remains subtle.

### Notifications and overlays

Overlays use:

- frosted neutral wash
- borders instead of dramatic shadows
- low visual noise

## Motion And Interaction

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

## Responsive Behavior

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

## Public And Auth Surfaces

Public pages and login intentionally diverge from the main app shell.

### What changes

- more narrative layout
- bigger typography
- stronger use of serif headings
- centered composition
- richer media and animation
- homepage sections that feel more like storytelling than tools

### What stays consistent

- same type families
- restrained overall palette
- preference for clean borders and simple structure
- no loud brand-color dependency

Use this mode only for:

- homepage and feature marketing
- pricing and launch-style sections
- auth entry pages

Do not import marketing patterns into the main authenticated workspace.

## Accessibility Caveat

The app currently removes default focus outlines globally in `apps/dashboard/src/styles/globals.css`.

That means any new interactive component should be checked carefully for visible focus treatment. If a control depends on keyboard use, add an explicit focus style instead of relying on browser defaults.

This is an implementation reality that future work should improve, not copy blindly.

## Build Rules For New Pages

When creating a new authenticated page:

1. Start from the existing shell and spacing.
2. Decide whether the page is primarily a table page, dashboard surface, or utility/detail page.
3. Use compact controls and restrained labels.
4. Prefer borders and structure over color and decoration.
5. Keep one dominant working surface.
6. Use sheets for focused create/edit flows.
7. Match existing muted text colors and spacing rhythm.

## Do This

- use neutral surfaces and visible borders
- keep controls compact
- use serif only for selective emphasis
- design around data density and task flow
- reuse summary grids, toolbar rows, tables, sheets, and widget patterns
- make empty states concise and operational
- preserve the shell's `70px` rail/header logic

## Avoid This

- bright brand-color chrome in the product shell
- oversized hero sections on internal pages
- soft rounded consumer-app styling
- nested card-on-card layouts for data-heavy screens
- colorful charts by default
- marketing animations inside operational workflows
- inconsistent spacing or ad hoc one-off component sizes

## Short Design Test

Before shipping a new page, ask:

- Does this look like it belongs next to Transactions, Invoices, and Customers?
- Is the page built around the main job to be done, or around decoration?
- Would this still feel correct in dark mode?
- Are controls, borders, spacing, and typography using the existing rhythm?
- If this is internal, did we accidentally make it look like a landing page?

If any answer is no, bring it back toward the existing product shell.
