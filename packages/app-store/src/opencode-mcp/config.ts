import { Logo } from "./assets/logo";

export default {
  name: "OpenCode",
  id: "opencode-mcp",
  category: "ai-automation",
  active: true,
  logo: Logo,
  short_description:
    "Connect OpenCode to your Tamias data via MCP. Track time for clients from your terminal.",
  description: `Connect OpenCode to your Tamias account using the Model Context Protocol (MCP).

**What you can do:**
- Track time for client projects while you code
- Start/stop timers and log hours from your terminal
- Ask about transactions, invoices, and customers
- Query your business data using natural language

**How it works:**
1. Install OpenCode via curl, npm, bun, or brew
2. Add your Tamias API key to OpenCode's MCP configuration
3. Restart OpenCode and ask about your Tamias data`,
  images: [],
  installUrl: "https://tamias.xyz/mcp/opencode",
};
