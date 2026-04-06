import { describe, expect, test } from "bun:test";
import {
  buildCloudflareRecurringScheduleId,
  buildCloudflareRecurringScheduleMessage,
  getNextRecurringScheduleAlarmAt,
  getScheduledCloudflareMessages,
  isBridgeAuthorized,
  isCloudflareRecurringScheduleRequest,
  isCloudflareWorkflowInstanceRequest,
  isSupportedCloudflareMessage,
  isCloudflareWorkflowStartRequest,
  toDelaySeconds,
} from "./bridge-helpers";

describe("Cloudflare async bridge helpers", () => {
  test("converts millisecond delays to queue delay seconds", () => {
    expect(toDelaySeconds()).toBeUndefined();
    expect(toDelaySeconds(1)).toBe(1);
    expect(toDelaySeconds(999)).toBe(1);
    expect(toDelaySeconds(1000)).toBe(1);
    expect(toDelaySeconds(1500)).toBe(2);
  });

  test("only accepts supported bridged job domains", () => {
    expect(
      isSupportedCloudflareMessage({
        queue: "capture",
        queueName: "inbox",
        jobName: "no-match-scheduler",
        payload: {},
      }),
    ).toBe(true);

    expect(
      isSupportedCloudflareMessage({
        queue: "capture",
        queueName: "inbox",
        jobName: "batch-process-matching",
        payload: {
          teamId: "11111111-1111-1111-1111-111111111111",
          inboxIds: ["22222222-2222-2222-2222-222222222222"],
        },
      }),
    ).toBe(true);

    expect(
      isSupportedCloudflareMessage({
        queue: "capture",
        queueName: "inbox",
        jobName: "match-transactions-bidirectional",
        payload: {
          teamId: "11111111-1111-1111-1111-111111111111",
          newTransactionIds: ["22222222-2222-2222-2222-222222222222"],
        },
      }),
    ).toBe(true);

    expect(
      isSupportedCloudflareMessage({
        queue: "capture",
        queueName: "inbox",
        jobName: "process-attachment",
        payload: {
          teamId: "11111111-1111-1111-1111-111111111111",
          mimetype: "application/pdf",
          size: 1024,
          filePath: ["team_123", "inbox", "invoice.pdf"],
        },
      }),
    ).toBe(true);

    expect(
      isSupportedCloudflareMessage({
        queue: "capture",
        queueName: "inbox",
        jobName: "slack-upload",
        payload: {
          teamId: "11111111-1111-1111-1111-111111111111",
          token: "xoxb-test",
          channelId: "C12345678",
          file: {
            id: "F12345678",
            name: "receipt.jpg",
            mimetype: "image/jpeg",
            size: 2048,
            url: "https://files.slack.com/test",
          },
        },
      }),
    ).toBe(true);

    expect(
      isSupportedCloudflareMessage({
        queue: "capture",
        queueName: "inbox",
        jobName: "whatsapp-upload",
        payload: {
          teamId: "11111111-1111-1111-1111-111111111111",
          phoneNumber: "+441234567890",
          messageId: "wamid.HBgLNQ",
          mediaId: "1234567890",
          mimeType: "image/jpeg",
        },
      }),
    ).toBe(true);

    expect(
      isSupportedCloudflareMessage({
        queue: "capture",
        queueName: "inbox-provider",
        jobName: "initial-setup",
        payload: {
          inboxAccountId: "11111111-1111-1111-1111-111111111111",
        },
      }),
    ).toBe(true);

    expect(
      isSupportedCloudflareMessage({
        queue: "capture",
        queueName: "institutions",
        jobName: "sync-institutions",
        payload: {},
      }),
    ).toBe(true);

    expect(
      isSupportedCloudflareMessage({
        queue: "capture",
        queueName: "rates",
        jobName: "rates-scheduler",
        payload: {},
      }),
    ).toBe(true);

    expect(
      isSupportedCloudflareMessage({
        queue: "capture",
        queueName: "documents",
        jobName: "process-document",
        payload: {
          filePath: ["team_123", "invoice.pdf"],
          mimetype: "application/pdf",
          teamId: "11111111-1111-1111-1111-111111111111",
        },
      }),
    ).toBe(true);

    expect(
      isSupportedCloudflareMessage({
        queue: "capture",
        queueName: "documents",
        jobName: "classify-image",
        payload: {
          fileName: "team_123/receipt.jpg",
          teamId: "11111111-1111-1111-1111-111111111111",
        },
      }),
    ).toBe(true);

    expect(
      isSupportedCloudflareMessage({
        queue: "capture",
        queueName: "documents",
        jobName: "classify-document",
        payload: {
          fileName: "team_123/invoice.pdf",
          content: "Invoice total 100.00",
          teamId: "11111111-1111-1111-1111-111111111111",
        },
      }),
    ).toBe(true);

    expect(
      isSupportedCloudflareMessage({
        queue: "capture",
        queueName: "documents",
        jobName: "embed-document-tags",
        payload: {
          documentId: "22222222-2222-2222-2222-222222222222",
          teamId: "11111111-1111-1111-1111-111111111111",
          tags: ["invoice", "expenses"],
        },
      }),
    ).toBe(true);

    expect(
      isSupportedCloudflareMessage({
        queue: "ledger",
        queueName: "notifications",
        jobName: "notification",
        payload: {},
      }),
    ).toBe(true);

    expect(
      isSupportedCloudflareMessage({
        queue: "ledger",
        queueName: "invoices",
        jobName: "invoice-recurring-scheduler",
        payload: {},
      }),
    ).toBe(true);

    expect(
      isSupportedCloudflareMessage({
        queue: "ledger",
        queueName: "invoices",
        jobName: "invoice-status-scheduler",
        payload: {},
      }),
    ).toBe(true);

    expect(
      isSupportedCloudflareMessage({
        queue: "ledger",
        queueName: "invoices",
        jobName: "invoice-upcoming-notification",
        payload: {},
      }),
    ).toBe(true);

    expect(
      isSupportedCloudflareMessage({
        queue: "ledger",
        queueName: "invoices",
        jobName: "generate-invoice",
        payload: {
          invoiceId: "11111111-1111-1111-1111-111111111111",
          deliveryType: "create_and_send",
        },
      }),
    ).toBe(true);

    expect(
      isSupportedCloudflareMessage({
        queue: "ledger",
        queueName: "invoices",
        jobName: "send-invoice-email",
        payload: {
          invoiceId: "11111111-1111-1111-1111-111111111111",
          filename: "INV-001.pdf",
          fullPath: "team/invoices/INV-001.pdf",
        },
      }),
    ).toBe(true);

    expect(
      isSupportedCloudflareMessage({
        queue: "ledger",
        queueName: "invoices",
        jobName: "send-invoice-reminder",
        payload: {
          invoiceId: "11111111-1111-1111-1111-111111111111",
        },
      }),
    ).toBe(true);

    expect(
      isSupportedCloudflareMessage({
        queue: "ledger",
        queueName: "invoices",
        jobName: "schedule-invoice",
        payload: {
          invoiceId: "11111111-1111-1111-1111-111111111111",
        },
      }),
    ).toBe(true);

    expect(
      isSupportedCloudflareMessage({
        queue: "ledger",
        queueName: "insights",
        jobName: "dispatch-insights",
        payload: {
          periodType: "weekly",
        },
      }),
    ).toBe(true);

    expect(
      isSupportedCloudflareMessage({
        queue: "ledger",
        queueName: "insights",
        jobName: "generate-team-insights",
        payload: {
          teamId: "11111111-1111-1111-1111-111111111111",
          periodType: "weekly",
          periodYear: 2026,
          periodNumber: 13,
          currency: "USD",
          locale: "en",
        },
      }),
    ).toBe(true);

    expect(
      isSupportedCloudflareMessage({
        queue: "ledger",
        queueName: "teams",
        jobName: "invite-team-members",
        payload: {
          teamId: "11111111-1111-1111-1111-111111111111",
          ip: "127.0.0.1",
          locale: "en",
          invites: [
            {
              email: "invitee@example.com",
              invitedByName: "Alex Example",
              invitedByEmail: "alex@example.com",
              teamName: "Tamias",
            },
          ],
        },
      }),
    ).toBe(true);

    expect(
      isSupportedCloudflareMessage({
        queue: "ledger",
        queueName: "teams",
        jobName: "payment-issue",
        payload: {},
      }),
    ).toBe(true);

    expect(
      isSupportedCloudflareMessage({
        queue: "ledger",
        queueName: "teams",
        jobName: "delete-team",
        payload: {},
      }),
    ).toBe(true);

    expect(
      isSupportedCloudflareMessage({
        queue: "ledger",
        queueName: "transactions",
        jobName: "bank-sync-scheduler",
        payload: {
          teamId: "team_123",
        },
      }),
    ).toBe(true);

    expect(
      isSupportedCloudflareMessage({
        queue: "ledger",
        queueName: "transactions",
        jobName: "delete-connection",
        payload: {
          referenceId: "req_123",
          provider: "gocardless",
        },
      }),
    ).toBe(true);

    expect(
      isSupportedCloudflareMessage({
        queue: "ledger",
        queueName: "transactions",
        jobName: "enrich-transactions",
        payload: {
          teamId: "11111111-1111-1111-1111-111111111111",
          transactionIds: ["22222222-2222-2222-2222-222222222222"],
        },
      }),
    ).toBe(true);

    expect(
      isSupportedCloudflareMessage({
        queue: "ledger",
        queueName: "transactions",
        jobName: "export-transactions",
        payload: {
          teamId: "11111111-1111-1111-1111-111111111111",
          userId: "user_123",
          locale: "en-GB",
          transactionIds: ["22222222-2222-2222-2222-222222222222"],
        },
      }),
    ).toBe(true);

    expect(
      isSupportedCloudflareMessage({
        queue: "ledger",
        queueName: "transactions",
        jobName: "import-transactions",
        payload: {
          teamId: "11111111-1111-1111-1111-111111111111",
          bankAccountId: "22222222-2222-2222-2222-222222222222",
          currency: "USD",
          mappings: {
            amount: "Amount",
            date: "Date",
            description: "Description",
          },
          inverted: false,
        },
      }),
    ).toBe(true);

    expect(
      isSupportedCloudflareMessage({
        queue: "ledger",
        queueName: "transactions",
        jobName: "process-transaction-attachment",
        payload: {
          transactionId: "11111111-1111-1111-1111-111111111111",
          teamId: "22222222-2222-2222-2222-222222222222",
          mimetype: "image/jpeg",
          filePath: ["team_123", "vault", "receipt.jpg"],
        },
      }),
    ).toBe(true);

    expect(
      isSupportedCloudflareMessage({
        queue: "ledger",
        queueName: "accounting",
        jobName: "export-to-accounting",
        payload: {
          teamId: "11111111-1111-1111-1111-111111111111",
          userId: "user_123",
          providerId: "xero",
          transactionIds: ["22222222-2222-2222-2222-222222222222"],
        },
      }),
    ).toBe(true);

    expect(
      isSupportedCloudflareMessage({
        queue: "ledger",
        queueName: "accounting",
        jobName: "sync-accounting-attachments",
        payload: {
          teamId: "11111111-1111-1111-1111-111111111111",
          providerId: "xero",
          transactionId: "22222222-2222-2222-2222-222222222222",
          providerTransactionId: "provider_tx_123",
          attachmentIds: ["33333333-3333-3333-3333-333333333333"],
        },
      }),
    ).toBe(true);

    expect(
      isSupportedCloudflareMessage({
        queue: "ledger",
        queueName: "transactions",
        jobName: "reconnect-connection",
        payload: {
          teamId: "11111111-1111-1111-1111-111111111111",
          connectionId: "22222222-2222-2222-2222-222222222222",
          provider: "plaid",
        },
      }),
    ).toBe(true);

    expect(
      isSupportedCloudflareMessage({
        queue: "ledger",
        queueName: "transactions",
        jobName: "update-account-base-currency",
        payload: {
          accountId: "11111111-1111-1111-1111-111111111111",
          currency: "USD",
          balance: 1000,
          baseCurrency: "GBP",
        },
      }),
    ).toBe(true);

    expect(
      isSupportedCloudflareMessage({
        queue: "ledger",
        queueName: "transactions",
        jobName: "update-base-currency",
        payload: {
          teamId: "11111111-1111-1111-1111-111111111111",
          baseCurrency: "GBP",
        },
      }),
    ).toBe(true);

    expect(
      isSupportedCloudflareMessage({
        queue: "ledger",
        queueName: "customers",
        jobName: "enrich-customer",
        payload: {
          customerId: "11111111-1111-1111-1111-111111111111",
          teamId: "22222222-2222-2222-2222-222222222222",
        },
      }),
    ).toBe(true);

    expect(
      isSupportedCloudflareMessage({
        queue: "ledger",
        queueName: "transactions",
        jobName: "sync-connection",
        payload: {
          connectionId: "11111111-1111-1111-1111-111111111111",
          manualSync: false,
        },
      }),
    ).toBe(true);

    expect(
      isSupportedCloudflareMessage({
        queue: "ledger",
        queueName: "transactions",
        jobName: "transaction-notifications",
        payload: {
          teamId: "11111111-1111-1111-1111-111111111111",
        },
      }),
    ).toBe(true);

    expect(
      isSupportedCloudflareMessage({
        queue: "ledger",
        queueName: "invoices",
        jobName: "unknown-invoice-job",
        payload: {},
      }),
    ).toBe(false);
  });

  test("maps supported cron triggers to queue messages", () => {
    expect(getScheduledCloudflareMessages("0 2 * * *")).toEqual([
      {
        queue: "capture",
        queueName: "inbox",
        jobName: "no-match-scheduler",
        payload: {},
        maxAttempts: 3,
      },
    ]);

    expect(getScheduledCloudflareMessages("0 3 * * *")).toEqual([
      {
        queue: "capture",
        queueName: "institutions",
        jobName: "sync-institutions",
        payload: {},
        maxAttempts: 3,
      },
    ]);

    expect(getScheduledCloudflareMessages("*/30 * * * *", Date.UTC(2026, 2, 29, 12, 0, 0))).toEqual(
      [
        {
          queue: "ledger",
          queueName: "invoices",
          jobName: "invoice-recurring-scheduler",
          payload: {},
          maxAttempts: 3,
        },
      ],
    );

    expect(
      getScheduledCloudflareMessages("*/30 * * * *", Date.UTC(2026, 2, 29, 12, 30, 0)),
    ).toEqual([
      {
        queue: "ledger",
        queueName: "invoices",
        jobName: "invoice-upcoming-notification",
        payload: {},
        maxAttempts: 3,
      },
    ]);

    expect(getScheduledCloudflareMessages("*/30 * * * 1")).toEqual([
      {
        queue: "ledger",
        queueName: "insights",
        jobName: "dispatch-insights",
        payload: {
          periodType: "weekly",
        },
        maxAttempts: 3,
      },
    ]);

    expect(getScheduledCloudflareMessages("0 0,12 * * *")).toEqual([
      {
        queue: "capture",
        queueName: "rates",
        jobName: "rates-scheduler",
        payload: {},
        maxAttempts: 3,
      },
      {
        queue: "ledger",
        queueName: "invoices",
        jobName: "invoice-status-scheduler",
        payload: {},
        maxAttempts: 3,
      },
    ]);

    expect(
      getScheduledCloudflareMessages("*/30 * * * *", Date.UTC(2026, 2, 29, 12, 15, 0)),
    ).toEqual([]);

    expect(getScheduledCloudflareMessages("*/15 * * * *")).toEqual([]);
  });

  test("builds recurring inbox schedule ids and messages", () => {
    expect(
      buildCloudflareRecurringScheduleId(
        "inbox-sync-scheduler",
        "inbox_account_123",
        "inbox_account_123-inbox-sync-scheduler",
      ),
    ).toBe("cloudflare-schedule:inbox-sync-scheduler:inbox_account_123");

    expect(
      buildCloudflareRecurringScheduleMessage("inbox-sync-scheduler", "inbox_account_123"),
    ).toEqual({
      queue: "capture",
      queueName: "inbox-provider",
      jobName: "sync-scheduler",
      payload: {
        id: "inbox_account_123",
        manualSync: false,
      },
      maxAttempts: 4,
    });

    expect(buildCloudflareRecurringScheduleMessage("bank-sync-scheduler", "team_123")).toEqual({
      queue: "ledger",
      queueName: "transactions",
      jobName: "bank-sync-scheduler",
      payload: {
        teamId: "team_123",
      },
      maxAttempts: 3,
    });
  });

  test("computes the next recurring alarm time for quarter-daily schedules", () => {
    const now = Date.UTC(2026, 2, 28, 5, 30, 0, 0);
    expect(getNextRecurringScheduleAlarmAt("17 */6 * * *", now)).toBe(
      Date.UTC(2026, 2, 28, 6, 17, 0, 0),
    );

    expect(getNextRecurringScheduleAlarmAt("17 20 * * *", now)).toBe(
      Date.UTC(2026, 2, 28, 20, 17, 0, 0),
    );
  });

  test("authorizes bridge requests with bearer token", () => {
    const request = new Request("https://example.com/internal/enqueue", {
      method: "POST",
      headers: {
        authorization: "Bearer secret-token",
      },
    });

    expect(
      isBridgeAuthorized(request, {
        CLOUDFLARE_ASYNC_BRIDGE_TOKEN: "secret-token",
      }),
    ).toBe(true);

    expect(
      isBridgeAuthorized(request, {
        CLOUDFLARE_ASYNC_BRIDGE_TOKEN: "other-token",
      }),
    ).toBe(false);
  });

  test("validates supported workflow start payloads", () => {
    expect(
      isCloudflareWorkflowStartRequest({
        workflow: "team-cancellation-email",
        instanceId: "cancellation-email-team_123",
        runId: "run_123",
        payload: {
          teamId: "team_123",
          email: "owner@example.com",
          fullName: "Owner Example",
        },
      }),
    ).toBe(true);

    expect(
      isCloudflareWorkflowStartRequest({
        workflow: "bank-initial-setup",
        instanceId: "bank-initial-setup-connection_123",
        runId: "run_456",
        payload: {
          teamId: "team_123",
          connectionId: "connection_123",
        },
      }),
    ).toBe(true);

    expect(
      isCloudflareWorkflowStartRequest({
        workflow: "onboard-team",
        instanceId: "onboard-team-abc123",
        runId: "run_789",
        payload: {
          email: "owner@example.com",
        },
      }),
    ).toBe(true);

    expect(
      isCloudflareWorkflowStartRequest({
        workflow: "other-workflow",
        instanceId: "wf_123",
        payload: {},
      }),
    ).toBe(false);
  });

  test("validates recurring schedule payloads", () => {
    expect(
      isCloudflareRecurringScheduleRequest({
        scheduleId: "cloudflare-schedule:inbox-sync-scheduler:inbox_account_123",
        taskId: "inbox-sync-scheduler",
        cron: "17 */6 * * *",
        timezone: "UTC",
        externalId: "inbox_account_123",
        deduplicationKey: "inbox_account_123-inbox-sync-scheduler",
        message: {
          queue: "capture",
          queueName: "inbox-provider",
          jobName: "sync-scheduler",
          payload: {
            id: "inbox_account_123",
            manualSync: false,
          },
          maxAttempts: 4,
        },
      }),
    ).toBe(true);

    expect(
      isCloudflareRecurringScheduleRequest({
        scheduleId: "cloudflare-schedule:bank-sync-scheduler:team_123",
        taskId: "bank-sync-scheduler",
        cron: "17 5 * * *",
        timezone: "UTC",
        externalId: "team_123",
        deduplicationKey: "team_123-bank-sync-scheduler",
        message: {
          queue: "ledger",
          queueName: "transactions",
          jobName: "bank-sync-scheduler",
          payload: {
            teamId: "team_123",
          },
          maxAttempts: 3,
        },
      }),
    ).toBe(true);
  });

  test("validates workflow instance control payloads", () => {
    expect(
      isCloudflareWorkflowInstanceRequest({
        instanceId: "cancellation-email-team_123",
      }),
    ).toBe(true);

    expect(
      isCloudflareWorkflowInstanceRequest({
        workflow: "team-cancellation-email",
      }),
    ).toBe(false);
  });
});
