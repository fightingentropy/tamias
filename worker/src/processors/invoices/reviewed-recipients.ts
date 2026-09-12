import { NonRetryableError } from "../../utils/error-classification";

export type ReviewedRecipients = {
  expectedCustomerEmail?: string;
  expectedBillingEmails?: string[];
};

const normalizeEmails = (emails: string[]) =>
  [...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))].sort();

/** Guard the actual delivery recipients against the invoice review, including BCC. */
export function assertReviewedRecipients(
  expected: ReviewedRecipients,
  customerEmail: string | null | undefined,
  bcc: string[],
) {
  if (
    expected.expectedCustomerEmail === undefined &&
    expected.expectedBillingEmails === undefined
  ) {
    return;
  }
  if (
    expected.expectedCustomerEmail === undefined ||
    expected.expectedBillingEmails === undefined ||
    expected.expectedCustomerEmail.trim().toLowerCase() !== customerEmail?.trim().toLowerCase() ||
    JSON.stringify(normalizeEmails(expected.expectedBillingEmails)) !==
      JSON.stringify(normalizeEmails(bcc))
  ) {
    throw new NonRetryableError(
      "Invoice recipients changed after review. Review the invoice again before sending.",
      undefined,
      "validation",
    );
  }
}
