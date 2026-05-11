import { InviteEmail } from "@tamias/email/emails/invite";
import { getI18n } from "@tamias/email/locales";
import { render } from "@tamias/email/render";
import { sendEmail } from "@tamias/email/send";
import { getSupportFromDisplay } from "@tamias/utils/envs";
import type { WorkerJob as Job } from "../../types/job";
import { nanoid } from "nanoid";
import { inviteTeamMembersSchema, type InviteTeamMembersPayload } from "../../schemas/teams";
import { BaseProcessor } from "../base";

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

    for (const email of emails) {
      await sendEmail(email);
    }

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
