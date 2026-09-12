import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import * as documents from "@tamias/app-data/queries/documents/records";
import { getCategories } from "@tamias/app-data/queries/transaction-categories";
import * as storage from "@tamias/storage";
import { SignJWT } from "jose";
import {
  createReceiptUploadUrl,
  handleR2UploadRequest,
  verifyReceiptUploadToken,
} from "../../services/r2-upload";
import { createTestApp } from "../helpers";
import { mocks } from "../setup";

const register = mock(async () => ({
  data: { path: "team/inbox/receipt.png", storageId: "team/inbox/receipt.png", url: null },
  error: null,
}));
const upsertDocuments = mock(async () => []);
mock.module("@tamias/storage", () => ({ ...storage, registerUploadedR2VaultFile: register }));
mock.module("@tamias/app-data/queries/documents/records", () => ({
  ...documents,
  upsertDocuments,
}));

const { inboxRouter } = await import("../../rest/routers/inbox");
const { invoicesRouter } = await import("../../rest/routers/invoices");
const { transactionCategoriesRouter } = await import("../../rest/routers/transaction-categories");

const invoiceId = "a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const customerId = "b2c3d4e5-6f7a-4b8c-9d0e-1f2a3b4c5d6e";
const originalSecret = process.env.FILE_KEY_SECRET;
process.env.FILE_KEY_SECRET = "native-test-secret-not-for-production";
afterAll(() => {
  if (originalSecret === undefined) delete process.env.FILE_KEY_SECRET;
  else process.env.FILE_KEY_SECRET = originalSecret;
  mocks.beginIdempotentOperation.mockReset();
  mocks.beginIdempotentOperation.mockReturnValue({
    state: "started",
    attemptCount: 1,
    leaseToken: "test-lease-token",
  });
  mocks.enqueue.mockReset();
  mocks.enqueue.mockReturnValue({ runId: "run-123" });
});

const begin = mocks.beginIdempotentOperation;
const complete = mocks.completeIdempotentOperation;
const reconcile = mocks.requireIdempotentOperationReconciliation;
const createInbox = mocks.createInbox;
const match = mocks.matchTransaction;
const confirm = mocks.confirmSuggestedMatch;
const jobs = mocks.enqueue;

function createApp(scopes?: NonNullable<Parameters<typeof createTestApp>[0]>["scopes"]) {
  const app = createTestApp({ scopes });
  app.route("/inbox", inboxRouter);
  app.route("/invoices", invoicesRouter);
  app.route("/transaction-categories", transactionCategoriesRouter);
  return app;
}
function post(body?: unknown, key = "native-key-12345678", method = "POST") {
  return {
    method,
    headers: { "content-type": "application/json", "Idempotency-Key": key },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}
const invoiceBody = {
  customerId,
  template: { currency: "GBP", includeVat: true, vatRate: 20 },
  deliveryType: "draft",
  issueDate: "2026-09-08T00:00:00Z",
  dueDate: "2026-10-08T00:00:00Z",
  lineItems: [
    {
      name: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Consulting" }] }],
      },
      price: 100,
      quantity: 2,
    },
  ],
  amount: 240,
};
const draft = {
  id: invoiceId,
  status: "draft",
  invoiceNumber: "INV-42",
  createdAt: "2026-09-08T00:00:00Z",
  updatedAt: "2026-09-08T00:00:00Z",
  token: null,
};

beforeEach(() => {
  begin.mockReset();
  begin.mockImplementation(() => ({ state: "started", attemptCount: 1, leaseToken: "lease" }));
  complete.mockClear();
  reconcile.mockClear();
  createInbox.mockReset();
  match.mockReset();
  confirm.mockReset();
  jobs.mockReset();
  jobs.mockImplementation(() => Promise.resolve({ runId: "receipt-job" }));
  register.mockClear();
  upsertDocuments.mockClear();
  mocks.getInboxItemById.mockReset();
  mocks.getTransactionById.mockReset();
  mocks.updateInbox.mockReset();
  mocks.getCustomerById.mockReset();
  mocks.getCustomerById.mockReturnValue({
    id: customerId,
    name: "Customer",
    email: "customer@example.com",
  });
  mocks.getInvoiceById.mockReset();
  mocks.getInvoiceById.mockReturnValue(draft);
  mocks.draftInvoice.mockReset();
  mocks.draftInvoice.mockReturnValue(draft);
  mocks.updateInvoice.mockReset();
  mocks.updateInvoice.mockReturnValue({ ...draft, status: "unpaid" });
});

