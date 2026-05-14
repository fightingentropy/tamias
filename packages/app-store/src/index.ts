import chatgptMcpApp from "./chatgpt-mcp/config";
import companiesHouseApp from "./companies-house/config-client";
import copilotMcpApp from "./copilot-mcp/config";
import cursorMcpApp from "./cursor-mcp/config";
import fortnoxApp from "./fortnox/config-client";
import gmailApp from "./gmail/config-client";
import hmrcVatApp from "./hmrc-vat/config-client";
import makeMcpApp from "./make-mcp/config";
import n8nMcpApp from "./n8n-mcp/config";
import opencodeMcpApp from "./opencode-mcp/config";
import outlookApp from "./outlook/config-client";
import perplexityMcpApp from "./perplexity-mcp/config";
import quickBooksApp from "./quick-books/config-client";
import raycastMcpApp from "./raycast-mcp/config";
// Import client config for dashboard (includes images)
import slackApp from "./slack/config-client";
import stripePaymentsApp from "./stripe-payments/config-client";
import whatsappApp from "./whatsapp/config-client";
import zapierMcpApp from "./zapier-mcp/config";

export const apps = [
  gmailApp,
  outlookApp,
  slackApp,
  quickBooksApp,
  fortnoxApp,
  hmrcVatApp,
  companiesHouseApp,
  whatsappApp,
  stripePaymentsApp,
  cursorMcpApp,
  perplexityMcpApp,
  raycastMcpApp,
  chatgptMcpApp,
  opencodeMcpApp,
  zapierMcpApp,
  copilotMcpApp,
  n8nMcpApp,
  makeMcpApp,
];
