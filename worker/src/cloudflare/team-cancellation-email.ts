import { hasTeamData, isTeamStillCanceled } from "@tamias/app-data/queries";
import {
  getSupportFromDisplay,
  getSupportReplyToEmail,
} from "@tamias/utils/envs";
import { Resend } from "resend";
import { getDb } from "../utils/db";

type TeamCancellationEmailEnv = {
  RESEND_API_KEY?: string;
};

type TeamCancellationEmailPayload = {
  teamId: string;
  email: string;
  fullName: string;
};

function getResendApiKey(env?: TeamCancellationEmailEnv) {
  return env?.RESEND_API_KEY || process.env.RESEND_API_KEY;
}

function getResendClient(env?: TeamCancellationEmailEnv) {
  const apiKey = getResendApiKey(env);

  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY");
  }

  return new Resend(apiKey);
}

function getFirstName(fullName: string) {
  return fullName.split(" ").at(0) || "there";
}

export async function sendCancellationImmediateEmail(
  payload: TeamCancellationEmailPayload,
  env?: TeamCancellationEmailEnv,
) {
  const resend = getResendClient(env);
  const firstName = getFirstName(payload.fullName);

  await resend.emails.send({
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

export async function sendCancellationFollowupEmail(
  payload: TeamCancellationEmailPayload,
  env?: TeamCancellationEmailEnv,
) {
  const resend = getResendClient(env);
  const firstName = getFirstName(payload.fullName);

  await resend.emails.send({
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
