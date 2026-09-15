# Tamias for iPhone

A native SwiftUI companion for the Tamias business workspace, built for iOS 18 and later. The app uses Apple navigation, native charts, local invoice drafts, and receipt capture with the document scanner, photo picker, and Files picker. The app icon and template mark reuse the existing Tamias brand vector.

The project lives entirely in `ios/`; the dashboard and backend remain separate. There are no third-party runtime dependencies in the iOS app.

Scan receipt opens the native document camera immediately; cancelling returns to the previous screen. Inbox → + → Import receipt keeps Photos and Files available without opening the camera. Receipt review shows the original, editable details and Save. Dark mode uses a black background with neutral grey surfaces, and the main screens use concise labels and system typography.

The app has no tracking or app analytics. `UserDefaults` is used only for this app’s appearance preference, under Apple’s [CA92.1 required reason](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitype). Connecting to a workspace sends authentication requests directly to its HTTPS API. Local drafts and captures are uploaded only through the reviewed sync or send actions.

## Open and build

Version 1.2.0 adds the Tax tab: UK tax-year totals, bulk expense review with
business/personal splits, CSV working papers and a 2025/26 Self Assessment
preparation/submission history. Filing supports a restricted single-business
cash-basis return and requires separate HMRC setup; MTD Income Tax and additional
personal return pages are not implemented. See [filing scope and setup](../docs/self-assessment.md).

Validation for 1.2.0 (4), 8 September 2026: 50 native unit tests and two targeted
UI workflows passed (main navigation and tax review/readiness). The latter was
rerun after fixing the bulk-review button's accessibility bounds. The signed
Release app is installed on the paired iPhone; its inventory shows version 1.2.0,
build 4, and no UI-test runner apps. The physical walkthrough still requires an
unlocked phone. Local screenshots and installation evidence are in the ignored
`artifacts/tax-20260908/`. No real return was submitted. A separate synthetic
return completed HMRC ETS acceptance on 15 September 2026; see the current
[filing verification and recognition status](../docs/self-assessment.md).

On 15 September 2026, all 51 native unit tests and six targeted Tax UI workflows
passed on the existing iPhone simulator. This includes preparation, declaration,
acceptance, polling retries, uncertain outcomes, rejection, scope blocking and
the system receipt share sheet with fictional API responses. The signed Release
build passed verification and excludes the fixture service. The physical Tax tab
was opened in demo mode; an authenticated device check still requires sign-in.

