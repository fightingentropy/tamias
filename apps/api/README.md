## API

### Environment Variables

The API requires the following environment variables:

#### Cloudflare Async Transport
```bash
CLOUDFLARE_ASYNC_BRIDGE_URL=http://127.0.0.1:8787
CLOUDFLARE_ASYNC_BRIDGE_TOKEN=...
# Optional explicit allowlist. If omitted, all supported queue jobs are allowed.
CLOUDFLARE_ASYNC_BRIDGE_JOBS=transactions:*,documents:*,inbox:*,inbox-provider:*,accounting:*,invoices:*,customers:*,teams:*,insights:*,notifications:*
```

In the **unified** Cloudflare deploy from `apps/dashboard` (single production Worker `tamias` in `wrangler.start.jsonc`), the async bridge runs in-process and no `ASYNC_WORKER` service binding is used. The URL/token bridge variables above are for local fallback paths (`vite` with local bridge variables, or standalone worker tests).

#### Local Development Setup

1. **Run the unified dashboard/API app locally:**
   Use `bun run dev:dashboard` (or `bun run dev:local`) from the repo root.

2. **Optional local bridge fallback (for standalone worker tests):**
   ```bash
   export CLOUDFLARE_ASYNC_BRIDGE_URL=http://127.0.0.1:8787
   export CLOUDFLARE_ASYNC_BRIDGE_TOKEN=your-local-bridge-token
   ```

3. **Bind the Teller client certificate in Cloudflare if you use Teller:**
   ```bash
   bunx wrangler mtls-certificate upload --cert teller-cert.pem --key teller-key.pem --name teller
   ```
   Then add the returned `certificate_id` as `TELLER_MTLS_CERTIFICATE` in your deployed Cloudflare dashboard worker environment.

#### Convex Configuration
```bash
CONVEX_URL=https://fleet-chameleon-251.eu-west-1.convex.cloud
CONVEX_SITE_URL=https://fleet-chameleon-251.eu-west-1.convex.site
CONVEX_SERVICE_KEY=...
```

The local API uses the shared deployed Convex instance. There is no separate local Convex deployment.

#### UK Filing Runtime
```bash
# Companies House OAuth + public register
COMPANIES_HOUSE_CLIENT_ID=...
COMPANIES_HOUSE_CLIENT_SECRET=...
COMPANIES_HOUSE_OAUTH_REDIRECT_URL=http://localhost:3003/apps/companies-house/oauth-callback
COMPANIES_HOUSE_ENVIRONMENT=sandbox
COMPANIES_HOUSE_API_KEY=...

# Companies House XML annual accounts filing
COMPANIES_HOUSE_XML_ENVIRONMENT=test
COMPANIES_HOUSE_XML_PRESENTER_ID=...
COMPANIES_HOUSE_XML_PRESENTER_AUTHENTICATION_CODE=...
# Optional in test mode; defaults to OPSLDG
COMPANIES_HOUSE_XML_PACKAGE_REFERENCE=...

# HMRC corporation tax filing
HMRC_CT_ENVIRONMENT=test
HMRC_CT_SENDER_ID=...
HMRC_CT_SENDER_PASSWORD=...
HMRC_CT_VENDOR_ID=...
HMRC_CT_TEST_UTR=...
HMRC_CT_PRODUCT_NAME=Tamias
HMRC_CT_PRODUCT_VERSION=0.1.0
```

Notes:

- Keep `HMRC_CT_ENVIRONMENT=test` by default, including deployed environments, until you intentionally want live HMRC CT filing.
- In `test`, CT submissions use `HMRC_CT_TEST_UTR` when configured. In `production`, the filing profile UTR becomes the submission reference.
- Companies House annual accounts filing uses the XML gateway presenter credentials above, not the OAuth client credentials.
- The operational filing flows are documented in `../../docs/uk-compliance.md`, `../../docs/year-end-operations.md`, and `../../docs/companies-house-filing.md`.

#### Assistant providers (chat)

Users can pick an assistant backend in the dashboard. The API worker must have the matching secret set or requests return HTTP 503:

- **OpenAI** (default): `OPENAI_API_KEY`, optional `OPENAI_ASSISTANT_MODEL_*` overrides in code paths that read them.
- **Kimi**: `KIMI_API_KEY`, optional `KIMI_BASE_URL`, `KIMI_MODEL_*`.
- **OpenRouter**: `OPENROUTER_API_KEY`, optional `OPENROUTER_BASE_URL` (defaults to `https://openrouter.ai/api/v1`), optional `OPENROUTER_ASSISTANT_MODEL_*` (defaults to `qwen/qwen3.6-plus:free`), optional `OPENROUTER_HTTP_REFERER` and `OPENROUTER_APP_NAME` for OpenRouter rankings headers.

See [./.env-template](./.env-template) for variable names.

### Development

```bash
bun run dev
```

### Production

```bash
bun run deploy:cloudflare:dashboard:production
```

### State And Caching

The API now uses Convex for durable app state and the Cloudflare async worker for background jobs.

- **Convex**: Source of truth for app state, identity, financial data, and AI chat memory
- **Local in-memory caches**: Used only for short-lived banking metadata and assembled chat context within a single API instance
- **Cloudflare async transport**: In unified deploy it uses the dashboard worker’s in-process async bridge. Local dev can use the HTTP bridge for isolated testing.

#### Environment-Specific Configuration

Background jobs use the Cloudflare async transport in `@tamias/job-client`, preferring the in-process async bridge and falling back to the local bridge when needed.
