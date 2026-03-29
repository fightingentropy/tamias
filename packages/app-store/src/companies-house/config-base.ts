import { Logo } from "./assets/logo";

export const baseConfig = {
  name: "Companies House",
  id: "companies-house",
  category: "compliance",
  active: true,
  beta: true,
  logo: Logo,
  short_description:
    "Connect Companies House for registered office, registered email, PSC discrepancy reporting, and public-register checks from Tamias.",
  description:
    "Connect Tamias with Companies House to manage filing transactions using the official OAuth flow, run supported filing operations, and compare your year-end pack with the public register.\n\n**OAuth Connection**\nStore a Companies House user session inside Tamias and inspect the granted filing scopes tied to that connection.\n\n**Supported Filing Flows**\nCreate registered office address drafts, registered email drafts, and PSC discrepancy reports from the Companies House app panel. Tamias requests the exact scope each flow needs before you file.\n\n**Public Register Checks**\nUse the Companies House public data API to read the company profile, current registered office address, next accounts due date, and recent public `accounts` filings inside Tamias.\n\n**Scope-Aware**\nCompanies House filing permissions are company and resource specific. Tamias keeps the granted scopes visible so each filing flow can request the exact authority it needs without over-scoping the connection.",
  settings: [],
};
