import { ThreadFieldSchemaType } from "@team-plain/typescript-sdk";
import { TRPCError } from "@trpc/server";
import {
  sendFeedbackSchema,
  sendSupportTicketSchema,
} from "../../schemas/support";
import { plain } from "../../services/plain";
import { createTRPCRouter, protectedProcedure } from "../init";

const SUPPORT_LABEL_TYPE_ID = "lt_01HV93FQT6NSC1EN2HHA6BG9WK";
const FEEDBACK_LABEL_TYPE_ID = "lt_01HV93GFTZAKESXMVY8X371ADG";

export const supportRouter = createTRPCRouter({
  sendTicket: protectedProcedure
    .input(sendSupportTicketSchema)
    .mutation(async ({ input, ctx: { session } }) => {
      const customerId = await upsertPlainCustomer(session.user);

      await plain.createThread({
        title: formatSupportTitle(input.type, input.subject),
        description: input.message,
        priority: mapToPriorityNumber(input.priority),
        customerIdentifier: {
          customerId,
        },
        labelTypeIds: [SUPPORT_LABEL_TYPE_ID],
        components: [
          {
            componentText: {
              text: input.message,
            },
          },
        ],
        threadFields: input.url
          ? [
              {
                type: ThreadFieldSchemaType.String,
                key: "url",
                stringValue: input.url,
              },
            ]
          : undefined,
      });

      return { success: true };
    }),

  sendFeedback: protectedProcedure
    .input(sendFeedbackSchema)
    .mutation(async ({ input, ctx: { session } }) => {
      const customerId = await upsertPlainCustomer(session.user);

      await plain.createThread({
        title: "Feedback",
        customerIdentifier: {
          customerId,
        },
        labelTypeIds: [FEEDBACK_LABEL_TYPE_ID],
        components: [
          {
            componentText: {
              text: input.feedback,
            },
          },
        ],
      });

      return { success: true };
    }),
});

async function upsertPlainCustomer(user: {
  id: string;
  email?: string | null;
  fullName?: string | null;
}) {
  if (!user.email) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Current user email missing",
    });
  }

  const customer = await plain.upsertCustomer({
    identifier: {
      emailAddress: user.email,
    },
    onCreate: {
      fullName: user.fullName ?? "",
      externalId: user.id,
      email: {
        email: user.email,
        isVerified: true,
      },
    },
    onUpdate: {},
  });

  const customerId = customer.data?.customer.id;

  if (!customerId) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to create Plain customer",
    });
  }

  return customerId;
}

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

function formatSupportTitle(type: string, subject: string) {
  const normalizedType = type.trim();

  if (!normalizedType || normalizedType.toLowerCase() === "general") {
    return subject;
  }

  return `[${normalizedType}] ${subject}`;
}
