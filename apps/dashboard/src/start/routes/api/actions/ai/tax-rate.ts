import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { createFileRoute } from "@tanstack/react-router";
import { getLocationHeaders } from "@tamias/location";
import { z } from "zod";
import { getTaxRateActionSchema } from "@/actions/ai/get-tax-rate";
import { requireAuthenticatedActionUser } from "@/start/server/action-auth";

export const Route = createFileRoute("/api/actions/ai/tax-rate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        await requireAuthenticatedActionUser();

        const { name } = getTaxRateActionSchema.parse(await request.json());
        const location = getLocationHeaders(request.headers);
        const country = location.country || "SE";

        const { object } = await generateObject({
          model: openai("gpt-5-nano"),
          schema: z.object({
            taxRate: z.number().min(5).max(50),
          }),
          prompt: `
        You are an expert tax consultant specializing in VAT/GST rates for businesses across different countries and industries.
        
        Please determine the standard VAT/GST rate that applies to businesses operating in the "${name}" category/industry in ${country}.
        
        Consider the following:
        - Use the current standard VAT/GST rate for businesses in ${country}
        - If the category "${name}" has specific exemptions or reduced rates, apply those instead
        - Focus on B2B transactions where businesses can typically reclaim input VAT
        - If multiple rates could apply, choose the most commonly applicable rate for this business category
        - Return the rate as a percentage (e.g., 20 for 20% VAT)
        
        Country: ${country}
        Business Category: ${name}
      `,
        });

        return Response.json({
          taxRate: object.taxRate,
          country,
        });
      },
    },
  },
});
