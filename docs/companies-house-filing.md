# Companies House Filing Integration

## Overview

Tamias now includes two Companies House integration layers:

- the official OAuth/API filing and public-register layer
- the Companies House XML gateway layer for annual accounts filing

This slice intentionally covers:

- OAuth connection from the Apps page
- token refresh and user-profile persistence
- transaction creation / fetch / close / delete
- registered office address draft creation and validation
- registered email address draft creation and validation
- PSC discrepancy report submission
- public company-profile lookup via the Companies House register
- public registered office address lookup via the Companies House register
- recent `accounts` filing-history lookup for the filing-profile company
- year-end dashboard comparison between the public register and the current pack
- year-end annual accounts submission through the Companies House XML gateway
- year-end annual accounts status polling through `GetSubmissionStatus`

It still does not yet cover confirmation statements, officer filings, or ordinary PSC register maintenance.

That split matters. The official public API Filing overview documents transactions plus registered office address, registered email address, and insolvency services, but does not expose an accounts filing resource. Annual accounts filing is therefore implemented through the separate Companies House software-filing XML gateway path instead of the OAuth/API filing transaction surface.

## Main Surfaces

- Official app entry: `companies-house`
- Apps-sheet operations panel:
  - scope grant actions
  - registered office draft form
  - registered email draft form
  - PSC discrepancy report form
- OAuth routes:
  - `/apps/companies-house/install-url`
  - `/apps/companies-house/oauth-callback`
- tRPC router:
  - `companiesHouse.getConnection`
  - `companiesHouse.createRegisteredOfficeAddressDraft`
  - `companiesHouse.refreshRegisteredOfficeAddressDraft`
  - `companiesHouse.createRegisteredEmailAddressDraft`
  - `companiesHouse.refreshRegisteredEmailAddressDraft`
  - `companiesHouse.submitPscDiscrepancyReport`
  - `companiesHouse.createTransaction`
- `companiesHouse.getTransaction`
- `companiesHouse.closeTransaction`
- `companiesHouse.deleteTransaction`
- `companiesHouse.getAccountsStatus`
- Year-end dashboard:
  - `/compliance/year-end`
  - submit annual accounts
  - poll annual-accounts status

## Scope Model

Companies House OAuth scopes are company and resource specific.

The base Tamias connection requests:

- `https://identity.company-information.service.gov.uk/user/profile.read`

The install URL route also supports requesting an additional company scope when both query params are supplied:

- `companyNumber`
- `scopeKind`

Currently supported `scopeKind` values:

- `registered-office-address.update`
- `registered-email-address.update`
- `psc-discrepancy-reports.write-full`

The first two are company-scoped permissions. The PSC discrepancy scope is not company-specific and can be requested without a `companyNumber`.

That keeps the OAuth/API integration aligned with the official Companies House scope model without hard-coding unsupported accounts scopes.

Annual accounts filing does not use those OAuth scopes. It uses the Companies House XML gateway presenter account instead.

## Current Limitation

Creating a company-bound filing draft with `companyNumber` requires the OAuth token to already include the matching company permission scope.

Because this slice does not request every filing scope up front, the Companies House app panel asks for the exact missing scope before each supported flow.

Operationally this means:

- the connection works from the Apps page
- registered office drafts require the registered office scope for the filing-profile company
- registered email drafts require the registered email scope for the filing-profile company
- PSC discrepancy reports require the PSC discrepancy scope
- the year-end workspace can compare the current pack with the public register and submit annual accounts through the XML gateway when presenter credentials are configured and the company authentication code is saved
- ordinary PSC register filings are still out of scope; Tamias only supports PSC discrepancy reporting at this layer

## Environment Variables

Add these to the API runtime:

```dotenv
COMPANIES_HOUSE_CLIENT_ID=...
COMPANIES_HOUSE_CLIENT_SECRET=...
COMPANIES_HOUSE_OAUTH_REDIRECT_URL=https://api.tamias.xyz/apps/companies-house/oauth-callback
COMPANIES_HOUSE_ENVIRONMENT=sandbox
COMPANIES_HOUSE_API_KEY=...
COMPANIES_HOUSE_XML_ENVIRONMENT=test
COMPANIES_HOUSE_XML_PRESENTER_ID=...
COMPANIES_HOUSE_XML_PRESENTER_AUTHENTICATION_CODE=...
# Optional in test mode; defaults to OPSLDG
COMPANIES_HOUSE_XML_PACKAGE_REFERENCE=...
```

`COMPANIES_HOUSE_ENVIRONMENT` supports:

- `sandbox`
- `production`

`COMPANIES_HOUSE_API_KEY` is used for read-side public register checks:

- company profile
- current registered office address
- next accounts due date / overdue flag
- latest public `accounts` filings

`COMPANIES_HOUSE_XML_ENVIRONMENT` supports:

- `test`
- `production`

`COMPANIES_HOUSE_XML_PRESENTER_ID` and
`COMPANIES_HOUSE_XML_PRESENTER_AUTHENTICATION_CODE` are the Companies House
software-filing presenter credentials used by the XML gateway. Tamias hashes
them with the lowercase MD5 algorithm before sending them in the GovTalk
envelope, as required by the Companies House TIS.

`COMPANIES_HOUSE_XML_PACKAGE_REFERENCE` is required for live filing and should
be the Companies House-issued package/software reference. In test mode,
Tamias falls back to `OPSLDG` if you leave it unset.

The filing profile must also store the company authentication code. That value
is not an environment variable; it is saved per legal entity from
`/compliance/settings`.

## Implementation References

- `packages/compliance/src/providers/companies-house.ts`
- `packages/app-data/src/queries/companies-house.ts`
- `apps/api/src/rest/routers/apps/companies-house`
- `apps/api/src/trpc/routers/companies-house.ts`
- `packages/app-store/src/companies-house`
