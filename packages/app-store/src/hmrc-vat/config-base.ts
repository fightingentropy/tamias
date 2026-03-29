import { Logo } from "./assets/logo";

export const baseConfig = {
  name: "HMRC VAT",
  id: "hmrc-vat",
  category: "compliance",
  active: true,
  beta: true,
  logo: Logo,
  short_description:
    "Connect HMRC VAT to sync obligations and submit UK quarterly VAT returns from Tamias.",
  description:
    "Connect Tamias with HMRC VAT (Making Tax Digital) to manage quarterly VAT obligations and submit returns directly.\n\n**Quarterly VAT Workflow**\nSync open obligations, prepare a draft return from your Tamias ledger, review supporting evidence, and submit to Tamias.\n\n**UK Ltd Focus**\nBuilt for UK VAT-registered limited companies using Tamias as their operating system.\n\n**Evidence Packs**\nEvery submission stores an immutable evidence pack with the numbers, adjustments, and submission response used for that filing.",
  settings: [],
};
