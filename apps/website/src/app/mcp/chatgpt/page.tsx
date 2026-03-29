import type { Metadata } from "next";
import { baseUrl } from "@/app/sitemap";
import { MCPChatGPT } from "@/components/mcp-chatgpt";

const title = "ChatGPT MCP Integration";
const description =
  "Connect ChatGPT to Tamias with MCP and query your business financial data inside ChatGPT.";

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "ChatGPT MCP",
    "ChatGPT integration",
    "Model Context Protocol",
    "OpenAI integration",
    "GPT financial data",
  ],
  openGraph: {
    title,
    description,
    type: "website",
    url: `${baseUrl}/mcp/chatgpt`,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  alternates: {
    canonical: `${baseUrl}/mcp/chatgpt`,
  },
};

export default function Page() {
  return <MCPChatGPT />;
}
