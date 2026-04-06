import { getTransactionByIdForTeam, getTransactionsPage } from "@tamias/app-services/transactions";
import { getTransactionByIdSchema, getTransactionsSchema } from "../../schemas/transactions";
import { hasScope, READ_ONLY_ANNOTATIONS, type RegisterTools } from "../types";

export const registerTransactionTools: RegisterTools = (server, ctx) => {
  const { db, teamId } = ctx;

  // Require transactions.read scope
  if (!hasScope(ctx, "transactions.read")) {
    return;
  }
  server.registerTool(
    "transactions_list",
    {
      title: "List Transactions",
      description:
        "List financial transactions with filtering, pagination, and sorting. Use this to search for transactions by date, amount, category, status, and more.",
      inputSchema: getTransactionsSchema.shape,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async (params) => {
      const result = await getTransactionsPage({
        db,
        teamId,
        input: {
          cursor: params.cursor ?? null,
          pageSize: params.pageSize ?? 25,
          q: params.q ?? null,
          start: params.start ?? null,
          end: params.end ?? null,
          categories: params.categories ?? null,
          statuses: params.statuses ?? null,
          type: params.type ?? null,
          accounts: params.accounts ?? null,
          sort: params.sort ?? null,
          tags: params.tags ?? null,
          assignees: params.assignees ?? null,
          recurring: params.recurring ?? null,
          attachments: params.attachments ?? null,
          amountRange: params.amountRange ?? null,
          amount: params.amount ?? null,
          manual: params.manual ?? null,
        },
      });

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    "transactions_get",
    {
      title: "Get Transaction",
      description: "Get a specific transaction by its ID",
      inputSchema: {
        id: getTransactionByIdSchema.shape.id,
      },
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ id }) => {
      const result = await getTransactionByIdForTeam({
        db,
        teamId,
        input: { id },
      });

      if (!result) {
        return {
          content: [{ type: "text", text: "Transaction not found" }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );
};
