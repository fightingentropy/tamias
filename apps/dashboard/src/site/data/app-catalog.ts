export interface WebsiteAppSummary {
  id: string;
  name: string;
  slug: string;
  category: string;
  active: boolean;
  beta?: boolean;
  short_description: string;
}

export const categories = [
  { id: "all", name: "All" },
  { id: "capture", name: "Capture" },
  { id: "accounting", name: "Accounting" },
  { id: "payments", name: "Payments" },
  { id: "storage", name: "Storage" },
  { id: "apps", name: "Apps" },
  { id: "ai-automation", name: "AI & Automation" },
] as const;

export const appCatalog: WebsiteAppSummary[] = [
  {
    id: "gmail",
    name: "Gmail",
    slug: "gmail",
    category: "capture",
    active: true,
    short_description:
      "Automatically capture receipts and invoices from your Gmail inbox. Documents are extracted and matched to transactions in real-time.",
  },
  {
    id: "outlook",
    name: "Outlook",
    slug: "outlook",
    category: "capture",
    active: true,
    short_description:
      "Automatically capture receipts and invoices from your Outlook inbox. Documents are extracted and matched to transactions in real-time.",
  },
  {
    id: "slack",
    name: "Slack",
    slug: "slack",
    category: "capture",
    active: true,
    short_description:
      "Get transaction notifications and upload receipts directly from Slack. Tamias automatically extracts data and matches them to transactions.",
  },
  {
    id: "quickbooks",
    name: "QuickBooks",
    slug: "quickbooks",
    category: "accounting",
    active: true,
    beta: true,
    short_description:
      "Export transactions and receipts to QuickBooks Online. Keep your books up-to-date without manual data entry.",
  },
  {
    id: "xero",
    name: "Xero",
    slug: "xero",
    category: "accounting",
    active: true,
    beta: true,
    short_description:
      "Export transactions and receipts to Xero. Keep your books up-to-date without manual data entry.",
  },
  {
    id: "fortnox",
    name: "Fortnox",
    slug: "fortnox",
    category: "accounting",
    active: true,
    beta: true,
    short_description:
      "Export transactions and receipts to Fortnox. Keep your Swedish accounting compliant and up-to-date.",
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    slug: "whatsapp",
    category: "capture",
    active: true,
    short_description:
      "Forward receipts and invoices directly from WhatsApp. Tamias automatically extracts data and matches them to transactions.",
  },
  {
    id: "stripe-payments",
    name: "Stripe Payments",
    slug: "stripe-payments",
    category: "payments",
    active: true,
    short_description:
      "Accept credit card and other payments on your invoices.",
  },
  {
    id: "raycast",
    name: "Raycast",
    slug: "raycast",
    category: "apps",
    active: false,
    short_description:
      "Track time directly in Raycast. You can start a timer, add time to an existing project or create a new project directly from Raycast.",
  },
  {
    id: "google-drive",
    name: "Google Drive",
    slug: "google-drive",
    category: "storage",
    active: false,
    short_description:
      "Connect Google Drive to automatically sync and organize your files and documents with Tamias.",
  },
  {
    id: "dropbox",
    name: "Dropbox",
    slug: "dropbox",
    category: "storage",
    active: false,
    short_description:
      "Connect Dropbox to automatically sync and organize your files and documents with Tamias.",
  },
  {
    id: "stripe",
    name: "Stripe",
    slug: "stripe",
    category: "payments",
    active: false,
    short_description:
      "Connect Stripe to automatically sync your payments, invoices, and revenue data with Tamias.",
  },
  {
    id: "polar",
    name: "Polar",
    slug: "polar",
    category: "payments",
    active: false,
    short_description:
      "Connect Polar to automatically sync your payments, subscriptions, and revenue data with Tamias.",
  },
  {
    id: "deel",
    name: "Deel",
    slug: "deel",
    category: "payments",
    active: false,
    short_description:
      "Connect Deel to sync your contractor payments, payroll, and compliance data with Tamias.",
  },
  {
    id: "e-invoice",
    name: "E-Invoice",
    slug: "e-invoice",
    category: "payments",
    active: false,
    short_description:
      "Send and receive e-invoices via the Peppol network for compliant electronic invoicing across Europe.",
  },
  {
    id: "cursor-mcp",
    name: "Cursor",
    slug: "cursor-mcp",
    category: "ai-automation",
    active: true,
    short_description:
      "Connect Cursor to your Tamias data via MCP. Ask questions about finances while you code.",
  },
  {
    id: "claude-mcp",
    name: "Claude",
    slug: "claude-mcp",
    category: "ai-automation",
    active: true,
    short_description:
      "Connect Claude to your Tamias data via MCP. Get financial answers grounded in real numbers.",
  },
  {
    id: "perplexity-mcp",
    name: "Perplexity",
    slug: "perplexity-mcp",
    category: "ai-automation",
    active: true,
    short_description:
      "Connect Perplexity to your Tamias data with AI-powered search.",
  },
  {
    id: "raycast-mcp",
    name: "Raycast",
    slug: "raycast-mcp",
    category: "ai-automation",
    active: true,
    short_description:
      "Access Tamias financial data directly from Raycast via MCP.",
  },
  {
    id: "chatgpt-mcp",
    name: "ChatGPT",
    slug: "chatgpt-mcp",
    category: "ai-automation",
    active: true,
    short_description: "Connect ChatGPT to Tamias through MCP.",
  },
  {
    id: "opencode-mcp",
    name: "OpenCode",
    slug: "opencode-mcp",
    category: "ai-automation",
    active: true,
    short_description:
      "Connect OpenCode to your Tamias data via MCP. Track time for clients from your terminal.",
  },
  {
    id: "zapier-mcp",
    name: "Zapier",
    slug: "zapier-mcp",
    category: "ai-automation",
    active: true,
    short_description:
      "Connect Tamias to 7,000+ apps. Automate reports, alerts, and workflows.",
  },
  {
    id: "copilot-mcp",
    name: "Microsoft Copilot",
    slug: "copilot-mcp",
    category: "ai-automation",
    active: true,
    short_description:
      "Connect Tamias to Microsoft Copilot Studio. Query your business data from Microsoft 365.",
  },
  {
    id: "n8n-mcp",
    name: "n8n",
    slug: "n8n-mcp",
    category: "ai-automation",
    active: true,
    short_description:
      "Connect n8n workflows to your Tamias data via MCP. Automate financial tasks with AI agents.",
  },
  {
    id: "make-mcp",
    name: "Make",
    slug: "make-mcp",
    category: "ai-automation",
    active: true,
    short_description:
      "Connect Make scenarios to your Tamias data via MCP. Build visual automations with financial tools.",
  },
];

export function getAppSummaryBySlug(slug: string) {
  return appCatalog.find((app) => app.slug === slug);
}

export function getAppSummariesByCategory(category: string) {
  if (category === "all") {
    return appCatalog;
  }

  return appCatalog.filter((app) => app.category === category);
}

export function getCategoryName(categoryId: string): string {
  const category = categories.find((item) => item.id === categoryId);
  return category?.name || categoryId;
}

export function getAllAppCatalogSlugs(): string[] {
  return appCatalog.map((app) => app.slug);
}
