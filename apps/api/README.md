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

In deployed Cloudflare environments, the API uses a Worker-to-Worker service binding to `apps/worker`. The URL/token bridge variables above are only needed for local fallback paths such as `next dev` or standalone local worker testing.

#### Local Development Setup

1. **Start the Cloudflare async worker:**
   ```bash
   cd ../worker
   bun run dev
   ```

2. **Set local bridge fallback variables:**
   ```bash
   export CLOUDFLARE_ASYNC_BRIDGE_URL=http://127.0.0.1:8787
   export CLOUDFLARE_ASYNC_BRIDGE_TOKEN=your-local-bridge-token
   ```

3. **Bind the Teller client certificate in Cloudflare if you use Teller:**
   ```bash
   bunx wrangler mtls-certificate upload --cert teller-cert.pem --key teller-key.pem --name teller
   ```
   Then add the returned `certificate_id` as `TELLER_MTLS_CERTIFICATE` in both [./wrangler.jsonc](./wrangler.jsonc) and [../worker/wrangler.jsonc](../worker/wrangler.jsonc).

#### Convex Configuration
```bash
CONVEX_URL=http://127.0.0.1:3210
CONVEX_SITE_URL=http://127.0.0.1:3211
CONVEX_SERVICE_KEY=...
```

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

### Development

```bash
bun run dev
```

### Production

```bash
bun run deploy:cf -- --env production
```

### State And Caching

The API now uses Convex for durable app state and the Cloudflare async worker for background jobs.

- **Convex**: Source of truth for app state, identity, financial data, and AI chat memory
- **Local in-memory caches**: Used only for short-lived banking metadata and assembled chat context within a single API instance
- **Cloudflare async transport**: Uses a service binding in Cloudflare deployments and the local bridge fallback in local dev

#### Environment-Specific Configuration

Background jobs use the Cloudflare async transport in `@tamias/job-client`, preferring the Worker service binding and falling back to the local bridge when needed.
