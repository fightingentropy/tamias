import { hasTeamData, isTeamStillCanceled } from "@tamias/app-data/queries";
import { sendEmail } from "@tamias/email/send";
import { getSupportFromDisplay, getSupportReplyToEmail } from "@tamias/utils/envs";
import { getDb } from "../utils/db";

type TeamCancellationEmailPayload = {
  teamId: string;
  email: string;
  fullName: string;
};

function getFirstName(fullName: string) {
  return fullName.split(" ").at(0) || "there";
}

export async function sendCancellationImmediateEmail(payload: TeamCancellationEmailPayload) {
  const firstName = getFirstName(payload.fullName);

  await sendEmail({
    from: getSupportFromDisplay(),
    replyTo: getSupportReplyToEmail(),
    to: payload.email,
    subject: "Thanks for being a customer",
    text: `Hey ${firstName},

I saw you canceled your Tamias subscription — no hard feelings at all.

I genuinely appreciate you giving us a try. Your data is exactly where you left it, and your account stays active until the end of your billing period. If anything changes, you can reactivate in one click from settings.

All the best,

Pontus`,
  });
}

export async function sendCancellationFollowupEmail(payload: TeamCancellationEmailPayload) {
  const firstName = getFirstName(payload.fullName);

  await sendEmail({
    from: getSupportFromDisplay(),
    replyTo: getSupportReplyToEmail(),
    to: payload.email,
    subject: "Quick question",
    text: `Hey ${firstName},

Quick question — was there one thing that would have made you stick around?

Every bit of feedback helps us improve, and I'd genuinely love to hear your thoughts.

Either way, your data is still there if you ever want to come back. This is the last email from us — I won't bother you again.

Pontus`,
  });
}

export async function evaluateCancellationFollowup(teamId: string) {
  const db = getDb();
  const [stillCanceled, teamHasData] = await Promise.all([
    isTeamStillCanceled(db, teamId),
    hasTeamData(db, teamId),
  ]);

  return {
    stillCanceled,
    teamHasData,
  };
}