describe("native receipt REST workflow", () => {
  test("requires inbox write scope and rejects traversal and oversized uploads", async () => {
    const body = { fileName: "receipt.png", contentType: "image/png", size: 3 };
    expect(
      (await createApp(["transactions.read"]).request("/inbox/uploads", post(body))).status,
    ).toBe(403);
    expect(
      (await createApp().request("/inbox/uploads", post({ ...body, fileName: "../receipt.png" })))
        .status,
    ).toBe(400);
    expect(
      (await createApp().request("/inbox/uploads", post({ ...body, size: 21 * 1024 * 1024 })))
        .status,
    ).toBe(400);
  });

  test("signed upload enforces team, exact bytes and MIME before storing", async () => {
    const ticket = await createReceiptUploadUrl(
      { teamId: "test-team-id", fileName: "receipt.png", contentType: "image/png", size: 3 },
      "https://api.example.com",
    );
    await expect(verifyReceiptUploadToken(ticket.uploadToken, "another-team")).rejects.toThrow();
    const put = mock(async () => undefined);
    const bucket = { put, get: mock(async () => null), delete: mock(async () => undefined) };
    expect(
      (
        await handleR2UploadRequest(
          new Request(ticket.uploadUrl, {
            method: "POST",
            body: "four",
            headers: { "content-type": "image/png" },
          }),
          { VAULT_BUCKET: bucket },
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await handleR2UploadRequest(
          new Request(ticket.uploadUrl, {
            method: "POST",
            body: "abc",
            headers: { "content-type": "text/html" },
          }),
          { VAULT_BUCKET: bucket },
        )
      ).status,
    ).toBe(400);
    expect(put).not.toHaveBeenCalled();
    expect(
      (
        await handleR2UploadRequest(
          new Request(ticket.uploadUrl, {
            method: "POST",
            body: "abc",
            headers: { "content-type": "image/png" },
          }),
          { VAULT_BUCKET: bucket },
        )
      ).status,
    ).toBe(200);
    expect(put).toHaveBeenCalledTimes(1);
  });

  test("completion replays durable result before expired ticket validation", async () => {
    const expired = await new SignJWT({
      storageId: "tmp/uploads/expired",
      teamId: "test-team-id",
      purpose: "receipt",
      fileName: "a.png",
      size: 3,
      contentType: "image/png",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setAudience("tamias:r2-upload")
      .setExpirationTime(1)
      .sign(new TextEncoder().encode(process.env.FILE_KEY_SECRET));
    const result = {
      id: "receipt-id",
      status: "new",
      filePath: ["test-team-id", "inbox", "a.png"],
    };
    begin.mockReturnValue({ state: "replayed", result });
    const response = await createApp().request(
      "/inbox/uploads/complete",
      post({ uploadToken: expired }),
    );
    expect(response.status).toBe(201);
    expect((await response.json()) as typeof result).toEqual(result);
    expect(register).not.toHaveBeenCalled();
    expect(createInbox).not.toHaveBeenCalled();
  });

  test("expired upload tickets can renew only when the durable attempt has no ambiguous write", async () => {
    const expired = await new SignJWT({
      storageId: "tmp/uploads/expired",
      teamId: "test-team-id",
      purpose: "receipt",
      fileName: "a.png",
      size: 3,
      contentType: "image/png",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setAudience("tamias:r2-upload")
      .setExpirationTime(1)
      .sign(new TextEncoder().encode(process.env.FILE_KEY_SECRET));
    const request = () =>
      createApp().request("/inbox/uploads/complete", post({ uploadToken: expired }));
    const first = await request();
    expect(first.status).toBe(410);
    expect(((await first.json()) as { code: string }).code).toBe("upload_ticket_expired");
    begin.mockReturnValue({
      state: "started",
      attemptCount: 2,
      leaseToken: "lease",
      resumedFrom: "expired_lease",
    });
    const ambiguous = await request();
    expect(ambiguous.status).toBe(409);
    expect(((await ambiguous.json()) as { code: string }).code).toBe("reconciliation_required");
    begin.mockReturnValue({
      state: "started",
      attemptCount: 2,
      leaseToken: "lease",
      resumedFrom: "failed",
    });
    expect((await request()).status).toBe(410);
    expect(register).not.toHaveBeenCalled();
    expect(createInbox).not.toHaveBeenCalled();
  });

  test("rejects completing another team's ticket before registration", async () => {
    const ticket = await createReceiptUploadUrl(
      { teamId: "another-team", fileName: "receipt.png", contentType: "image/png", size: 3 },
      "https://api.example.com",
    );
    const response = await createApp().request(
      "/inbox/uploads/complete",
      post({ uploadToken: ticket.uploadToken }),
    );
    expect(response.status).toBe(400);
    expect(register).not.toHaveBeenCalled();
  });

  test("completion stores reviewed metadata and team-owned path", async () => {
    const ticket = await createReceiptUploadUrl(
      { teamId: "test-team-id", fileName: "receipt.png", contentType: "image/png", size: 3 },
      "https://api.example.com",
    );
    createInbox.mockReturnValue({ id: "receipt-id" });
    const env = {
      VAULT_BUCKET: {
        head: mock(async () => ({ size: 3, httpMetadata: { contentType: "image/png" } })),
      },
    };
    const response = await createApp().request(
      "/inbox/uploads/complete",
      post({
        uploadToken: ticket.uploadToken,
        displayName: "Reviewed merchant",
        amount: 18.5,
        currency: "gbp",
        date: "2026-09-07",
        note: "Project supplies",
      }),
      env,
    );
    expect(response.status).toBe(201);
    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({
        pathTokens: ["test-team-id", "inbox", expect.any(String), "receipt.png"],
        storageId: ticket.storageId,
      }),
    );
    expect(mocks.updateInbox).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: "receipt-id",
        amount: 18.5,
        currency: "GBP",
        date: "2026-09-07",
        description: "Project supplies",
      }),
    );
    expect(complete).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        scope: "inbox.rest.upload.complete",
        audit: expect.objectContaining({ resourceType: "inbox" }),
      }),
    );
  });

  test("processing rejects wrong-team attachment paths and queues only scoped file metadata", async () => {
    mocks.getInboxItemById.mockReturnValue({
      id: "receipt",
      filePath: ["another-team", "a.png"],
      size: 3,
      contentType: "image/png",
    });
    expect((await createApp().request("/inbox/receipt/process", post())).status).toBe(400);
    expect(jobs).not.toHaveBeenCalled();
    mocks.getInboxItemById.mockReturnValue({
      id: "receipt",
      filePath: ["test-team-id", "a.png"],
      size: 3,
      contentType: "image/png",
    });
    expect((await createApp().request("/inbox/receipt/process", post())).status).toBe(202);
    expect(jobs).toHaveBeenCalledWith(
      "process-attachment",
      expect.objectContaining({ teamId: "test-team-id", filePath: ["test-team-id", "a.png"] }),
      "inbox",
      { publicTeamId: "test-team-id" },
    );
  });

  test("reading suggestions preserves transaction data and confirming uses the reviewed suggestion", async () => {
    const transaction = {
      id: "tx",
      name: "Merchant",
      date: "2026-09-07",
      amount: -18.5,
      currency: "GBP",
    };
    mocks.getInboxItemById.mockReturnValue({
      id: "receipt",
      transaction: null,
      suggestion: {
        id: "suggestion",
        transactionId: "tx",
        confidenceScore: 0.95,
        matchType: "amount_date",
        status: "pending",
        suggestedTransaction: transaction,
      },
    });
    mocks.getTransactionById.mockReturnValue(transaction);
    confirm.mockReturnValue({ id: "receipt", transactionId: "tx" });
    const suggestions = await createApp().request("/inbox/receipt/matches");
    expect(suggestions.status).toBe(200);
    expect((await suggestions.json()) as { data: unknown[] }).toEqual({
      data: [
        {
          id: "suggestion",
          transactionId: "tx",
          confidenceScore: 0.95,
          matchType: "amount_date",
          status: "pending",
          transaction,
        },
      ],
    });
    const result = await createApp().request(
      "/inbox/receipt/match",
      post({ transactionId: "tx", suggestionId: "suggestion" }),
    );
    expect(result.status).toBe(200);
    expect(confirm).toHaveBeenCalledWith(expect.anything(), {
      teamId: "test-team-id",
      inboxId: "receipt",
      transactionId: "tx",
      suggestionId: "suggestion",
      userId: "test-user-id",
    });
    expect(match).not.toHaveBeenCalled();
  });

  test("write endpoints reject missing retry keys before touching services", async () => {
    const withoutKey = {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transactionId: "tx" }),
    };
    expect((await createApp().request("/inbox/receipt/match", withoutKey)).status).toBe(400);
    expect((await createApp().request("/inbox/receipt/process", withoutKey)).status).toBe(400);
    expect(begin).not.toHaveBeenCalled();
    expect(jobs).not.toHaveBeenCalled();
  });

  test("matching requires both write scopes and refuses cross-team or stale suggestions", async () => {
    expect(
      (
        await createApp(["inbox.write"]).request(
          "/inbox/receipt/match",
          post({ transactionId: "tx" }),
        )
      ).status,
    ).toBe(403);
    mocks.getInboxItemById.mockReturnValue({
      id: "receipt",
      transaction: null,
      suggestion: { id: "suggestion", transactionId: "correct" },
    });
    mocks.getTransactionById.mockReturnValue(null);
    expect(
      (await createApp().request("/inbox/receipt/match", post({ transactionId: "tx" }))).status,
    ).toBe(404);
    mocks.getTransactionById.mockReturnValue({ id: "tx" });
    expect(
      (
        await createApp().request(
          "/inbox/receipt/match",
          post({ transactionId: "tx", suggestionId: "suggestion" }),
        )
      ).status,
    ).toBe(409);
    expect(match).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });

  test("matching attaches once through existing service and reconciles ambiguous failure", async () => {
    mocks.getInboxItemById.mockReturnValue({ id: "receipt", transaction: null, suggestion: null });
    mocks.getTransactionById.mockReturnValue({ id: "tx" });
    match.mockRejectedValue(new Error("write interrupted"));
    const response = await createApp().request(
      "/inbox/receipt/match",
      post({ transactionId: "tx" }),
    );
    expect(response.status).toBe(409);
    const body = (await response.json()) as { code: string; description: string };
    expect(body.code).toBe("reconciliation_required");
    expect(body.description).toContain("do not use a new retry key");
    expect(body.description).not.toContain("write interrupted");
    expect(reconcile).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        scope: "inbox.rest.match",
        providerResult: { inboxId: "receipt", transactionId: "tx" },
      }),
    );
  });

  test("in-progress or changed retry requests return actionable conflict codes without writes", async () => {
    for (const [message, code] of [
      ["An operation with this idempotency key is already in progress", "in_progress"],
      ["Idempotency key was already used with a different request", "different_request"],
      [
        "This operation requires manual reconciliation before it can be attempted again",
        "reconciliation_required",
      ],
    ] as const) {
      begin.mockRejectedValue(new Error(message));
      const response = await createApp().request("/inbox/receipt/process", post());
      expect(response.status).toBe(409);
      expect(((await response.json()) as { code: string }).code).toBe(code);
    }
    expect(jobs).not.toHaveBeenCalled();
  });

  test("category catalogue includes children from the authenticated team", async () => {
    mocks.getCategories.mockReturnValue([
      {
        id: "parent",
        slug: "travel",
        name: "Travel",
        color: null,
        parentId: null,
        taxRate: null,
        taxType: null,
        children: [
          {
            id: "child",
            slug: "flights",
            name: "Flights",
            parentId: "parent",
            color: null,
            taxRate: 0,
            taxType: null,
          },
        ],
      },
    ] as Awaited<ReturnType<typeof getCategories>>);
    const response = await createApp().request("/transaction-categories");
    expect(response.status).toBe(200);
    expect(((await response.json()) as { data: unknown[] }).data).toHaveLength(2);
    expect(getCategories).toHaveBeenCalledWith(expect.anything(), { teamId: "test-team-id" });
  });
});

