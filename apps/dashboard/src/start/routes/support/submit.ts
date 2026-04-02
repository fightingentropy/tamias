import { createFileRoute } from "@tanstack/react-router";
import { PlainClient } from "@team-plain/typescript-sdk";
import { sendSupportSchema } from "@/site/actions/schema";

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

export const Route = createFileRoute("/support/submit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const data = sendSupportSchema.parse(await request.json());

        const customer = await client.upsertCustomer({
          identifier: {
            emailAddress: data.email,
          },
          onCreate: {
            fullName: data.fullName,
            email: {
              email: data.email,
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
        });

        return Response.json(response);
      },
    },
  },
});
