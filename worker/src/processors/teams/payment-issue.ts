import { PaymentIssueEmail } from "@tamias/email/emails/payment-issue";
import { render } from "@tamias/email/render";
import { getSupportFromDisplay, getSupportReplyToEmail } from "@tamias/utils/envs";
import type { WorkerJob as Job } from "../../types/job";
import { Resend } from "resend";
import type { PaymentIssuePayload } from "../../schemas/teams";
import { BaseProcessor } from "../base";

const resend = new Resend(process.env.RESEND_API_KEY!);

export class PaymentIssueProcessor extends BaseProcessor<PaymentIssuePayload> {
  async process(job: Job<PaymentIssuePayload>): Promise<void> {
    const { teamId, email, fullName, teamName } = job.data;

    this.logger.info("Sending payment issue email", {
      jobId: job.id,
      teamId,
      email,
    });

    const html = await render(PaymentIssueEmail({ fullName, teamName }));

    await resend.emails.send({
      from: getSupportFromDisplay(),
      replyTo: getSupportReplyToEmail(),
      to: email,
      subject: "Your payment didn't go through",
      html,
    });

    this.logger.info("Payment issue email sent", {
      jobId: job.id,
      teamId,
    });
  }
}