describe("native invoice draft REST workflow", () => {
  test("generates the OpenAPI document for native routes with forbidden scheduling documented", () => {
    const document = createApp().getOpenAPIDocument({
      openapi: "3.1.0",
      info: { title: "Tamias API", version: "1.0.0" },
    });
    expect(document.paths?.["/inbox/uploads"]?.post).toBeDefined();
    expect(document.paths?.["/inbox/{id}/match"]?.post).toBeDefined();
    expect(document.paths?.["/transaction-categories"]?.get).toBeDefined();
    for (const [path, method] of [
      ["/invoices/{id}/draft", "put"],
      ["/invoices/{id}/issue", "post"],
    ] as const) {
      const operation = document.paths?.[path]?.[method];
      expect(operation).toBeDefined();
      expect(JSON.stringify(operation)).toContain('"scheduledAt":{"type":"string","not":{}}');
    }
  });

  test("draft and issue endpoints still reject scheduledAt before mutating", async () => {
    for (const operation of ["draft", "issue"] as const) {
      const response = await createApp().request(
        `/invoices/${invoiceId}/${operation}`,
        post(
          {
            ...invoiceBody,
            deliveryType: operation === "draft" ? "draft" : "create",
            scheduledAt: "2099-01-01T00:00:00Z",
          },
          "scheduled-key-12345678",
          operation === "draft" ? "PUT" : "POST",
        ),
      );
      expect(response.status).toBe(400);
    }
    expect(mocks.draftInvoice).not.toHaveBeenCalled();
    expect(mocks.updateInvoice).not.toHaveBeenCalled();
    expect(jobs).not.toHaveBeenCalled();
  });

  test("saving a draft never finalizes or sends and preserves full invoice fields", async () => {
    const response = await createApp().request("/invoices", post(invoiceBody));
    expect(response.status).toBe(201);
    expect(((await response.json()) as { status: string }).status).toBe("draft");
    expect(mocks.updateInvoice).not.toHaveBeenCalled();
    expect(jobs).not.toHaveBeenCalled();
    expect(mocks.draftInvoice).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        customerId,
        amount: 240,
        template: expect.objectContaining({ currency: "GBP", vatRate: 20 }),
        lineItems: [expect.objectContaining({ price: 100, quantity: 2 })],
      }),
    );
  });

  test("editing remote draft preserves the invoice ID and allocated number", async () => {
    const response = await createApp().request(
      `/invoices/${invoiceId}/draft`,
      post(invoiceBody, "edit-key-12345678", "PUT"),
    );
    expect(response.status).toBe(200);
    expect(mocks.draftInvoice).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: invoiceId, invoiceNumber: "INV-42" }),
    );
    expect(jobs).not.toHaveBeenCalled();
  });

  test("issuing uses the same draft and rejects absent, sent, or mismatched endpoint intent", async () => {
    expect(
      (await createApp().request(`/invoices/${invoiceId}/issue`, post(invoiceBody))).status,
    ).toBe(400);
    mocks.getInvoiceById.mockReturnValue(null);
    expect(
      (
        await createApp().request(
          `/invoices/${invoiceId}/issue`,
          post({ ...invoiceBody, deliveryType: "create" }),
        )
      ).status,
    ).toBe(404);
    mocks.getInvoiceById.mockReturnValue({ ...draft, status: "unpaid" });
    expect(
      (
        await createApp().request(
          `/invoices/${invoiceId}/issue`,
          post({ ...invoiceBody, deliveryType: "create_and_send" }),
        )
      ).status,
    ).toBe(409);
    expect(mocks.draftInvoice).not.toHaveBeenCalled();
    expect(jobs).not.toHaveBeenCalled();
    mocks.getInvoiceById.mockReturnValue(draft);
    const response = await createApp().request(
      `/invoices/${invoiceId}/issue`,
      post({ ...invoiceBody, deliveryType: "create" }),
    );
    expect(response.status).toBe(200);
    expect(mocks.updateInvoice).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: invoiceId, status: "unpaid", teamId: "test-team-id" }),
    );
    expect(jobs).toHaveBeenCalledWith(
      "generate-invoice",
      { invoiceId, deliveryType: "create" },
      "invoices",
    );
  });

  test("replayed issue returns existing response without re-issuing or re-sending", async () => {
    begin.mockReturnValue({ state: "replayed", result: { ...draft, status: "unpaid" } });
    const response = await createApp().request(
      `/invoices/${invoiceId}/issue`,
      post({ ...invoiceBody, deliveryType: "create_and_send" }),
    );
    expect(response.status).toBe(200);
    expect(mocks.draftInvoice).not.toHaveBeenCalled();
    expect(jobs).not.toHaveBeenCalled();
  });

  test("changed reviewed recipients are refused before draft mutation or delivery", async () => {
    const input = {
      ...invoiceBody,
      deliveryType: "create_and_send",
      expectedCustomerEmail: "reviewed@example.com",
      expectedBillingEmails: [],
    };
    const response = await createApp().request(`/invoices/${invoiceId}/issue`, post(input));
    expect(response.status).toBe(409);
    expect(((await response.json()) as { code: string }).code).toBe("invoice_review_changed");
    expect(mocks.draftInvoice).not.toHaveBeenCalled();
    expect(jobs).not.toHaveBeenCalled();
    mocks.getCustomerById.mockReturnValue({
      id: customerId,
      name: "Customer",
      email: "reviewed@example.com",
      billingEmail: "hidden@example.com",
    });
    expect((await createApp().request(`/invoices/${invoiceId}/issue`, post(input))).status).toBe(
      409,
    );
  });

  test("reviewed recipients are forwarded through generation for send-time enforcement", async () => {
    mocks.getCustomerById.mockReturnValue({
      id: customerId,
      name: "Customer",
      email: "customer@example.com",
      billingEmail: "billing@example.com",
    });
    const input = {
      ...invoiceBody,
      deliveryType: "create_and_send",
      expectedCustomerEmail: "customer@example.com",
      expectedBillingEmails: ["billing@example.com"],
    };
    expect((await createApp().request(`/invoices/${invoiceId}/issue`, post(input))).status).toBe(
      200,
    );
    expect(jobs).toHaveBeenCalledWith(
      "generate-invoice",
      {
        invoiceId,
        deliveryType: "create_and_send",
        expectedCustomerEmail: "customer@example.com",
        expectedBillingEmails: ["billing@example.com"],
      },
      "invoices",
    );
  });

  test("a failed finalization never enqueues PDF generation or sending", async () => {
    mocks.updateInvoice.mockReturnValue(null);
    expect(
      (
        await createApp().request(
          `/invoices/${invoiceId}/issue`,
          post({ ...invoiceBody, deliveryType: "create" }),
        )
      ).status,
    ).toBe(409);
    expect(jobs).not.toHaveBeenCalled();
    expect(reconcile).toHaveBeenCalled();
  });

  test("a client total inconsistent with lines is rejected before persisting", async () => {
    const response = await createApp().request("/invoices", post({ ...invoiceBody, amount: 1 }));
    expect(response.status).toBe(400);
    expect(mocks.draftInvoice).not.toHaveBeenCalled();
    expect(jobs).not.toHaveBeenCalled();
  });

  test("fractional quantities, VAT and discounts use shared calculation with currency rounding", async () => {
    const line = { ...invoiceBody.lineItems[0], price: 19.99, quantity: 1.25 };
    const input = { ...invoiceBody, lineItems: [line], amount: 27.49, vat: 5, discount: 2.5 };
    expect((await createApp().request("/invoices", post(input))).status).toBe(201);
    expect(mocks.draftInvoice).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ amount: 27.49, subtotal: 24.99, vat: 5, tax: 0, discount: 2.5 }),
    );
  });

  test("line-item tax takes precedence over invoice tax and remains in persisted totals", async () => {
    const input = {
      ...invoiceBody,
      template: {
        currency: "GBP",
        includeVat: false,
        includeTax: true,
        taxRate: 99,
        includeLineItemTax: true,
      },
      amount: 210,
      vat: 0,
      tax: 10,
      lineItems: [{ ...invoiceBody.lineItems[0], taxRate: 5 }],
    };
    expect((await createApp().request("/invoices", post(input))).status).toBe(201);
    expect(mocks.draftInvoice).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ amount: 210, subtotal: 200, vat: 0, tax: 10 }),
    );
  });
});