Open `Tamias.xcodeproj` in a full Xcode installation. The checked-in project is generated from `project.yml` with [XcodeGen](https://github.com/yonaskolb/XcodeGen). Regenerate after adding or removing Swift files:

```sh
cd ios
./scripts/xcode.sh generate
./scripts/xcode.sh build
```

The wrapper respects `DEVELOPER_DIR`, or locates `/Applications/Xcode.app` / `/Applications/Xcode-beta.app` when Command Line Tools are selected globally. It does not change the global developer directory. Simulator builds use ad-hoc signing to preserve the App Group entitlements needed by the share extension.

## Data and connection

The sample workspace makes the app immediately usable without a server connection. Sample figures are labelled in the app. Settings supports an existing Tamias email/password login or a personal API key. Session credentials are stored in the iOS Keychain, and password sessions support token refresh. The connection uses the existing REST API over HTTPS.

Invoice drafts and captured receipt files are kept on the iPhone and separated by workspace. Drafts can be edited and exported to a PDF marked DRAFT, with a native preview and user-controlled sharing. Creating a local draft does not send an invoice or collect a payment. Connecting a workspace enables reviewed invoice creation/sending and receipt uploads/matching. The app requests camera access only when starting a scan; the system photo and file pickers do not require full library access.

Local drafts and receipt files may be included in normal iOS device backups; this is separate from syncing them to Tamias.

Receipt text recognition uses Apple Vision on-device. Suggestions never fill merchant, total or date until the user accepts them, and those fields remain editable before sync. Ambiguous totals, dates and dollar currencies are left for review. PDFs use an existing text layer where available; scanned PDFs are analyzed for at most their first three pages. Imports are limited to 20 MB, PDFs to 30 pages, and scanner batches to 10 pages.

The Tamias share extension accepts up to five images or PDFs from the system share sheet. It stages protected original files in `group.com.erlinhoxha.tamias`, without credentials, network requests or a chosen workspace. Open Inbox → Shared with Tamias to review each item and explicitly save it to the current workspace. SHA256 deduplication, a cross-process lock, atomic publication, and an import identifier prevent duplicate/repeated saves. The pending shared inbox holds up to 50 files. It is shared across workspaces, so account selection always happens in the main app.

Balances combine enabled depository accounts in the selected currency and identify other currencies separately. Revenue and expense figures use the server’s reports; they are not a cash movement forecast. Backend currency conversion depends on its available FX rates. Missing server rates can leave converted report figures incomplete, and the app does not invent a local conversion.

## Verification

```sh
# With a booted simulator and the monorepo dependencies installed, add the
# clearly marked sample receipt used by the Photos-picker integration test.
node scripts/seed-receipt-fixture.mjs <booted-simulator-udid>

# Use the same simulator for the full test suite.
SIMULATOR_ID=<simulator-udid> ./scripts/xcode.sh test

# Signed build for a paired iPhone (requires a configured Apple developer account).
./scripts/xcode.sh device-build
```

UI tests launch an isolated sample workspace with `-ui-testing`; `-reset-ui-testing` clears only that test workspace. The nine UI workflows cover navigation and settings, Home drilldowns, activity search and detail, invoice validation/editing/persistence/PDF preview, direct scanner cancellation on iPhone and the simulator fallback, dark appearance and Inbox imports, original receipt persistence, accepting on-device OCR suggestions, and the real system share extension followed by explicit workspace review. Receipt tests use a fictional fixture through the actual Photos picker. Screenshots are attached to the Xcode test result. Unit tests cover the API and workspace boundaries, invoice totals, receipt parsing and Vision recognition, and shared-file integrity and deduplication. Live backend authentication has not been verified with a real account; network tests use contract fixtures. These checks do not prove physical camera capture.

Version 1.1.1 (3) validation on 8 September 2026: all 47 unit tests passed, and the final run passed all nine UI workflows. The scan entry now opens VisionKit automatically and cancellation returns to the prior screen. Simulator runtimes that advertise camera support but cannot capture documents use the Photos/Files fallback. Screenshot review confirmed black backgrounds, neutral surfaces, compact receipt review and simplified main screens in both appearances. The signed arm64 Release app and share extension passed strict signature and App Group checks; the paired iPhone inventory confirms version 1.1.1, build 3. The phone remained locked, so the physical scanner launch/cancel test is prepared but not yet run. Local evidence is in the ignored `artifacts/minimal-ui-20260908/` directory, including `Tamias-Minimal-UI.xcresult`, `signed-build.json`, `installed-app.json` and the selected PNGs. The first run's unit suite passed; its simulator-camera failure was fixed before the successful final UI run.

The production API changes are deployed and verified: OpenAPI exposes all eight new endpoints, API and database readiness respond successfully, and protected routes reject unauthenticated requests. API tests pass 150/150. The wider repository suite retains five failures reproduced on pristine HEAD; see `artifacts/iteration2-checks/quality-gates-summary.txt` for the exact scope and evidence.

Automatic signing uses development team `T29NU9NCA2`, main bundle identifier `com.erlinhoxha.tamias`, and share bundle identifier `com.erlinhoxha.tamias.share`. Both identifiers must have the App Groups capability and access to `group.com.erlinhoxha.tamias`. A cached wildcard development profile cannot sign these entitlements; Xcode needs an authenticated Developer account or suitable explicit profiles. Select another team in Xcode or override `DEVELOPMENT_TEAM` when building on another account. A build, simulator test, signed install, and physical-device walkthrough are distinct verification steps.

## Brand assets

The icon is an opaque 1024 px asset with a cream Tamias mark on a dark background. Its source is `LogoSmall` in `packages/ui/src/components/icons.tsx`. To regenerate the icon and the scalable `TamiasMark` template image, install the monorepo dependencies and run:

```sh
node ios/scripts/generate-icon.mjs
```

`project.yml` is the source of truth for targets and Info.plist settings. Build output and personal Xcode state are ignored by `ios/.gitignore`.
