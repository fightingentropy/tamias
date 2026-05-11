import type { Database } from "@tamias/app-data/client";
import { shouldSendNotification } from "@tamias/app-data/queries";
import InsightsWeeklyEmail from "@tamias/email/emails/insights-weekly";
import InvoiceEmail from "@tamias/email/emails/invoice";
import InvoiceOverdueEmail from "@tamias/email/emails/invoice-overdue";
import InvoicePaidEmail from "@tamias/email/emails/invoice-paid";
import InvoiceReminderEmail from "@tamias/email/emails/invoice-reminder";
import TransactionsEmail from "@tamias/email/emails/transactions";
import TransactionsExportedEmail from "@tamias/email/emails/transactions-exported";
import UpcomingInvoicesEmail from "@tamias/email/emails/upcoming-invoices";
import { render } from "@tamias/email/render";
import { sendEmail, type EmailMessage } from "@tamias/email/send";
import { getSupportFromDisplay } from "@tamias/utils/envs";
import { nanoid } from "nanoid";
import type { EmailInput } from "../base";

export class EmailService {
  constructor(private db: Database) {}

  async sendBulk(emails: EmailInput[], notificationType: string) {
    if (emails.length === 0) {
      return {
        sent: 0,
        skipped: 0,
        failed: 0,
      };
    }

    const eligibleEmails = await this.#filterEligibleEmails(emails, notificationType);

    if (eligibleEmails.length === 0) {
      return {
        sent: 0,
        skipped: emails.length,
        failed: 0,
      };
    }

    try {
      const emailPayloads = await Promise.all(
        eligibleEmails.map((email) => this.#buildEmailPayload(email)),
      );

      let sent = 0;
      let failed = 0;

      for (const payload of emailPayloads) {
        try {
          await sendEmail(payload);
          sent++;
        } catch (error) {
          console.error("Failed to send email:", error);
          failed++;
        }
      }

      return {
        sent,
        skipped: emails.length - eligibleEmails.length,
        failed,
      };
    } catch (error) {
      console.error("Failed to send emails:", error);
      return {
        sent: 0,
        skipped: emails.length - eligibleEmails.length,
        failed: eligibleEmails.length,
      };
    }
  }

  async #filterEligibleEmails(emails: EmailInput[], notificationType: string) {
    const eligibleEmails = await Promise.all(
      emails.map(async (email) => {
        // For customer emails (with explicit 'to' field), always send - decision made at notification level
        if (email.to && email.to.length > 0) {
          return email;
        }

        // For team emails (no 'to' field), check user's notification settings
        const shouldSend = await shouldSendNotification(
          this.db,
          email.user.convex_id,
          email.user.team_id,
          notificationType,
          "email",
        );

        return shouldSend ? email : null;
      }),
    );

    return eligibleEmails.filter(Boolean) as EmailInput[];
  }

  async #buildEmailPayload(email: EmailInput): Promise<EmailMessage> {
    let html: string;
    if (email.template) {
      const template = this.#getTemplate(email.template as string);
      html = await render(template(email.data as any));
    } else {
      throw new Error(`No template found for email: ${email.template}`);
    }

    if (!email.subject) {
      throw new Error(`No subject found for email: ${email.template}`);
    }

    // Use explicit 'to' field if provided, otherwise default to user email
    const recipients = email.to || [email.user.email];

    const payload: EmailMessage = {
      from: email.from ?? getSupportFromDisplay(),
      to: recipients,
      subject: email.subject,
      html,
      headers: {
        "X-Entity-Ref-ID": nanoid(),
        ...email.headers,
      },
    };

    // Add optional fields if present
    if (email.replyTo) payload.replyTo = email.replyTo;
    if (email.cc) payload.cc = email.cc;
    if (email.bcc) payload.bcc = email.bcc;
    if (email.attachments) payload.attachments = email.attachments;
    if (email.text) payload.text = email.text;

    return payload;
  }

  #getTemplate(templateName: string) {
    const templates = {
      "insights-weekly": InsightsWeeklyEmail,
      "invoice-overdue": InvoiceOverdueEmail,
      "invoice-paid": InvoicePaidEmail,
      invoice: InvoiceEmail,
      "invoice-reminder": InvoiceReminderEmail,
      transactions: TransactionsEmail,
      "transactions-exported": TransactionsExportedEmail,
      "upcoming-invoices": UpcomingInvoicesEmail,
    };

    const template = templates[templateName as keyof typeof templates];

    if (!template) {
      throw new Error(`Unknown email template: ${templateName}`);
    }

    return template;
  }
}
