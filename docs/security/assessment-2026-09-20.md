# Tamias application security assessment

Date: 20 September 2026. Baseline: `ba371a75f0ce18fe50742e41f147bb8da55d5ed3`. Assessor: Codex, acting for the operator. This is an internal, tool-assisted source and local HTTP assessment, not an independent penetration-test certificate or a declaration that the entire service is secure.

Follow-up: source-port trust and error handling were improved on 21 September. This report records the original assessment; current implementation, remaining header requirements and newer evidence are described in [HMRC readiness](../hmrc-readiness.md).

## Scope and method

Reviewed the browser-to-API boundary, current-session and workspace checks, scoped credentials, integration responses, HMRC OAuth, fraud-prevention data, file path validation, dependency advisories and public customer information. Executed attacks against real API handlers on loopback with an in-memory SQL database and synthetic accounts. The assessment script blocks external fetches; it does not read saved sessions or customer records. Only the Workers platform class and durable rate-limit storage are replaced locally; authentication, session lookup, permissions, queries and API handlers run normally.

The assessment did not include destructive production tests, infrastructure exploitation, social engineering, denial of service, every third-party integration, or a complete independent OWASP assessment. HMRC sandbox validation used synthetic device and account data, without taxpayer enquiries or filings.

## Findings corrected

1. **High: scoped API credentials could reach first-party tRPC procedures without their REST scope checks.** tRPC now accepts the dashboard's session authentication; external API keys and OAuth credentials use the REST API and its required scopes. Verified a read-only key receives 401 from tRPC and 403 from a REST route requiring write permission.
2. **High: integration responses exposed provider configuration, including access and refresh tokens.** Read, settings-update, disconnect and WhatsApp-connection responses now omit configuration. WhatsApp display fields are explicitly allowed. Local HTTP responses were checked with nested synthetic secrets; another workspace could not read the integration.
3. **High: financial edge caching could return an earlier workspace or revoked-session response.** Removed shared tRPC response caching; requests re-evaluate current authentication and workspace membership. Responses are private and no-store. Verified workspace changes, membership removal and session revocation on subsequent requests, and proved that the shared-cache trap was never touched.
4. **Medium: HMRC OAuth state lacked expiry, browser binding and single-use enforcement.** Encrypted states now expire after ten minutes, bind to an HttpOnly SameSite cookie and use atomic D1 consumption. Only hashes are stored. The callback checks current workspace membership. Tests reject tampering, expiry, a wrong browser, replay and a missing cookie before token exchange.
5. **Medium: file paths needed explicit traversal checks before namespace resolution.** Plain, encoded and multiply encoded traversal, backslashes and control bytes are rejected. Normal workspace-relative paths remain accepted.
6. **Dependency advisories:** the initial registry scan reported 125 advisories across 37 packages. Updated vulnerable dependencies and their transitive resolutions, including the rich-text editor, XML parser, HTTP libraries and build tooling. The final `bun audit --json` result was `{}`. This is the registry's known-advisory result at the assessment time, not proof that dependencies have no vulnerabilities. Compatible AI packages are explicitly aligned, and the existing formatter version is pinned to avoid unrelated formatting changes.

HMRC HTTP calls also reject redirects, have deadlines, bound response bodies to 1 MiB and avoid exposing upstream bodies in errors. Browser tests caught and corrected a Tiptap option-reference update loop; typing and bold formatting were then verified.

