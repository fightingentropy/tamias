import { createFileRoute } from "@tanstack/react-router";
import { PlainClient, ThreadFieldSchemaType } from "@team-plain/typescript-sdk";
import { LogEvents } from "@tamias/events/events";
import { sendSupportActionSchema } from "@/actions/send-support-action";
import {
  requireAuthenticatedActionUser,
  trackAction,
} from "@/start/server/action-auth";

const client = new PlainClient({
  apiKey: process.env.PLAIN_API_KEY!,
});

function mapToPriorityNumber(priority: string) {
  switch (priority) {
    case "low":
      return 0;
    case "normal":
      return 1;
    case "high":
      return 2;
    case "urgent":
      return 3;
    default:
      return 1;
  }
}

export const Route = createFileRoute("/api/actions/send-support")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const data = sendSupportActionSchema.parse(await request.json());
        const { user } = await requireAuthenticatedActionUser();

        await trackAction({
          event: LogEvents.SupportTicket.name,
          channel: LogEvents.SupportTicket.channel,
        });

        const customer = await client.upsertCustomer({
          identifier: {
            emailAddress: user.email,
          },
          onCreate: {
            fullName: user.fullName ?? "",
            externalId: user.id,
            email: {
              email: user.email!,
              isVerified: true,
            },
          },
          onUpdate: {},
        });

        const response = await client.createThread({
          title: data.subject,
          description: data.message,
          priority: mapToPriorityNumber(data.priority),
          customerIdentifier: {
            customerId: customer.data?.customer.id,
          },
          labelTypeIds: ["lt_01HV93FQT6NSC1EN2HHA6BG9WK"],
          components: [
            {
              componentText: {
                text: data.message,
              },
            },
          ],
          threadFields: data.url
            ? [
                {
                  type: ThreadFieldSchemaType.String,
                  key: "url",
                  stringValue: data.url,
                },
              ]
            : undefined,
        });

        return Response.json(response);
      },
    },
  },
});
