# HMRC production readiness

Assessed on 20 September 2026. This document concerns REST Making Tax Digital connections; it does not change the separate annual Self Assessment XML filing controls or submit a return.

## Public information

- Operator: Erlin Hoxha trading as Tamias.
- Address confirmed by the operator for publication: Studio 24, London Fields East Side, London E8 3SA.
- Support: support@tamias.xyz. Vulnerability reports: security@tamias.xyz.
- Routes: `/privacy`, `/terms`, `/support`, accessible without an account and linked from the homepage. Sign-in links to the policies.
- No claim of HMRC recognition, approval or accreditation.

Release `63cc5d3de4506ae6280b46dac58ba3b5d6e92997` passed the full GitHub Actions quality, isolated browser and production bundle gates, then deployed successfully on 20 September 2026 ([run 35525874486](https://github.com/fightingentropy/tamias/actions/runs/35525874486)). Live unauthenticated checks confirmed all three public pages return HTTP 200 with the approved operator, address and email. The `tamias.xyz` URLs redirect to their `app.tamias.xyz` equivalents. A browser check also verified the rendered privacy page.

Read-only production API checks confirmed unauthenticated `team.current` returns HTTP 401 with `Cache-Control: private, no-store` and `X-Content-Type-Options: nosniff`; an attacker origin receives no CORS allow-origin header. Authenticated isolation and secret-redaction checks used synthetic accounts locally, not production taxpayer data.

## Fraud prevention

The WEB_APP_VIA_SERVER builder follows HMRC specification 3.3. Browser telemetry is collected only for VAT requests, at request time: a persistent UUID in local storage, JavaScript user-agent, current screen, viewport and UTC offset. The authenticated user ID and sign-in email are added server-side. `CF-Connecting-IP` is collected with a UTC timestamp at the API boundary. Client-supplied public IPs and `X-Forwarded-For` are not accepted for HMRC telemetry.

Read and write requests use the same builder. Server-rendered/background reads without a browser context use stored records instead of inventing a device. Submissions without browser context are rejected before the idempotent submission operation begins.

The former implementation included made-up local IP/MAC values, server port 443, non-persistent device IDs and fixed screen dimensions. These have been removed. Invalid or unobservable values are omitted, never replaced with placeholders.

### Reproduce sandbox checks

```sh
bun --no-env-file scripts/run-with-runtime-env.ts filing -- bun --no-env-file scripts/hmrc/validate-fraud-headers.ts --complete-fixture
bun --no-env-file scripts/run-with-runtime-env.ts filing -- bun --no-env-file scripts/hmrc/validate-fraud-headers.ts
```

Both commands use artificial device/account examples and application-only sandbox credentials. They do not query a taxpayer or file anything. A successful complete fixture proves header serialization only. The second check represents the currently implemented collection capabilities, with the unavailable fields left out. Do not treat either as evidence that a live request collected every field correctly.

Recorded results: complete fixture `VALID_HEADERS`; collection-capability fixture `INVALID_HEADERS`, with three errors (public source port, vendor public IP and forwarded hops) and two warnings (MFA and licence IDs). Raw validator reports contain no real taxpayer data and are retained with the assessment evidence.

### Hosting work still required

The present deployment credential can read the zone but received HTTP 403 for its request-header ruleset. No Cloudflare rule was changed.

Cloudflare documents `cf.edge.client_port` for request-header transforms. A transform would need to **overwrite**, not append, `X-Tamias-Hmrc-Client-Port` on every incoming request to all serving hosts. `cf.edge.server_ip` is documented as meaningful only for BYOIP customers; do not pick an arbitrary DNS result or use the outbound Worker IP as the address the browser contacted.

`HMRC_FRAUD_TRUST_EDGE_HEADERS` must remain unset until the source-port and vendor-IP collection has been verified at ingress, all serving routes are covered and alternative `workers.dev` entry points cannot supply spoofed headers. If further public TLS hops are introduced, the forwarded chain must describe those actual hops; the present builder handles a single ingress hop.

Tamias currently uses password authentication and has no installed per-device licence key. An enquiry about MFA/licence handling and any remaining platform restrictions was sent to HMRC Software Developer Support with the operator's approval on 20 September 2026 at 17:31 UTC. Its Sent record was independently verified. The exact correspondence is in `docs/security/hmrc-header-enquiry.md`; no exemption has been agreed.

Production calls fail closed for missing required headers. `HMRC_FRAUD_MISSING_HEADERS_APPROVED` accepts an exact, comma-separated list of names **only after the specific omissions have been discussed and agreed with HMRC**. No exemptions were configured during this assessment. `HMRC_FRAUD_VENDOR_VERSION` can identify a release; the default matches the compliance package version.

## OAuth and release

Migration `0055_hmrc_oauth_states.sql` was applied to production on 20 September 2026; its table and index were independently verified. Apply it before deploying to any other environment. HMRC authorisation uses encrypted states expiring after ten minutes, an HttpOnly SameSite cookie binding the initiating browser and an atomic D1 consumption record to reject replay. Only hashes are persisted. The callback rechecks workspace membership. Error responses do not include provider tokens or raw response bodies.

Tamias's existing Developer Hub application has sandbox credentials. Production credentials and user HMRC authorisation remain separate requirements. The production application is a draft. Do not submit declarations of full header readiness, formal recognition or unrestricted production access based on this work.

### Draft application updates

The operator signed back into Developer Hub on 20 September 2026. Tamias's name and globally distributed hosting were saved, along with the security-reporting contact and documented HMRC incident-notification process. The production D1 database reported `WEUR`, no jurisdiction restriction and read replication disabled; this describes the database, not a UK-only processing guarantee. Workers execute on Cloudflare's global network, which spans the UK, EEA and countries outside the EEA with and without adequacy arrangements.

After verifying publication, `https://app.tamias.xyz/privacy` and `https://app.tamias.xyz/terms` were saved to the draft. Developer Hub confirmed both the service-management and customer-authorisation sections as completed. This section status records answered questions, not approval of the application.

Development-practice guidance was acknowledged, but the error-handling and whole-product accessibility declarations remain uncompleted pending their specific evidence. Handling-personal-data declarations remain uncompleted pending the operational evidence noted in the assessment. The existing "No" answers for penetration testing, security-control audits and complete fraud-header compliance were not converted to "Yes" on the strength of this limited internal assessment. No final application or legal declaration was submitted.

## Primary references

- [HMRC web application via server headers](https://developer.service.hmrc.gov.uk/guides/fraud-prevention/connection-method/web-app-via-server/)
- [HMRC missing-data procedure](https://developer.service.hmrc.gov.uk/guides/fraud-prevention/getting-it-right/)
- [HMRC fraud header validator](https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/txm-fph-validator-api/1.0)
- [HMRC API terms and questionnaire](https://developer.service.hmrc.gov.uk/api-documentation/docs/terms-of-use)
- [Cloudflare request-header transform fields](https://developers.cloudflare.com/rules/transform/request-header-modification/reference/fields-functions/)
- [Cloudflare server IP field limitation](https://developers.cloudflare.com/ruleset-engine/rules-language/fields/reference/cf.edge.server_ip/)