The registry scan does not inspect bundled dependencies. `unpdf` 1.8.1 embeds PDF.js 6.1.200, within the version range of [CVE-2026-16633](https://github.com/mozilla/pdf.js/security/advisories/GHSA-hq66-cqwq-w95j). That advisory requires the browser viewer's scripting feature. Tamias uses this bundle only for headless server-side text extraction, without a viewer or scripting manager; XFA is explicitly disabled and document resources are released afterwards. A synthetic PDF checks the installed extraction engine. The separate `pdfjs-dist` dependency is patched to 6.3.289. Do not introduce the bundled engine into a browser viewer; replace it when an upstream patched serverless bundle is available.

## Security controls reviewed

- **Identity and access:** signed sessions, D1 revocation, current workspace membership, scoped REST authentication and hostile-origin rejection have code and test evidence. Production session cookies use Secure, HttpOnly and SameSite attributes. Passwords are salted PBKDF2-SHA256 hashes, with 100,000 iterations in the current implementation; this review does not certify that cost against a particular standard. There is no additional MFA factor in the current password flow.
- **Secrets and data:** server configuration is removed from browser integration responses. HMRC connection state uses the existing AES-256-GCM encryption helper and persists only state/binding hashes. Provider credentials in installed-app configuration rely on restricted database access and hosting storage protections; this review does not claim separate application encryption of every stored provider token. Hosting encryption, access reviews and processor contracts need their own retained operational evidence.
- **Input and transport:** request schemas, parameterised SQL, file namespace validation, auth rate-limit middleware, HTTPS production domains and HMRC response bounds were inspected. The local HTTP checks exercise the specific boundaries above; they are not an exhaustive injection or network assessment.
- **Change control:** the security assessment now runs in the repository quality gate. API test failures are no longer masked as “No tests yet”. VAT persistence fixtures now use balanced journals and the current missing-binding error; the ledger safeguards were not relaxed. Dependency updates pass type checking, builds and the isolated filing UI suite.
- **Customer information and incidents:** public privacy, terms and support pages use the operator-approved details. The incident procedure assigns an owner and notification/recovery steps. A written procedure is not evidence of a completed incident-response or backup-restore rehearsal.

## Verification evidence

Evidence is stored under `docs/security/evidence/2026-09-20/` and contains synthetic results only.

- Local HTTP assessment: 13 of 13 checks passed.
- Compliance unit tests: 58 passed, including fraud headers and bounded response handling.
- Additional persistence and filed-return checks: 29 passed.
- Isolated Self Assessment/analytics browser suite: 10 passed, including workspace switching, uncertain submissions, already-filed years and mobile layouts.
- Isolated editor and device-collection browser checks: 2 passed, including formatting without a render loop and persistent device identity with changing viewport sizes.
- Repository/workspace tests, format/lint gates, architecture checks, generated-file checks, migration checks, type checking, production build and Cloudflare deployment dry-run passed. Existing lint warnings remain.
- Privacy, terms and support pages were inspected in the local browser. Editor input and formatting work; HMRC browser data uses the same device identifier after reload.
- Migration `0055_hmrc_oauth_states.sql` was applied to the production D1 database before release. It creates a separate state-hash table and expiry index; it does not alter financial records.

Reproduce the security checks with `bun run test:security`, `bun run test:compliance-data`, `bun run test:e2e:self-assessment` and `bun audit --json`. See `docs/hmrc-readiness.md` for the two sandbox-validator commands.

## Open HMRC and operational requirements

The complete synthetic header fixture passed HMRC's validator. The fixture representing current collection capabilities failed with three missing network headers: public source port, vendor ingress IP and forwarded hop. It also returned warnings for MFA and licence IDs. Full live collection has not been demonstrated. No exemption or trusted-edge-header setting has been enabled, and incomplete production MTD requests fail closed.

After the operator signed into Cloudflare, the "Tamias HMRC ingress metadata" request-header transform was deployed on the `tamias.xyz` zone. It overwrites the source-port header with Cloudflare's actual client port and removes any supplied vendor-IP header. A synthetic, uniquely filtered Worker tail verified both actions for `api.tamias.xyz`, `app.tamias.xyz` and `tamias.xyz`; the two health endpoints returned 200 and the apex returned its expected 307 redirect. Sanitised results are retained in `evidence/2026-09-20/cloudflare-ingress-probe.json`. Deployment credentials were not expanded.

The application-side trust flag remains unset: the current implementation enables both network fields together, vendor ingress IP remains unavailable, and alternative Worker entry points have not been certified against spoofed headers. Cloudflare documents the ingress server-IP field as meaningful for BYOIP; no address should be invented. The operator-approved HMRC enquiry about these platform restrictions and the password-only SaaS model was sent on 20 September 2026 at 17:31 UTC, and its Sent record was independently verified. No exemption has been agreed.

Before an unrestricted production-readiness declaration, retain evidence of hosting access review, processor locations/transfer safeguards, backup restoration and incident rehearsal, and resolve the header requirements with HMRC. The Developer Hub application remains a draft; this report is not production credentials, software recognition, or evidence that a tax return was filed.
