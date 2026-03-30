import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
  buildCompaniesHouseCompanyScope,
  buildCompaniesHouseScope,
  CompaniesHouseXmlGatewayProvider,
  CompaniesHouseProvider,
  COMPANIES_HOUSE_PSC_DISCREPANCY_SCOPE,
  COMPANIES_HOUSE_PSC_DISCREPANCY_SCOPE_KIND,
  COMPANIES_HOUSE_PROFILE_SCOPE,
  extractCompaniesHouseCompanyScopes,
  normalizeCompaniesHouseAccountsDocument,
  parseCompaniesHouseGatewayMessage,
} from "./companies-house";

function createProvider(accessToken = "test-token") {
  return new CompaniesHouseProvider(
    {
      clientId: "test-client-id",
      clientSecret: "test-client-secret",
      redirectUri: "https://example.com/callback",
    },
    {
      provider: "companies-house",
      accessToken,
      refreshToken: "test-refresh-token",
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      environment: "sandbox",
      scope: [COMPANIES_HOUSE_PROFILE_SCOPE],
    },
    "test-api-key",
  );
}

const originalFetch = globalThis.fetch;
let mockFetchFn: ReturnType<typeof mock>;

beforeEach(() => {
  mockFetchFn = mock(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(""),
    }),
  );
  globalThis.fetch = mockFetchFn as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("CompaniesHouseProvider", () => {
  test("has the correct id and name", () => {
    const provider = createProvider();

    expect(provider.id).toBe("companies-house");
    expect(provider.name).toBe("Companies House");
  });

  test("builds the OAuth consent URL with the default identity scope", () => {
    const provider = createProvider();

    const url = provider.buildConsentUrl("state-123");

    expect(url).toContain(
      "https://identity-sandbox.company-information.service.gov.uk/oauth2/authorise",
    );
    expect(url).toContain("state=state-123");
    expect(url).toContain(
      encodeURIComponent(COMPANIES_HOUSE_PROFILE_SCOPE).replaceAll("%20", "+"),
    );
  });

  test("adds company-specific scopes when requested", () => {
    const provider = createProvider();
    const companyScope = buildCompaniesHouseCompanyScope(
      "12345678",
      "registered-email-address.update",
    );

    const url = provider.buildConsentUrl("state-123", {
      scopes: [COMPANIES_HOUSE_PROFILE_SCOPE, companyScope],
    });

    expect(url).toContain(
      encodeURIComponent(companyScope).replaceAll("%20", "+"),
    );
  });

  test("parses granted company scopes from stored scope strings", () => {
    const scopes = extractCompaniesHouseCompanyScopes([
      COMPANIES_HOUSE_PROFILE_SCOPE,
      "https://api.company-information.service.gov.uk/company/12345678/registered-office-address.update",
      "https://api-sandbox.company-information.service.gov.uk/company/87654321/registered-email-address.update",
    ]);

    expect(scopes).toEqual([
      {
        companyNumber: "12345678",
        scopeKind: "registered-office-address.update",
      },
      {
        companyNumber: "87654321",
        scopeKind: "registered-email-address.update",
      },
    ]);
  });

  test("builds the PSC discrepancy scope without a company number", () => {
    const scope = buildCompaniesHouseScope({
      scopeKind: COMPANIES_HOUSE_PSC_DISCREPANCY_SCOPE_KIND,
    });

    expect(scope).toBe(COMPANIES_HOUSE_PSC_DISCREPANCY_SCOPE);
  });

  test("exchanges auth codes for token config", async () => {
    mockFetchFn.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          access_token: "new-access-token",
          refresh_token: "new-refresh-token",
          expires_in: 3600,
          token_type: "Bearer",
          scope: `${COMPANIES_HOUSE_PROFILE_SCOPE} https://api.company-information.service.gov.uk/company/12345678/registered-office-address.update`,
        }),
      text: () => Promise.resolve(""),
    });

    const provider = createProvider();
    const config = await provider.exchangeCodeForTokens("auth-code");

    expect(config.provider).toBe("companies-house");
    expect(config.accessToken).toBe("new-access-token");
    expect(config.refreshToken).toBe("new-refresh-token");
    expect(config.scope).toContain(COMPANIES_HOUSE_PROFILE_SCOPE);
    expect(config.scope).toContain(
      "https://api.company-information.service.gov.uk/company/12345678/registered-office-address.update",
    );
  });

  test("creates a filing transaction against the API filing endpoint", async () => {
    mockFetchFn.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          id: "txn-123",
          company_number: "12345678",
          description: "Annual accounts filing",
          reference: "YE-2026",
          resume_journey_uri: "https://tamias.xyz/compliance/year-end",
          status: "open",
          links: {
            self: "/transactions/txn-123",
            validation_status: "/transactions/txn-123/validation-status",
          },
        }),
      text: () => Promise.resolve(""),
    });

    const provider = createProvider();
    const transaction = await provider.createTransaction({
      companyNumber: "12345678",
      description: "Annual accounts filing",
      reference: "YE-2026",
      resumeJourneyUri: "https://tamias.xyz/compliance/year-end",
    });

    expect(transaction.id).toBe("txn-123");
    expect(transaction.companyNumber).toBe("12345678");
    expect(transaction.status).toBe("open");

    const [url, init] = mockFetchFn.mock.calls[0]!;
    expect(url).toBe(
      "https://api-sandbox.company-information.service.gov.uk/transactions",
    );
    expect(init?.method).toBe("POST");
  });

  test("normalizes iXBRL and builds an annual accounts XML gateway envelope", () => {
    const provider = new CompaniesHouseXmlGatewayProvider(
      {
        presenterId: "Presenter123",
        presenterAuthenticationCode: "Secret123",
        packageReference: "OPSLDG",
      },
      {
        environment: "test",
      },
    );

    const xml = provider.buildAccountsSubmissionXml({
      companyName: "Tamias Ltd",
      companyNumber: "SC123456",
      companyAuthenticationCode: "abc123",
      dateSigned: "2026-04-10",
      accountsIxbrl:
        '<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><body>hello</body></html>',
      submissionNumber: "aa1234",
      transactionId: "TXN-1",
      customerReference: "YE-2026-03-31",
    });

    expect(xml).toContain("<Class>Accounts</Class>");
    expect(xml).toContain("<GatewayTest>1</GatewayTest>");
    expect(xml).toContain(
      `<SenderID>${createHash("md5").update("Presenter123", "utf8").digest("hex")}</SenderID>`,
    );
    expect(xml).toContain(
      `<Value>${createHash("md5").update("Secret123", "utf8").digest("hex")}</Value>`,
    );
    expect(xml).toContain("<CompanyType>SC</CompanyType>");
    expect(xml).toContain("<CompanyNumber>123456</CompanyNumber>");
    expect(xml).toContain(
      "<CompanyAuthenticationCode>ABC123</CompanyAuthenticationCode>",
    );
    expect(xml).toContain("<SubmissionNumber>AA1234</SubmissionNumber>");
    expect(xml).toContain(
      Buffer.from(
        normalizeCompaniesHouseAccountsDocument(
          '<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><body>hello</body></html>',
        ),
        "utf8",
      ).toString("base64"),
    );
  });

  test("builds a submission-status poll request with presenter auth", () => {
    const provider = new CompaniesHouseXmlGatewayProvider(
      {
        presenterId: "Presenter123",
        presenterAuthenticationCode: "Secret123",
        packageReference: "OPSLDG",
      },
      {
        environment: "test",
      },
    );

    const xml = provider.buildSubmissionStatusRequestXml({
      submissionNumber: "AA1234",
      transactionId: "POLL-1",
    });

    expect(xml).toContain("<Class>GetSubmissionStatus</Class>");
    expect(xml).toContain("<PresenterID>Presenter123</PresenterID>");
    expect(xml).toContain("<SubmissionNumber>AA1234</SubmissionNumber>");
    expect(xml).toContain("<GatewayTest>1</GatewayTest>");
  });

  test("parses Companies House gateway submission statuses", () => {
    const message = parseCompaniesHouseGatewayMessage(`<?xml version="1.0" encoding="UTF-8"?>
<GovTalkMessage xmlns="http://www.govtalk.gov.uk/CM/envelope">
  <Header>
    <MessageDetails>
      <Class>GetSubmissionStatus</Class>
      <Qualifier>response</Qualifier>
      <TransactionID>POLL-1</TransactionID>
    </MessageDetails>
  </Header>
  <Body>
    <SubmissionStatus>
      <Status>
        <SubmissionNumber>AA1234</SubmissionNumber>
        <StatusCode>REJECT</StatusCode>
        <CompanyNumber>12345678</CompanyNumber>
        <Rejections>
          <Reject>
            <RejectCode>1000</RejectCode>
            <Description>Invalid accounts document</Description>
            <InstanceNumber>1</InstanceNumber>
          </Reject>
        </Rejections>
        <Examiner>
          <Telephone>01234 567890</Telephone>
          <Comment>See reject reason</Comment>
        </Examiner>
      </Status>
    </SubmissionStatus>
  </Body>
</GovTalkMessage>`);

    expect(message.className).toBe("GetSubmissionStatus");
    expect(message.qualifier).toBe("response");
    expect(message.transactionId).toBe("POLL-1");
    expect(message.statuses).toHaveLength(1);
    expect(message.statuses[0]?.submissionNumber).toBe("AA1234");
    expect(message.statuses[0]?.statusCode).toBe("REJECT");
    expect(message.statuses[0]?.companyNumber).toBe("12345678");
    expect(message.statuses[0]?.examinerComment).toBe("See reject reason");
    expect(message.statuses[0]?.rejections[0]?.description).toBe(
      "Invalid accounts document",
    );
  });

  test("fetches the public company profile with API-key auth", async () => {
    mockFetchFn.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          company_name: "Tamias Ltd",
          company_number: "12345678",
          company_status: "active",
          can_file: true,
          type: "ltd",
          accounts: {
            last_accounts: {
              made_up_to: "2025-03-31",
              type: "small",
            },
            next_accounts: {
              due_on: "2026-12-31",
              overdue: false,
            },
          },
        }),
      text: () => Promise.resolve(""),
    });

    const provider = createProvider();
    const profile = await provider.getCompanyProfile("12345678");

    expect(profile.companyName).toBe("Tamias Ltd");
    expect(profile.companyNumber).toBe("12345678");
    expect(profile.accounts?.lastAccounts?.madeUpTo).toBe("2025-03-31");

    const [url, init] = mockFetchFn.mock.calls[0]!;
    expect(url).toBe(
      "https://api-sandbox.company-information.service.gov.uk/company/12345678",
    );
    expect(init?.headers).toMatchObject({
      Authorization: `Basic ${Buffer.from("test-api-key:").toString("base64")}`,
    });
  });

  test("lists recent accounts filings from the public register", async () => {
    mockFetchFn.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          items: [
            {
              transaction_id: "M123",
              category: "accounts",
              date: "2025-12-20",
              description: "accounts-with-accounts-type-small",
              type: "AA",
              links: {
                document_metadata: "/document/M123",
              },
            },
          ],
          items_per_page: 5,
          start_index: 0,
          total_count: 1,
        }),
      text: () => Promise.resolve(""),
    });

    const provider = createProvider();
    const page = await provider.listFilingHistory({
      companyNumber: "12345678",
      category: "accounts",
    });

    expect(page.totalCount).toBe(1);
    expect(page.items[0]?.transactionId).toBe("M123");
    expect(page.items[0]?.category).toBe("accounts");
    expect(page.items[0]?.links?.documentMetadata).toBe("/document/M123");

    const [url] = mockFetchFn.mock.calls[0]!;
    expect(url).toBe(
      "https://api-sandbox.company-information.service.gov.uk/company/12345678/filing-history?items_per_page=5&start_index=0&category=accounts",
    );
  });

  test("upserts the registered office resource via PUT when POST collides", async () => {
    mockFetchFn
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve("Conflict"),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            premises: "12",
            address_line_1: "High Street",
            locality: "London",
            postal_code: "SW1A 1AA",
            country: "United Kingdom",
            reference_etag: "etag-1",
          }),
        text: () => Promise.resolve(""),
      });

    const provider = createProvider();
    const filing = await provider.upsertRegisteredOfficeAddressResource({
      transactionId: "txn-123",
      referenceEtag: "etag-1",
      acceptAppropriateOfficeAddressStatement: true,
      premises: "12",
      addressLine1: "High Street",
      locality: "London",
      postalCode: "SW1A 1AA",
      country: "United Kingdom",
    });

    expect(filing.premises).toBe("12");
    expect(filing.addressLine1).toBe("High Street");

    expect(mockFetchFn.mock.calls[0]?.[0]).toBe(
      "https://api-sandbox.company-information.service.gov.uk/transactions/txn-123/registered-office-address",
    );
    expect(mockFetchFn.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
    });
    expect(mockFetchFn.mock.calls[1]?.[1]).toMatchObject({
      method: "PUT",
    });
  });

  test("checks registered email eligibility", async () => {
    mockFetchFn.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          eligible: true,
        }),
      text: () => Promise.resolve(""),
    });

    const provider = createProvider();
    const eligibility =
      await provider.getRegisteredEmailAddressEligibility("12345678");

    expect(eligibility.eligible).toBe(true);

    expect(mockFetchFn.mock.calls[0]?.[0]).toBe(
      "https://api-sandbox.company-information.service.gov.uk/registered-email-address/company/12345678/eligibility",
    );
  });

  test("creates and completes a PSC discrepancy report", async () => {
    mockFetchFn
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () =>
          Promise.resolve({
            material_discrepancies: ["money-laundering"],
            company_number: "12345678",
            status: "INCOMPLETE",
            links: {
              self: "/psc-discrepancy-reports/report-1",
            },
          }),
        text: () => Promise.resolve(""),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () =>
          Promise.resolve({
            details: "Name mismatch",
            psc_name: "Jane Example",
            psc_type: "individual-person-with-significant-control",
            psc_discrepancy_types: ["Name"],
          }),
        text: () => Promise.resolve(""),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            material_discrepancies: ["money-laundering"],
            company_number: "12345678",
            status: "COMPLETE",
            links: {
              self: "/psc-discrepancy-reports/report-1",
            },
          }),
        text: () => Promise.resolve(""),
      });

    const provider = createProvider();
    const report = await provider.createPscDiscrepancyReport({
      companyNumber: "12345678",
      materialDiscrepancies: ["money-laundering"],
      status: "INCOMPLETE",
    });
    const discrepancy = await provider.createPscDiscrepancy({
      reportId: "report-1",
      details: "Name mismatch",
      pscName: "Jane Example",
      pscType: "individual-person-with-significant-control",
      pscDateOfBirth: "05/1973",
      pscDiscrepancyTypes: ["Name"],
    });
    const completed = await provider.updatePscDiscrepancyReport({
      reportId: "report-1",
      companyNumber: "12345678",
      materialDiscrepancies: ["money-laundering"],
      obligedEntityType: "financial-institution",
      obligedEntityOrganisationName: "Tamias",
      obligedEntityContactName: "Erlin Hoxha",
      obligedEntityEmail: "erlin@example.com",
      status: "COMPLETE",
    });

    expect(report.status).toBe("INCOMPLETE");
    expect(discrepancy.details).toBe("Name mismatch");
    expect(completed.status).toBe("COMPLETE");
    expect(mockFetchFn.mock.calls[0]?.[0]).toBe(
      "https://api-sandbox.company-information.service.gov.uk/psc-discrepancy-reports",
    );
    expect(mockFetchFn.mock.calls[1]?.[0]).toBe(
      "https://api-sandbox.company-information.service.gov.uk/psc-discrepancy-reports/report-1/discrepancies",
    );
    expect(mockFetchFn.mock.calls[2]?.[0]).toBe(
      "https://api-sandbox.company-information.service.gov.uk/psc-discrepancy-reports/report-1",
    );
  });
});
