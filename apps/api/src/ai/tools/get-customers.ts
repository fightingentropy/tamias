import { db } from "@tamias/app-data/client";
import { getCustomers } from "@tamias/app-data/queries/customers";
import { getAppUrl } from "@tamias/utils/envs";
import { formatDate } from "@tamias/utils/format";
import { tool } from "ai";
import { z } from "zod";
import { getToolAppContext, getToolTeamId } from "../utils/tool-runtime";

const getCustomersSchema = z.object({
  cursor: z.string().nullable().optional().describe("Pagination cursor"),
  sort: z
    .array(z.string())
    .length(2)
    .nullable()
    .optional()
    .describe("Sort order"),
  pageSize: z.number().min(1).max(100).default(10).describe("Page size"),
  q: z.string().nullable().optional().describe("Search query"),
  tags: z.array(z.string()).nullable().optional().describe("Tag IDs"),
});

export const getCustomersTool = tool({
  description:
    "Retrieve and filter customers with pagination, sorting, and search.",
  inputSchema: getCustomersSchema,
  execute: async function* (
    { cursor, sort, pageSize = 10, q, tags },
    executionOptions,
  ) {
    const appContext = getToolAppContext(executionOptions);
    const teamId = getToolTeamId(appContext);

    if (!teamId) {
      yield {
        text: "Unable to retrieve customers: Team ID not found in context.",
      };
      return;
    }

    try {
      const result = await getCustomers(db, {
        teamId,
        cursor: cursor ?? null,
        sort: sort ?? null,
        pageSize,
        q: q ?? null,
      });

      if (result.data.length === 0) {
        yield { text: "No customers found matching your criteria." };
        return;
      }

      // Filter by tags if provided (since getCustomers doesn't support tags in params)
      let filteredData = result.data;
      if (tags && tags.length > 0) {
        filteredData = result.data.filter((customer) => {
          const customerTagIds = customer.tags?.map((tag) => tag.id) || [];
          return tags.some((tagId: string) => customerTagIds.includes(tagId));
        });
      }

      if (filteredData.length === 0) {
        yield { text: "No customers found matching your criteria." };
        return;
      }

      const formattedCustomers = filteredData.map((customer) => {
        const tagNames =
          customer.tags?.map((tag) => tag.name).join(", ") || "None";
        return {
          id: customer.id,
          name: customer.name,
          email: customer.email || "N/A",
          contact: customer.contact || "N/A",
          invoiceCount: customer.invoiceCount ?? 0,
          projectCount: customer.projectCount ?? 0,
          tags: tagNames,
          createdAt: formatDate(customer.createdAt),
        };
      });

      const totalInvoices = filteredData.reduce(
        (sum, cust) => sum + (cust.invoiceCount ?? 0),
        0,
      );
      const totalProjects = filteredData.reduce(
        (sum, cust) => sum + (cust.projectCount ?? 0),
        0,
      );

      const response = `| Name | Email | Contact | Invoices | Projects | Tags | Created |\n|------|-------|---------|----------|----------|------|----------|\n${formattedCustomers.map((cust) => `| ${cust.name} | ${cust.email} | ${cust.contact} | ${cust.invoiceCount} | ${cust.projectCount} | ${cust.tags} | ${cust.createdAt} |`).join("\n")}\n\n**${filteredData.length} customers** | Total Invoices: ${totalInvoices} | Total Projects: ${totalProjects}`;

      yield {
        text: response,
        link: {
          text: "View all customers",
          url: `${getAppUrl()}/customers`,
        },
      };
    } catch (error) {
      yield {
        text: `Failed to retrieve customers: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});
