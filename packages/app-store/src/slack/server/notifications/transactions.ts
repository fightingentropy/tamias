import { logger } from "@tamias/logger";
import { getAppUrl } from "@tamias/utils/envs";
import { z } from "zod";
import { createSlackWebClient, ensureBotInChannel } from "../client";

const dashboardUrl = getAppUrl();

const transactionSchema = z.object({
  amount: z.string(),
  name: z.string(),
});

type SlackSetting = {
  id: string;
  value: boolean;
};

type SlackConfig = {
  access_token?: string;
  channel_id?: string;
};

export async function sendSlackTransactionNotifications({
  transactions,
  settings,
  config,
}: {
  transactions: z.infer<typeof transactionSchema>[];
  settings?: SlackSetting[] | null;
  config?: SlackConfig | null;
}) {
  const enabled = settings?.find(
    (setting: { id: string; value: boolean }) => setting.id === "transactions",
  )?.value;

  if (!enabled || !config?.access_token || !config.channel_id) {
    return;
  }

  const client = createSlackWebClient({
    token: config.access_token,
  });

  try {
    // Ensure bot is in channel before sending message (auto-joins public channels)
    await ensureBotInChannel({ client, channelId: config.channel_id });

    await client.chat.postMessage({
      channel: config.channel_id,
      text: `You got ${transactions.length} new transaction${transactions.length === 1 ? "" : "s"}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "You got some new transactions! We'll do our best to match these with receipts in your Inbox or you can simply upload them in your <slack://app?id=A07PN48FW3A|Tamias Assistant>.",
          },
        },
        {
          type: "divider",
        },
        ...transactions.map((transaction) => ({
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: transaction.name,
            },
            {
              type: "mrkdwn",
              text: transaction.amount,
            },
          ],
        })),
        {
          type: "divider",
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "View transactions",
              },
              url: `${dashboardUrl}/transactions`,
              action_id: "button_click",
            },
          ],
        },
      ],
    });
  } catch (error) {
    logger.error("Failed to send Slack transaction notifications", {
      error: error instanceof Error ? error.message : String(error),
      transactionCount: transactions.length,
    });
  }
}
