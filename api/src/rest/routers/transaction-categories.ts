import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { getTransactionCategoriesForTeam } from "@tamias/app-services/transactions";
import { withRequiredScope } from "../middleware/scope";
import type { Context } from "../types";

const category = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  parentId: z.string().nullable(),
  taxRate: z.number().nullable(),
  taxType: z.string().nullable(),
});
const app = new OpenAPIHono<Context>();
app.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["Transactions"],
    operationId: "listTransactionCategories",
    summary: "List all team transaction categories",
    responses: {
      200: {
        description: "Flat category catalogue including subcategories",
        content: { "application/json": { schema: z.object({ data: z.array(category) }) } },
      },
    },
    middleware: [withRequiredScope("transactions.read")],
  }),
  async (c) => {
    const parents = await getTransactionCategoriesForTeam({
      db: c.get("db"),
      teamId: c.get("teamId"),
    });
    const categories = parents.flatMap((parent) => [parent, ...parent.children]);
    return c.json({
      data: categories.map((item) => ({
        id: item.id,
        slug: item.slug,
        name: item.name,
        color: item.color,
        parentId: item.parentId,
        taxRate: item.taxRate,
        taxType: item.taxType,
      })),
    });
  },
);
export const transactionCategoriesRouter = app;
