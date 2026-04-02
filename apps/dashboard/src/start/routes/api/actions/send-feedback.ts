import { createFileRoute } from "@tanstack/react-router";
import { PlainClient } from "@team-plain/typescript-sdk";
import { LogEvents } from "@tamias/events/events";
import { sendFeedbackActionSchema } from "@/actions/send-feedback-action";
import {
  requireAuthenticatedActionUser,
  trackAction,
} from "@/start/server/action-auth";

const client = new PlainClient({
  apiKey: process.env.PLAIN_API_KEY!,
});

export const Route = createFileRoute("/api/actions/send-feedback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { feedback } = sendFeedbackActionSchema.parse(
          await request.json(),
        );
        const { user } = await requireAuthenticatedActionUser();

        await trackAction({
          event: LogEvents.SendFeedback.name,
          channel: LogEvents.SendFeedback.channel,
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
          title: "Feedback",
          customerIdentifier: {
            customerId: customer.data?.customer.id,
          },
          labelTypeIds: ["lt_01HV93GFTZAKESXMVY8X371ADG"],
          components: [
            {
              componentText: {
                text: feedback,
              },
            },
          ],
        });

        return Response.json(response);
      },
    },
  },
});
