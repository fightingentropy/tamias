import { InviteEmail } from "@tamias/email/emails/invite";
import { getI18n } from "@tamias/email/locales";
import { render } from "@tamias/email/render";
import { getSupportFromDisplay } from "@tamias/utils/envs";
import type { WorkerJob as Job } from "../../types/job";
import { nanoid } from "nanoid";
import { Resend } from "resend";
import {
  inviteTeamMembersSchema,
  type InviteTeamMembersPayload,
} from "../../schemas/teams";
import { BaseProcessor } from "../base";

const resend = new Resend(process.env.RESEND_API_KEY!);

export class InviteTeamMembersProcessor extends BaseProcessor<InviteTeamMembersPayload> {
  protected override getPayloadSchema() {
    return inviteTeamMembersSchema;
  }

  async process(job: Job<InviteTeamMembersPayload>): Promise<{ sent: number }> {
    const { teamId, ip, invites, locale } = job.data;

    this.logger.info("Sending team invite emails", {
      jobId: job.id,
      teamId,
      invitesCount: invites.length,
      locale,
    });

    const { t } = getI18n({ locale });

    const emails = await Promise.all(
      invites.map(async (invite) => ({
        from: getSupportFromDisplay(),
        to: [invite.email],
        subject: t("invite.subject", {
          invitedByName: invite.invitedByName,
          teamName: invite.teamName,
        }),
        headers: {
          "X-Entity-Ref-ID": nanoid(),
        },
        html: await render(
          InviteEmail({
            invitedByEmail: invite.invitedByEmail,
            invitedByName: invite.invitedByName,
            email: invite.email,
            teamName: invite.teamName,
            ip,
            locale,
          }),
        ),
      })),
    );

    await resend.batch.send(emails);

    this.logger.info("Team invite emails sent", {
      jobId: job.id,
      teamId,
      sent: emails.length,
    });

    return {
      sent: emails.length,
    };
  }
}
