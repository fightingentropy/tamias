import { createHash } from "node:crypto";
import os from "node:os";
import {
  addDays,
  endOfWeek,
  getISOWeek,
  getISOWeekYear,
  startOfWeek,
  subDays,
} from "date-fns";
import sharp from "sharp";
import {
  bulkUpsertNotificationSettingsInConvex,
  createActivityInConvex,
  createBankAccountInConvex,
  createBankConnectionInConvex,
  createComplianceAdjustmentInConvex,
  createInsightInConvex,
  createTagInConvex,
  createTransactionTagInConvex,
  getActivitiesFromConvex,
  getBankAccountsFromConvex,
  getComplianceAdjustmentsForPeriodFromConvex,
  getCustomersFromConvex,
  getDocumentTagsFromConvex,
  getDocumentsFromConvex,
  getInboxAccountsFromConvex,
  getInboxBlocklistFromConvex,
  getInboxItemsFromConvex,
  getInsightByIdFromConvex,
  getInvoiceProductsFromConvex,
  getInvoiceRecurringSeriesByLegacyIdFromConvex,
  getInvoiceTemplatesFromConvex,
  getTagsFromConvex,
  getTeamMembersFromConvexIdentity,
  getTrackerEntriesByRangeFromConvex,
  getTrackerProjectsFromConvex,
  getTransactionCategoriesFromConvex,
  getTransactionMatchSuggestionsFromConvex,
  getTransactionsFromConvex,
  listAllTeamsFromConvexIdentity,
  listInsightsFromConvex,
  listVatObligationsFromConvex,
  replaceCustomerTagsInConvex,
  replaceTrackerProjectTagsInConvex,
  upsertCustomerInConvex,
  upsertDocumentTagAssignmentsInConvex,
  upsertDocumentTagsInConvex,
  upsertDocumentsInConvex,
  upsertFilingProfileInConvex,
  upsertInboxAccountInConvex,
  upsertInboxItemsInConvex,
  upsertInvoiceProductInConvex,
  upsertInvoiceRecurringSeriesInConvex,
  upsertTransactionCategoriesInConvex,
  upsertTransactionMatchSuggestionsInConvex,
  upsertTransactionsInConvex,
  upsertVatObligationInConvex,
  upsertVatReturnInConvex,
  deleteInvoiceProductInConvex,
  updateBankAccountInConvex,
  updateInboxAccountInConvex,
  updateInsightInConvex,
  updateInvoiceProductInConvex,
  upsertTrackerEntriesInConvex,
  upsertTrackerProjectInConvex,
  createInboxBlocklistInConvex,
  createInvoiceTemplateInConvex,
  upsertInvoiceTemplateInConvex,
  type CurrentUserIdentityRecord,
  type CustomerRecord,
  type DocumentTagRecord,
  type InvoiceTemplateRecord,
  type TagRecord,
  type TeamIdentityRecord,
  type TeamMemberIdentityRecord,
  type TrackerProjectRecord,
  type TransactionRecord,
} from "../packages/app-data-convex/src/index";
import { db } from "../packages/app-data/src/client";
import {
  draftInvoice,
  getInsightByPeriod,
  getInvoiceRecurringById,
  getInvoices,
  updateInvoice,
} from "../packages/app-data/src/queries/index";
import { DEFAULT_TEMPLATE } from "../packages/invoice/src/defaults";
import type { EditorDoc, LineItem } from "../packages/invoice/src/types";
import { uploadVaultFile } from "../packages/storage/src/convex-storage";
import { loadRepoEnv } from "./lib/load-repo-env";

type SeedContext = {
  team: TeamIdentityRecord;
  owner: TeamMemberIdentityRecord;
  teamId: string;
  userId: string;
  teamName: string;
  currency: string;
  timezone: string;
  locale: string;
  today: Date;
  seedPrefix: string;
};

type SeedInvoice = Awaited<ReturnType<typeof upsertInvoiceRecord>>;

loadRepoEnv();

const convexUrl = process.env.CONVEX_URL;

if (!convexUrl) {
  throw new Error("Missing CONVEX_URL");
}

if (
  !convexUrl.includes("127.0.0.1") &&
  !convexUrl.includes("localhost") &&
  !process.argv.includes("--allow-remote")
) {
  throw new Error(
    "Refusing to seed a non-local Convex deployment. Pass --allow-remote to override.",
  );
}

function argValue(flag: string) {
  const direct = process.argv.find((item) => item.startsWith(`${flag}=`));
  if (direct) {
    return direct.slice(flag.length + 1);
  }

  const index = process.argv.indexOf(flag);
  if (index >= 0) {
    return process.argv[index + 1];
  }

  return null;
}

function stableLegacyId(value: string) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz234567";
  const bytes = createHash("sha1").update(value).digest();
  let bits = 0;
  let current = 0;
  let output = "";

  for (const byte of bytes) {
    current = (current << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += alphabet[(current >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += alphabet[(current << (5 - bits)) & 31];
  }

  return output.slice(0, 32);
}

function escapePdfText(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function escapeSvgText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildSeedPdf(lines: string[]) {
  const stream = lines
    .map((line, index) => {
      const fontSize = index === 0 ? 18 : 12;
      const y = 720 - index * 24;
      return `BT /F1 ${fontSize} Tf 48 ${y} Td (${escapePdfText(line)}) Tj ET`;
    })
    .join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;

  for (const offset of offsets.slice(1)) {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new TextEncoder().encode(pdf);
}

function buildSeedEmail(args: {
  subject: string;
  from: string;
  to: string;
  body: string;
}) {
  return new TextEncoder().encode(
    [
      `From: ${args.from}`,
      `To: ${args.to}`,
      `Subject: ${args.subject}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "",
      args.body,
      "",
    ].join("\r\n"),
  );
}

async function buildSeedInboxSampleFile(spec: {
  fileName: string;
  contentType?: string | null;
  displayName?: string | null;
  description?: string | null;
  senderEmail?: string | null;
  pdfLines?: string[];
  emailBody?: string | null;
  textBody?: string | null;
}) {
  switch (spec.contentType) {
    case "application/pdf":
      return buildSeedPdf(
        spec.pdfLines ?? [
          spec.displayName ?? spec.fileName,
          spec.description ?? "Local sample document",
          "Generated by local sample seed data.",
        ],
      );
    case "message/rfc822":
      return buildSeedEmail({
        subject: spec.displayName ?? spec.fileName,
        from: spec.senderEmail ?? "sample@tamias.local",
        to: "team@tamias.local",
        body:
          spec.emailBody ??
          spec.description ??
          "This is a local sample email generated for inbox preview.",
      });
    default:
      if (spec.contentType?.startsWith("image/")) {
        const title = escapeSvgText(spec.displayName ?? spec.fileName);
        const description = escapeSvgText(
          spec.description ?? "Travel receipt generated from seed data.",
        );
        const svg = `
          <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600" viewBox="0 0 1200 1600">
            <rect width="1200" height="1600" fill="#f4f1ea"/>
            <rect x="96" y="96" width="1008" height="1408" rx="32" fill="#fffdf9" stroke="#d7d1c7" stroke-width="8"/>
            <text x="144" y="196" font-size="44" font-family="Helvetica, Arial, sans-serif" fill="#1b1b1b">LNER</text>
            <text x="144" y="252" font-size="30" font-family="Helvetica, Arial, sans-serif" fill="#4b5563">${title}</text>
            <text x="144" y="334" font-size="28" font-family="Helvetica, Arial, sans-serif" fill="#6b7280">${description}</text>
            <line x1="144" y1="392" x2="1056" y2="392" stroke="#d7d1c7" stroke-width="4"/>
            <text x="144" y="482" font-size="28" font-family="Helvetica, Arial, sans-serif" fill="#111827">Route</text>
            <text x="760" y="482" font-size="28" text-anchor="end" font-family="Helvetica, Arial, sans-serif" fill="#111827">London Kings Cross → Edinburgh</text>
            <text x="144" y="548" font-size="28" font-family="Helvetica, Arial, sans-serif" fill="#111827">Journey date</text>
            <text x="1056" y="548" font-size="28" text-anchor="end" font-family="Helvetica, Arial, sans-serif" fill="#111827">5 Mar 2026</text>
            <text x="144" y="614" font-size="28" font-family="Helvetica, Arial, sans-serif" fill="#111827">Seat</text>
            <text x="1056" y="614" font-size="28" text-anchor="end" font-family="Helvetica, Arial, sans-serif" fill="#111827">Coach B • Seat 14A</text>
            <text x="144" y="680" font-size="28" font-family="Helvetica, Arial, sans-serif" fill="#111827">Booking ref</text>
            <text x="1056" y="680" font-size="28" text-anchor="end" font-family="Helvetica, Arial, sans-serif" fill="#111827">LNER-83K2-ACM</text>
            <line x1="144" y1="748" x2="1056" y2="748" stroke="#d7d1c7" stroke-width="4"/>
            <text x="144" y="836" font-size="30" font-family="Helvetica, Arial, sans-serif" fill="#111827">Advance single fare</text>
            <text x="1056" y="836" font-size="30" text-anchor="end" font-family="Helvetica, Arial, sans-serif" fill="#111827">GBP 96.00</text>
            <text x="144" y="902" font-size="30" font-family="Helvetica, Arial, sans-serif" fill="#111827">Flexible change cover</text>
            <text x="1056" y="902" font-size="30" text-anchor="end" font-family="Helvetica, Arial, sans-serif" fill="#111827">GBP 12.00</text>
            <text x="144" y="968" font-size="30" font-family="Helvetica, Arial, sans-serif" fill="#111827">Booking fee</text>
            <text x="1056" y="968" font-size="30" text-anchor="end" font-family="Helvetica, Arial, sans-serif" fill="#111827">GBP 12.00</text>
            <line x1="144" y1="1038" x2="1056" y2="1038" stroke="#1b1b1b" stroke-width="5"/>
            <text x="144" y="1120" font-size="40" font-weight="700" font-family="Helvetica, Arial, sans-serif" fill="#111827">Total paid</text>
            <text x="1056" y="1120" font-size="40" font-weight="700" text-anchor="end" font-family="Helvetica, Arial, sans-serif" fill="#111827">GBP 120.00</text>
            <text x="144" y="1240" font-size="26" font-family="Helvetica, Arial, sans-serif" fill="#6b7280">Payment card ending 1872 • Issued to Acme Inc</text>
            <text x="144" y="1300" font-size="26" font-family="Helvetica, Arial, sans-serif" fill="#6b7280">Generated sample for seeded inbox previews</text>
          </svg>
        `;

        return sharp(Buffer.from(svg))
          .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
          .toBuffer();
      }

      return new TextEncoder().encode(spec.textBody ?? spec.description ?? spec.fileName);
  }
}

async function ensureSeedInboxSampleFiles(
  context: SeedContext,
  specs: Array<{
    filePath: string[];
    fileName: string;
    contentType?: string | null;
    displayName?: string | null;
    description?: string | null;
    senderEmail?: string | null;
    pdfLines?: string[];
    emailBody?: string | null;
    textBody?: string | null;
  }>,
) {
  for (const spec of specs) {
    const blob = await buildSeedInboxSampleFile(spec);
    const { error } = await uploadVaultFile({
      path: [context.teamId, ...spec.filePath],
      blob,
      contentType: spec.contentType,
      size: blob.byteLength,
    });

    if (error) {
      throw error;
    }
  }
}

function stableConvexId(value: string) {
  const alphabet = "0123456789abcdefghjkmnpqrstvwxyz";
  const bytes = createHash("sha1").update(value).digest();
  let bits = 0;
  let current = 0;
  let output = "";

  for (const byte of bytes) {
    current = (current << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += alphabet[(current >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += alphabet[(current << (5 - bits)) & 31];
  }

  return output.slice(0, 32);
}

function seedId(context: SeedContext, scope: string) {
  return stableLegacyId(`${context.seedPrefix}:${scope}`);
}

function convexSeedId(context: SeedContext, scope: string) {
  return stableConvexId(`${context.seedPrefix}:${scope}`);
}

function asIso(value: Date) {
  return value.toISOString();
}

function dateOnly(value: Date) {
  return asIso(value).slice(0, 10);
}

function editorDoc(text: string): EditorDoc {
  return {
    type: "doc",
    content: text
      .split("\n")
      .filter(Boolean)
      .map((line) => ({
        type: "paragraph",
        content: [{ type: "text", text: line }],
      })),
  };
}

function amountForLineItems(items: LineItem[]) {
  return items.reduce(
    (sum, item) => sum + (item.price ?? 0) * (item.quantity ?? 1),
    0,
  );
}

function metadataSeedKey(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const metadata = value as Record<string, unknown>;
  return typeof metadata.seedKey === "string" ? metadata.seedKey : null;
}

async function resolveTargetContext(): Promise<SeedContext> {
  const explicitTeamId = argValue("--team-id");
  const explicitUserEmail = argValue("--user-email");
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const teams = await listAllTeamsFromConvexIdentity();
  const candidates = (
    await Promise.all(
      teams.map(async (team) => ({
        team,
        members: await getTeamMembersFromConvexIdentity({ teamId: team.id }),
      })),
    )
  )
    .map((entry) => ({
      ...entry,
      owner: entry.members[0] ?? null,
    }))
    .filter(
      (
        entry,
      ): entry is {
        team: TeamIdentityRecord;
        members: TeamMemberIdentityRecord[];
        owner: TeamMemberIdentityRecord;
      } => entry.owner !== null,
    );

  if (explicitTeamId) {
    const match = candidates.find(({ team }) => team.id === explicitTeamId);
    if (!match) {
      throw new Error(`No team found for --team-id ${explicitTeamId}`);
    }

    return buildContext(match.team, match.owner, today);
  }

  if (explicitUserEmail) {
    const match = candidates.find(
      ({ owner, team }) =>
        owner.user.email?.toLowerCase() === explicitUserEmail.toLowerCase() ||
        team.email?.toLowerCase() === explicitUserEmail.toLowerCase(),
    );
    if (!match) {
      throw new Error(`No owner found for --user-email ${explicitUserEmail}`);
    }

    return buildContext(match.team, match.owner, today);
  }

  const ranked = [...candidates].sort((left, right) => {
    const rightScore = scoreCandidate(right.team, right.members, right.owner);
    const leftScore = scoreCandidate(left.team, left.members, left.owner);

    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }

    return left.team.createdAt.localeCompare(right.team.createdAt);
  });

  const selected = ranked[0];
  if (!selected) {
    throw new Error("No Convex team with an owner membership was found.");
  }

  return buildContext(selected.team, selected.owner, today);
}

function scoreCandidate(
  team: TeamIdentityRecord,
  members: TeamMemberIdentityRecord[],
  owner: TeamMemberIdentityRecord,
) {
  const searchText = [
    team.name,
    team.email,
    owner.user.fullName,
    owner.user.email,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  let score = 0;

  if (members.length === 1) score += 5;
  if (!searchText.includes("example.com")) score += 25;
  if (!searchText.includes("playwright")) score += 25;
  if (!searchText.includes("codex")) score += 15;
  if (!searchText.includes("localtest")) score += 10;
  if (owner.user.fullName) score += 5;
  if (team.name?.toLowerCase().includes("acme")) score += 5;

  const currentUser = os.userInfo().username.toLowerCase();
  if (searchText.includes(currentUser)) score += 20;

  return score;
}

function buildContext(
  team: TeamIdentityRecord,
  owner: TeamMemberIdentityRecord,
  today: Date,
): SeedContext {
  return {
    team,
    owner,
    teamId: team.id,
    userId: owner.user.id,
    teamName: team.name ?? "Acme Inc",
    currency: team.baseCurrency ?? "GBP",
    timezone: owner.user.timezone ?? "Europe/London",
    locale:
      owner.user.locale === "en"
        ? team.countryCode === "GB"
          ? "en-GB"
          : "en-US"
        : (owner.user.locale ?? "en-GB"),
    today,
    seedPrefix: `local-sample:${team.id}`,
  };
}

async function seedTransactionCategories(context: SeedContext) {
  await upsertTransactionCategoriesInConvex({
    teamId: context.teamId,
    categories: [
      {
        id: seedId(context, "category:revenue"),
        teamId: context.teamId,
        name: "Revenue",
        slug: "revenue",
        color: "#0f766e",
        description: "Client income and retained revenue.",
        system: false,
        excluded: false,
      },
      {
        id: seedId(context, "category:contractors"),
        teamId: context.teamId,
        name: "Contractors",
        slug: "contractors",
        color: "#b45309",
        description: "Freelance and contractor spend.",
        system: false,
        excluded: false,
      },
      {
        id: seedId(context, "category:software"),
        teamId: context.teamId,
        name: "Software",
        slug: "software",
        color: "#2563eb",
        description: "SaaS subscriptions and tooling.",
        system: false,
        excluded: false,
      },
      {
        id: seedId(context, "category:marketing"),
        teamId: context.teamId,
        name: "Marketing",
        slug: "marketing",
        color: "#be185d",
        description: "Paid campaigns and demand generation.",
        system: false,
        excluded: false,
      },
      {
        id: seedId(context, "category:travel"),
        teamId: context.teamId,
        name: "Travel",
        slug: "travel",
        color: "#7c3aed",
        description: "Travel, lodging, and client visits.",
        system: false,
        excluded: false,
      },
      {
        id: seedId(context, "category:office"),
        teamId: context.teamId,
        name: "Office",
        slug: "office",
        color: "#4b5563",
        description: "Office overhead and workspace costs.",
        system: false,
        excluded: false,
      },
      {
        id: seedId(context, "category:salary"),
        teamId: context.teamId,
        name: "Salary",
        slug: "salary",
        color: "#eb144c",
        description: "Core payroll and salary spend.",
        system: false,
        excluded: false,
      },
      {
        id: seedId(context, "category:employer-taxes"),
        teamId: context.teamId,
        name: "Employer Taxes",
        slug: "employer-taxes",
        color: "#dc2626",
        description: "Employer NI and payroll tax costs.",
        system: false,
        excluded: false,
      },
      {
        id: seedId(context, "category:payroll-tax-remittances"),
        teamId: context.teamId,
        name: "Payroll Tax Remittances",
        slug: "payroll-tax-remittances",
        color: "#ff5a5f",
        description: "PAYE and payroll tax remittances paid to HMRC.",
        system: false,
        excluded: false,
      },
      {
        id: seedId(context, "category:taxes"),
        teamId: context.teamId,
        name: "Taxes",
        slug: "taxes",
        color: "#dc2626",
        description: "Corporation tax and other tax payments.",
        system: false,
        excluded: false,
      },
      {
        id: seedId(context, "category:equipment"),
        teamId: context.teamId,
        name: "Equipment",
        slug: "equipment",
        color: "#00a9fe",
        description: "Computers, monitors, and office equipment.",
        system: false,
        excluded: false,
      },
      {
        id: seedId(context, "category:prepaid-expenses"),
        teamId: context.teamId,
        name: "Prepaid Expenses",
        slug: "prepaid-expenses",
        color: "#4b5563",
        description: "Annual plans and prepaid overhead.",
        system: false,
        excluded: false,
      },
      {
        id: seedId(context, "category:deferred-revenue"),
        teamId: context.teamId,
        name: "Deferred Revenue",
        slug: "deferred-revenue",
        color: "#2563eb",
        description: "Cash received before revenue is recognised.",
        system: false,
        excluded: false,
      },
      {
        id: seedId(context, "category:capital-investment"),
        teamId: context.teamId,
        name: "Capital Investment",
        slug: "capital-investment",
        color: "#0f766e",
        description: "Founder or shareholder capital introduced.",
        system: false,
        excluded: false,
      },
      {
        id: seedId(context, "category:loan-proceeds"),
        teamId: context.teamId,
        name: "Loan Proceeds",
        slug: "loan-proceeds",
        color: "#2563eb",
        description: "Borrowed funds received into the business.",
        system: false,
        excluded: false,
      },
      {
        id: seedId(context, "category:loan-principal-repayment"),
        teamId: context.teamId,
        name: "Loan Principal Repayment",
        slug: "loan-principal-repayment",
        color: "#4b5563",
        description: "Principal repayments against borrowings.",
        system: false,
        excluded: false,
      },
      {
        id: seedId(context, "category:bank-fees"),
        teamId: context.teamId,
        name: "Bank Fees",
        slug: "bank-fees",
        color: "#991b1b",
        description: "Processing, FX, and banking charges.",
        system: false,
        excluded: false,
      },
    ],
  });

  return await getTransactionCategoriesFromConvex({ teamId: context.teamId });
}

async function seedTags(context: SeedContext) {
  const existing = await getTagsFromConvex({ teamId: context.teamId });
  const desired = ["VIP", "Retainer", "Subscription", "Q2 Focus"];
  const recordsByName = new Map(existing.map((tag) => [tag.name, tag]));

  for (const name of desired) {
    if (!recordsByName.has(name)) {
      const created = await createTagInConvex({ teamId: context.teamId, name });
      recordsByName.set(name, created);
    }
  }

  return recordsByName;
}

async function seedCustomers(context: SeedContext) {
  const customerSpecs = [
    {
      seedScope: "customer:orbit-labs",
      name: "Orbit Labs",
      email: "finance@orbitlabs.co",
      billingEmail: "ap@orbitlabs.co",
      website: "https://orbitlabs.co",
      phone: "+44 20 3900 1200",
      contact: "Nadia Brooks",
      country: "United Kingdom",
      countryCode: "GB",
      addressLine1: "91 Great Suffolk Street",
      city: "London",
      zip: "SE1 0BX",
      preferredCurrency: context.currency,
      defaultPaymentTerms: 14,
      source: "seed",
      status: "active",
      description: "B2B SaaS client on a monthly retained growth programme.",
      industry: "SaaS",
      companyType: "startup",
      employeeCount: "25-50",
      foundedYear: 2021,
      estimatedRevenue: "2m-5m",
      fundingStage: "Series A",
      totalFunding: "8m",
      headquartersLocation: "London, UK",
      timezone: "Europe/London",
      linkedinUrl: "https://linkedin.com/company/orbitlabs",
      ceoName: "Nadia Brooks",
      financeContact: "Daniel Price",
      financeContactEmail: "daniel@orbitlabs.co",
      primaryLanguage: "en",
      fiscalYearEnd: "03-31",
      enrichmentStatus: "completed",
      enrichedAt: asIso(subDays(context.today, 9)),
      portalEnabled: true,
      portalId: `orbit-${seedId(context, "portal:orbit").slice(0, 8)}`,
    },
    {
      seedScope: "customer:alder-analytics",
      name: "Alder Analytics",
      email: "hello@alderanalytics.com",
      billingEmail: "billing@alderanalytics.com",
      website: "https://alderanalytics.com",
      phone: "+44 20 3900 2200",
      contact: "Hannah Reed",
      country: "United Kingdom",
      countryCode: "GB",
      addressLine1: "18 Curtain Road",
      city: "London",
      zip: "EC2A 3NN",
      preferredCurrency: context.currency,
      defaultPaymentTerms: 30,
      source: "seed",
      status: "active",
      description: "Data consultancy buying reporting and forecasting support.",
      industry: "Analytics",
      companyType: "small_business",
      employeeCount: "10-25",
      foundedYear: 2019,
      estimatedRevenue: "500k-1m",
      fundingStage: "Bootstrapped",
      headquartersLocation: "London, UK",
      timezone: "Europe/London",
      linkedinUrl: "https://linkedin.com/company/alder-analytics",
      ceoName: "Hannah Reed",
      financeContact: "Tom Walker",
      financeContactEmail: "tom@alderanalytics.com",
      primaryLanguage: "en",
      fiscalYearEnd: "12-31",
      enrichmentStatus: "completed",
      enrichedAt: asIso(subDays(context.today, 6)),
      portalEnabled: false,
      portalId: null,
    },
    {
      seedScope: "customer:northwind-studio",
      name: "Northwind Studio",
      email: "finance@northwind.studio",
      billingEmail: "ap@northwind.studio",
      website: "https://northwind.studio",
      phone: "+44 20 3900 3300",
      contact: "Sophie Lane",
      country: "United Kingdom",
      countryCode: "GB",
      addressLine1: "4 Baltic Street West",
      city: "London",
      zip: "EC1Y 0UJ",
      preferredCurrency: context.currency,
      defaultPaymentTerms: 14,
      source: "seed",
      status: "active",
      description: "Design studio with ad hoc sprint-based work and invoice follow-up.",
      industry: "Design",
      companyType: "agency",
      employeeCount: "10-25",
      foundedYear: 2018,
      estimatedRevenue: "1m-2m",
      fundingStage: "Bootstrapped",
      headquartersLocation: "London, UK",
      timezone: "Europe/London",
      financeContact: "Sophie Lane",
      financeContactEmail: "sophie@northwind.studio",
      primaryLanguage: "en",
      fiscalYearEnd: "12-31",
      enrichmentStatus: "completed",
      enrichedAt: asIso(subDays(context.today, 4)),
      portalEnabled: false,
      portalId: null,
    },
    {
      seedScope: "customer:seabright-coffee",
      name: "Seabright Coffee",
      email: "ops@seabrightcoffee.com",
      billingEmail: "finance@seabrightcoffee.com",
      website: "https://seabrightcoffee.com",
      phone: "+44 20 3900 4400",
      contact: "Mira Patel",
      country: "United Kingdom",
      countryCode: "GB",
      addressLine1: "72 Bermondsey Street",
      city: "London",
      zip: "SE1 3UD",
      preferredCurrency: context.currency,
      defaultPaymentTerms: 21,
      source: "seed",
      status: "lead",
      description: "Prospect evaluating a reporting package and KPI setup.",
      industry: "Hospitality",
      companyType: "small_business",
      employeeCount: "5-10",
      foundedYear: 2023,
      estimatedRevenue: "250k-500k",
      fundingStage: "Bootstrapped",
      headquartersLocation: "London, UK",
      timezone: "Europe/London",
      financeContact: "Mira Patel",
      financeContactEmail: "mira@seabrightcoffee.com",
      primaryLanguage: "en",
      fiscalYearEnd: "03-31",
      enrichmentStatus: "completed",
      enrichedAt: asIso(subDays(context.today, 2)),
      portalEnabled: false,
      portalId: null,
    },
  ] satisfies Array<
    Omit<Parameters<typeof upsertCustomerInConvex>[0], "teamId" | "id"> & {
      seedScope: string;
    }
  >;

  const existing = await getCustomersFromConvex({ teamId: context.teamId });
  const existingByEmail = new Map(
    existing.map((customer) => [customer.email.toLowerCase(), customer]),
  );

  const results: CustomerRecord[] = [];
  for (const customer of customerSpecs) {
    const matched = existingByEmail.get(customer.email.toLowerCase()) ?? null;
    const { seedScope, ...payload } = customer;
    results.push(
      await upsertCustomerInConvex({
        teamId: context.teamId,
        id: matched?.id ?? convexSeedId(context, seedScope),
        ...payload,
      }),
    );
  }

  return results;
}

async function seedCustomerTags(
  context: SeedContext,
  customers: CustomerRecord[],
  tagsByName: Map<string, TagRecord>,
) {
  const customerByName = new Map(customers.map((customer) => [customer.name, customer]));
  const vipId = tagsByName.get("VIP")?.id;
  const retainerId = tagsByName.get("Retainer")?.id;

  if (vipId && retainerId && customerByName.get("Orbit Labs")) {
    await replaceCustomerTagsInConvex({
      teamId: context.teamId,
      customerId: customerByName.get("Orbit Labs")!.id,
      tagIds: [vipId, retainerId],
    });
  }

  if (retainerId && customerByName.get("Alder Analytics")) {
    await replaceCustomerTagsInConvex({
      teamId: context.teamId,
      customerId: customerByName.get("Alder Analytics")!.id,
      tagIds: [retainerId],
    });
  }
}

async function seedBanking(context: SeedContext) {
  await createBankConnectionInConvex({
    id: seedId(context, "bank-connection:main"),
    teamId: context.teamId,
    userId: context.userId,
    provider: "gocardless",
    accessToken: "seed-token-main",
    enrollmentId: "seed-enrollment-main",
    referenceId: "seed-reference-main",
    accounts: [
      {
        id: seedId(context, "bank-account:operating"),
        accountId: "seed-operating-account",
        institutionId: "seed-business-bank-uk",
        bankName: "Seed Business Bank",
        name: "Operating Account",
        currency: context.currency,
        enabled: true,
        balance: 122420,
        type: "depository",
        accountReference: "OPERATING",
        accountNumber: "88997766",
        sortCode: "20-45-67",
        availableBalance: 122420,
      },
      {
        id: seedId(context, "bank-account:corporate-card"),
        accountId: "seed-corporate-card",
        institutionId: "seed-business-bank-uk",
        bankName: "Seed Business Bank",
        name: "Corporate Card",
        currency: context.currency,
        enabled: true,
        balance: -7840,
        type: "credit",
        accountReference: "CARD",
        accountNumber: "55334422",
        sortCode: "20-45-67",
        availableBalance: 17160,
        creditLimit: 25000,
      },
    ],
  });

  const existingAccounts = await getBankAccountsFromConvex({
    teamId: context.teamId,
  });
  const accountById = new Map(existingAccounts.map((account) => [account.id, account]));

  const cashReserveId = seedId(context, "bank-account:cash-reserve");
  if (!accountById.has(cashReserveId)) {
    await createBankAccountInConvex({
      id: cashReserveId,
      teamId: context.teamId,
      userId: context.userId,
      name: "Cash Reserve",
      currency: context.currency,
      manual: true,
      accountId: "seed-cash-reserve",
      type: "depository",
    });
  }

  const taxReserveId = seedId(context, "bank-account:tax-reserve");
  if (!accountById.has(taxReserveId)) {
    await createBankAccountInConvex({
      id: taxReserveId,
      teamId: context.teamId,
      userId: context.userId,
      name: "Tax Reserve",
      currency: context.currency,
      manual: true,
      accountId: "seed-tax-reserve",
      type: "depository",
    });
  }

  const growthLoanId = seedId(context, "bank-account:growth-loan");
  if (!accountById.has(growthLoanId)) {
    await createBankAccountInConvex({
      id: growthLoanId,
      teamId: context.teamId,
      userId: context.userId,
      name: "Growth Loan",
      currency: context.currency,
      manual: true,
      accountId: "seed-growth-loan",
      type: "loan",
    });
  }

  const hmrcLiabilitiesId = seedId(context, "bank-account:hmrc-liabilities");
  if (!accountById.has(hmrcLiabilitiesId)) {
    await createBankAccountInConvex({
      id: hmrcLiabilitiesId,
      teamId: context.teamId,
      userId: context.userId,
      name: "HMRC Liabilities",
      currency: context.currency,
      manual: true,
      accountId: "seed-hmrc-liabilities",
      type: "other_liability",
    });
  }

  await updateBankAccountInConvex({
    id: seedId(context, "bank-account:operating"),
    teamId: context.teamId,
    balance: 122420,
    baseBalance: 122420,
    baseCurrency: context.currency,
    accountNumber: "88997766",
    sortCode: "20-45-67",
    availableBalance: 122420,
  });
  await updateBankAccountInConvex({
    id: seedId(context, "bank-account:corporate-card"),
    teamId: context.teamId,
    balance: -7840,
    baseBalance: -7840,
    baseCurrency: context.currency,
    accountNumber: "55334422",
    sortCode: "20-45-67",
    availableBalance: 17160,
    creditLimit: 25000,
  });
  await updateBankAccountInConvex({
    id: cashReserveId,
    teamId: context.teamId,
    balance: 30000,
    baseBalance: 30000,
    baseCurrency: context.currency,
    accountNumber: "11009988",
    sortCode: "20-45-67",
    availableBalance: 30000,
  });
  await updateBankAccountInConvex({
    id: taxReserveId,
    teamId: context.teamId,
    balance: 24000,
    baseBalance: 24000,
    baseCurrency: context.currency,
    accountNumber: "55443322",
    sortCode: "20-45-67",
    availableBalance: 24000,
  });
  await updateBankAccountInConvex({
    id: growthLoanId,
    teamId: context.teamId,
    balance: -18500,
    baseBalance: -18500,
    baseCurrency: context.currency,
    accountNumber: "LOAN-2025-01",
    availableBalance: -18500,
  });
  await updateBankAccountInConvex({
    id: hmrcLiabilitiesId,
    teamId: context.teamId,
    balance: -6420,
    baseBalance: -6420,
    baseCurrency: context.currency,
    accountNumber: "HMRC-2026",
    availableBalance: -6420,
  });

  return await getBankAccountsFromConvex({ teamId: context.teamId });
}

async function seedTransactions(
  context: SeedContext,
  bankAccounts: Awaited<ReturnType<typeof getBankAccountsFromConvex>>,
  customers: CustomerRecord[],
) {
  const accountId = (scope: string) => seedId(context, `bank-account:${scope}`);
  const customerByName = new Map(customers.map((customer) => [customer.name, customer]));
  const items = [
    {
      id: seedId(context, "transaction:orbit-payment"),
      createdAt: asIso(subDays(context.today, 58)),
      date: dateOnly(subDays(context.today, 58)),
      name: "Orbit Labs invoice payment",
      method: "payment" as const,
      amount: 6250,
      currency: context.currency,
      assignedId: customerByName.get("Orbit Labs")?.id ?? null,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-orbit-payment",
      status: "posted" as const,
      balance: 149830,
      manual: false,
      internal: false,
      description: "March retainer and reporting package received from Orbit Labs.",
      categorySlug: "revenue",
      baseAmount: 6250,
      counterpartyName: "Orbit Labs",
      baseCurrency: context.currency,
      recurring: true,
      frequency: "monthly" as const,
      merchantName: "Orbit Labs",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:contractor-payroll"),
      createdAt: asIso(subDays(context.today, 51)),
      date: dateOnly(subDays(context.today, 51)),
      name: "Freelance strategist payout",
      method: "transfer" as const,
      amount: -4200,
      currency: context.currency,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-contractor-payroll",
      status: "posted" as const,
      balance: 145630,
      manual: false,
      internal: false,
      description: "Monthly contractor payout covering strategy, reporting, and delivery support.",
      categorySlug: "contractors",
      baseAmount: -4200,
      baseCurrency: context.currency,
      taxAmount: 0,
      recurring: true,
      frequency: "monthly" as const,
      merchantName: "Freelance Strategist",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:aws"),
      createdAt: asIso(subDays(context.today, 44)),
      date: dateOnly(subDays(context.today, 44)),
      name: "AWS bill",
      method: "card_purchase" as const,
      amount: -684.22,
      currency: context.currency,
      bankAccountId: accountId("corporate-card"),
      internalId: "seed-txn-aws",
      status: "posted" as const,
      balance: -684.22,
      manual: false,
      internal: false,
      description:
        "AWS January infrastructure bill covering EC2, RDS, CloudFront, support, and data transfer.",
      categorySlug: "software",
      baseAmount: -684.22,
      counterpartyName: "Amazon Web Services EMEA SARL",
      baseCurrency: context.currency,
      taxAmount: -114.04,
      taxRate: 20,
      taxType: "vat",
      recurring: true,
      frequency: "monthly" as const,
      merchantName: "AWS EMEA",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:google-workspace"),
      createdAt: asIso(subDays(context.today, 35)),
      date: dateOnly(subDays(context.today, 35)),
      name: "Google Workspace subscription",
      method: "card_purchase" as const,
      amount: -144,
      currency: context.currency,
      bankAccountId: accountId("corporate-card"),
      internalId: "seed-txn-google-workspace",
      status: "posted" as const,
      balance: -828.22,
      manual: false,
      internal: false,
      description:
        "Google Workspace Business Standard seats and Gemini add-ons for the delivery team.",
      categorySlug: "software",
      baseAmount: -144,
      counterpartyName: "Google Cloud EMEA Limited",
      baseCurrency: context.currency,
      taxAmount: -24,
      taxRate: 20,
      taxType: "vat",
      recurring: true,
      frequency: "monthly" as const,
      merchantName: "Google Workspace",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:google-ads"),
      createdAt: asIso(subDays(context.today, 36)),
      date: dateOnly(subDays(context.today, 36)),
      name: "Google Ads spend",
      method: "card_purchase" as const,
      amount: -1350,
      currency: context.currency,
      bankAccountId: accountId("corporate-card"),
      internalId: "seed-txn-google-ads",
      status: "exported" as const,
      balance: -2178.22,
      manual: false,
      internal: false,
      description: "Brand search, remarketing, and competitor campaign spend.",
      categorySlug: "marketing",
      baseAmount: -1350,
      counterpartyName: "Google Ads",
      baseCurrency: context.currency,
      taxAmount: -225,
      taxRate: 20,
      taxType: "vat",
      recurring: false,
      frequency: "irregular" as const,
      merchantName: "Google Ads",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:northwind-payment"),
      createdAt: asIso(subDays(context.today, 21)),
      date: dateOnly(subDays(context.today, 21)),
      name: "Northwind Studio invoice payment",
      method: "payment" as const,
      amount: 2900,
      currency: context.currency,
      assignedId: customerByName.get("Northwind Studio")?.id ?? null,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-northwind-payment",
      status: "posted" as const,
      balance: 22340,
      manual: false,
      internal: false,
      description: "Partial settlement for sprint work delivered in February.",
      categorySlug: "revenue",
      baseAmount: 2900,
      counterpartyName: "Northwind Studio",
      baseCurrency: context.currency,
      recurring: false,
      frequency: "irregular" as const,
      merchantName: "Northwind Studio",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:train"),
      createdAt: asIso(subDays(context.today, 14)),
      date: dateOnly(subDays(context.today, 14)),
      name: "Client workshop travel",
      method: "card_purchase" as const,
      amount: -120,
      currency: context.currency,
      bankAccountId: accountId("corporate-card"),
      internalId: "seed-txn-train",
      status: "posted" as const,
      balance: -890,
      manual: false,
      internal: false,
      description: "Train tickets and local travel for onsite workshop.",
      categorySlug: "travel",
      baseAmount: -120,
      baseCurrency: context.currency,
      taxAmount: -20,
      taxRate: 20,
      taxType: "vat",
      recurring: false,
      frequency: "irregular" as const,
      merchantName: "LNER",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:rent"),
      createdAt: asIso(subDays(context.today, 10)),
      date: dateOnly(subDays(context.today, 10)),
      name: "Studio rent",
      method: "transfer" as const,
      amount: -2250,
      currency: context.currency,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-rent",
      status: "posted" as const,
      balance: 147580,
      manual: false,
      internal: false,
      description: "Monthly studio membership, meeting rooms, and mail handling.",
      categorySlug: "office",
      baseAmount: -2250,
      baseCurrency: context.currency,
      recurring: true,
      frequency: "monthly" as const,
      merchantName: "Workspace Collective",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:figma"),
      createdAt: asIso(subDays(context.today, 6)),
      date: dateOnly(subDays(context.today, 6)),
      name: "Figma subscription",
      method: "card_purchase" as const,
      amount: -186,
      currency: context.currency,
      bankAccountId: accountId("corporate-card"),
      internalId: "seed-txn-figma",
      status: "posted" as const,
      balance: -2364.22,
      manual: false,
      internal: false,
      description: "Design collaboration subscription with editor seats and Dev Mode.",
      categorySlug: "software",
      baseAmount: -186,
      baseCurrency: context.currency,
      taxAmount: -31,
      taxRate: 20,
      taxType: "vat",
      recurring: true,
      frequency: "monthly" as const,
      merchantName: "Figma",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:stripe-fees"),
      createdAt: asIso(subDays(context.today, 4)),
      date: dateOnly(subDays(context.today, 4)),
      name: "Card processing fees",
      method: "fee" as const,
      amount: -178,
      currency: context.currency,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-stripe-fees",
      status: "posted" as const,
      balance: 147402,
      manual: false,
      internal: false,
      description: "Stripe processing fees across three client invoice settlements.",
      categorySlug: "bank-fees",
      baseAmount: -178,
      baseCurrency: context.currency,
      recurring: false,
      frequency: "irregular" as const,
      merchantName: "Stripe",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:meta-ads"),
      createdAt: asIso(subDays(context.today, 2)),
      date: dateOnly(subDays(context.today, 2)),
      name: "Meta Ads spend",
      method: "card_purchase" as const,
      amount: -860,
      currency: context.currency,
      bankAccountId: accountId("corporate-card"),
      internalId: "seed-txn-meta-ads",
      status: "pending" as const,
      balance: -3224.22,
      manual: false,
      internal: false,
      description: "Retargeting campaign for Q2 pipeline.",
      categorySlug: "marketing",
      baseAmount: -860,
      baseCurrency: context.currency,
      taxAmount: -143.33,
      taxRate: 20,
      taxType: "vat",
      recurring: false,
      frequency: "irregular" as const,
      merchantName: "Meta",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:alder-payment"),
      createdAt: asIso(subDays(context.today, 1)),
      date: dateOnly(subDays(context.today, 1)),
      name: "Alder Analytics invoice payment",
      method: "payment" as const,
      amount: 1450,
      currency: context.currency,
      assignedId: customerByName.get("Alder Analytics")?.id ?? null,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-alder-payment",
      status: "posted" as const,
      balance: 148852,
      manual: false,
      internal: false,
      description: "Board reporting package payment cleared.",
      categorySlug: "revenue",
      baseAmount: 1450,
      counterpartyName: "Alder Analytics",
      baseCurrency: context.currency,
      recurring: false,
      frequency: "irregular" as const,
      merchantName: "Alder Analytics",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:orbit-retainer-apr-2025"),
      createdAt: asIso(subDays(context.today, 330)),
      date: dateOnly(subDays(context.today, 330)),
      name: "Orbit Labs retainer payment April 2025",
      method: "payment" as const,
      amount: 5200,
      currency: context.currency,
      assignedId: customerByName.get("Orbit Labs")?.id ?? null,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-orbit-apr-2025",
      status: "posted" as const,
      balance: 89400,
      manual: false,
      internal: false,
      description: "Monthly strategy retainer collected for April delivery.",
      categorySlug: "revenue",
      baseAmount: 5200,
      counterpartyName: "Orbit Labs",
      baseCurrency: context.currency,
      recurring: true,
      frequency: "monthly" as const,
      merchantName: "Orbit Labs",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:workspace-deposit-may-2025"),
      createdAt: asIso(subDays(context.today, 323)),
      date: dateOnly(subDays(context.today, 323)),
      name: "Workspace Collective deposit May 2025",
      method: "transfer" as const,
      amount: -2250,
      currency: context.currency,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-workspace-may-2025",
      status: "posted" as const,
      balance: 87150,
      manual: false,
      internal: false,
      description: "Studio membership and meeting room bundle for May.",
      categorySlug: "office",
      baseAmount: -2250,
      baseCurrency: context.currency,
      recurring: true,
      frequency: "monthly" as const,
      merchantName: "Workspace Collective",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:alder-reporting-may-2025"),
      createdAt: asIso(subDays(context.today, 302)),
      date: dateOnly(subDays(context.today, 302)),
      name: "Alder Analytics reporting payment May 2025",
      method: "payment" as const,
      amount: 1850,
      currency: context.currency,
      assignedId: customerByName.get("Alder Analytics")?.id ?? null,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-alder-may-2025",
      status: "posted" as const,
      balance: 89000,
      manual: false,
      internal: false,
      description: "Reporting and forecast package payment collected.",
      categorySlug: "revenue",
      baseAmount: 1850,
      counterpartyName: "Alder Analytics",
      baseCurrency: context.currency,
      recurring: false,
      frequency: "irregular" as const,
      merchantName: "Alder Analytics",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:northwind-audit-jun-2025"),
      createdAt: asIso(subDays(context.today, 281)),
      date: dateOnly(subDays(context.today, 281)),
      name: "Northwind Studio audit payment June 2025",
      method: "payment" as const,
      amount: 3600,
      currency: context.currency,
      assignedId: customerByName.get("Northwind Studio")?.id ?? null,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-northwind-jun-2025",
      status: "posted" as const,
      balance: 92600,
      manual: false,
      internal: false,
      description: "Paid discovery and messaging audit project.",
      categorySlug: "revenue",
      baseAmount: 3600,
      counterpartyName: "Northwind Studio",
      baseCurrency: context.currency,
      recurring: false,
      frequency: "irregular" as const,
      merchantName: "Northwind Studio",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:contractor-design-jul-2025"),
      createdAt: asIso(subDays(context.today, 298)),
      date: dateOnly(subDays(context.today, 298)),
      name: "Contractor design sprint July 2025",
      method: "transfer" as const,
      amount: -3100,
      currency: context.currency,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-design-jul-2025",
      status: "posted" as const,
      balance: 89500,
      manual: false,
      internal: false,
      description: "Freelance design support for campaign launch assets.",
      categorySlug: "contractors",
      baseAmount: -3100,
      baseCurrency: context.currency,
      taxAmount: 0,
      recurring: false,
      frequency: "irregular" as const,
      merchantName: "Freelance Design Studio",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:orbit-retainer-aug-2025"),
      createdAt: asIso(subDays(context.today, 243)),
      date: dateOnly(subDays(context.today, 243)),
      name: "Orbit Labs retainer payment August 2025",
      method: "payment" as const,
      amount: 6250,
      currency: context.currency,
      assignedId: customerByName.get("Orbit Labs")?.id ?? null,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-orbit-aug-2025",
      status: "posted" as const,
      balance: 104650,
      manual: false,
      internal: false,
      description: "Retainer and reporting package cleared for August.",
      categorySlug: "revenue",
      baseAmount: 6250,
      counterpartyName: "Orbit Labs",
      baseCurrency: context.currency,
      recurring: true,
      frequency: "monthly" as const,
      merchantName: "Orbit Labs",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:aws-aug-2025"),
      createdAt: asIso(subDays(context.today, 238)),
      date: dateOnly(subDays(context.today, 238)),
      name: "AWS bill August 2025",
      method: "card_purchase" as const,
      amount: -712.4,
      currency: context.currency,
      bankAccountId: accountId("corporate-card"),
      internalId: "seed-txn-aws-aug-2025",
      status: "posted" as const,
      balance: -712.4,
      manual: false,
      internal: false,
      description: "AWS infrastructure costs during the late-summer product push.",
      categorySlug: "software",
      baseAmount: -712.4,
      counterpartyName: "Amazon Web Services EMEA SARL",
      baseCurrency: context.currency,
      taxAmount: -118.73,
      taxRate: 20,
      taxType: "vat",
      recurring: true,
      frequency: "monthly" as const,
      merchantName: "AWS EMEA",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:seabright-launch-sep-2025"),
      createdAt: asIso(subDays(context.today, 214)),
      date: dateOnly(subDays(context.today, 214)),
      name: "Seabright Coffee launch sprint payment",
      method: "payment" as const,
      amount: 2950,
      currency: context.currency,
      assignedId: customerByName.get("Seabright Coffee")?.id ?? null,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-seabright-sep-2025",
      status: "posted" as const,
      balance: 107600,
      manual: false,
      internal: false,
      description: "Launch sprint payment for ecommerce relaunch work.",
      categorySlug: "revenue",
      baseAmount: 2950,
      counterpartyName: "Seabright Coffee",
      baseCurrency: context.currency,
      recurring: false,
      frequency: "irregular" as const,
      merchantName: "Seabright Coffee",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:google-ads-oct-2025"),
      createdAt: asIso(subDays(context.today, 205)),
      date: dateOnly(subDays(context.today, 205)),
      name: "Google Ads spend October 2025",
      method: "card_purchase" as const,
      amount: -980,
      currency: context.currency,
      bankAccountId: accountId("corporate-card"),
      internalId: "seed-txn-google-ads-oct-2025",
      status: "exported" as const,
      balance: -1692.4,
      manual: false,
      internal: false,
      description: "Search campaign budget for autumn acquisition push.",
      categorySlug: "marketing",
      baseAmount: -980,
      counterpartyName: "Google Ads",
      baseCurrency: context.currency,
      taxAmount: -163.33,
      taxRate: 20,
      taxType: "vat",
      recurring: false,
      frequency: "irregular" as const,
      merchantName: "Google Ads",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:northwind-content-oct-2025"),
      createdAt: asIso(subDays(context.today, 183)),
      date: dateOnly(subDays(context.today, 183)),
      name: "Northwind Studio content sprint payment",
      method: "payment" as const,
      amount: 4200,
      currency: context.currency,
      assignedId: customerByName.get("Northwind Studio")?.id ?? null,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-northwind-oct-2025",
      status: "posted" as const,
      balance: 111800,
      manual: false,
      internal: false,
      description: "Payment for content sprint and performance audit.",
      categorySlug: "revenue",
      baseAmount: 4200,
      counterpartyName: "Northwind Studio",
      baseCurrency: context.currency,
      recurring: false,
      frequency: "irregular" as const,
      merchantName: "Northwind Studio",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:contractor-ops-nov-2025"),
      createdAt: asIso(subDays(context.today, 176)),
      date: dateOnly(subDays(context.today, 176)),
      name: "Contractor operations support November 2025",
      method: "transfer" as const,
      amount: -4300,
      currency: context.currency,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-ops-nov-2025",
      status: "posted" as const,
      balance: 107500,
      manual: false,
      internal: false,
      description: "Operations and reporting support ahead of year-end planning.",
      categorySlug: "contractors",
      baseAmount: -4300,
      baseCurrency: context.currency,
      taxAmount: 0,
      recurring: false,
      frequency: "irregular" as const,
      merchantName: "Fractional Ops Partner",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:orbit-retainer-nov-2025"),
      createdAt: asIso(subDays(context.today, 152)),
      date: dateOnly(subDays(context.today, 152)),
      name: "Orbit Labs retainer payment November 2025",
      method: "payment" as const,
      amount: 6250,
      currency: context.currency,
      assignedId: customerByName.get("Orbit Labs")?.id ?? null,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-orbit-nov-2025",
      status: "posted" as const,
      balance: 113750,
      manual: false,
      internal: false,
      description: "Monthly Orbit retainer plus KPI reporting pack.",
      categorySlug: "revenue",
      baseAmount: 6250,
      counterpartyName: "Orbit Labs",
      baseCurrency: context.currency,
      recurring: true,
      frequency: "monthly" as const,
      merchantName: "Orbit Labs",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:aws-dec-2025"),
      createdAt: asIso(subDays(context.today, 149)),
      date: dateOnly(subDays(context.today, 149)),
      name: "AWS bill December 2025",
      method: "card_purchase" as const,
      amount: -845.32,
      currency: context.currency,
      bankAccountId: accountId("corporate-card"),
      internalId: "seed-txn-aws-dec-2025",
      status: "posted" as const,
      balance: -2537.72,
      manual: false,
      internal: false,
      description: "Higher AWS spend during reporting dashboard rollout and holiday traffic.",
      categorySlug: "software",
      baseAmount: -845.32,
      counterpartyName: "Amazon Web Services EMEA SARL",
      baseCurrency: context.currency,
      taxAmount: -140.89,
      taxRate: 20,
      taxType: "vat",
      recurring: true,
      frequency: "monthly" as const,
      merchantName: "AWS EMEA",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:alder-board-reporting-dec-2025"),
      createdAt: asIso(subDays(context.today, 123)),
      date: dateOnly(subDays(context.today, 123)),
      name: "Alder Analytics board reporting payment",
      method: "payment" as const,
      amount: 2900,
      currency: context.currency,
      assignedId: customerByName.get("Alder Analytics")?.id ?? null,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-alder-dec-2025",
      status: "posted" as const,
      balance: 116650,
      manual: false,
      internal: false,
      description: "Quarterly board reporting sprint settled in full.",
      categorySlug: "revenue",
      baseAmount: 2900,
      counterpartyName: "Alder Analytics",
      baseCurrency: context.currency,
      recurring: false,
      frequency: "irregular" as const,
      merchantName: "Alder Analytics",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:meta-ads-jan-2026"),
      createdAt: asIso(subDays(context.today, 118)),
      date: dateOnly(subDays(context.today, 118)),
      name: "Meta Ads spend January 2026",
      method: "card_purchase" as const,
      amount: -1260,
      currency: context.currency,
      bankAccountId: accountId("corporate-card"),
      internalId: "seed-txn-meta-jan-2026",
      status: "posted" as const,
      balance: -3797.72,
      manual: false,
      internal: false,
      description: "Paid social spend during January lead generation campaign.",
      categorySlug: "marketing",
      baseAmount: -1260,
      baseCurrency: context.currency,
      taxAmount: -210,
      taxRate: 20,
      taxType: "vat",
      recurring: false,
      frequency: "irregular" as const,
      merchantName: "Meta",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:seabright-cro-feb-2026"),
      createdAt: asIso(subDays(context.today, 92)),
      date: dateOnly(subDays(context.today, 92)),
      name: "Seabright Coffee CRO workshop payment",
      method: "payment" as const,
      amount: 3400,
      currency: context.currency,
      assignedId: customerByName.get("Seabright Coffee")?.id ?? null,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-seabright-feb-2026",
      status: "posted" as const,
      balance: 120050,
      manual: false,
      internal: false,
      description: "Workshop and conversion audit payment received.",
      categorySlug: "revenue",
      baseAmount: 3400,
      counterpartyName: "Seabright Coffee",
      baseCurrency: context.currency,
      recurring: false,
      frequency: "irregular" as const,
      merchantName: "Seabright Coffee",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:workspace-feb-2026"),
      createdAt: asIso(subDays(context.today, 87)),
      date: dateOnly(subDays(context.today, 87)),
      name: "Workspace Collective invoice February 2026",
      method: "transfer" as const,
      amount: -2250,
      currency: context.currency,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-workspace-feb-2026",
      status: "posted" as const,
      balance: 117800,
      manual: false,
      internal: false,
      description: "Workspace Collective monthly studio and meeting room invoice.",
      categorySlug: "office",
      baseAmount: -2250,
      baseCurrency: context.currency,
      recurring: true,
      frequency: "monthly" as const,
      merchantName: "Workspace Collective",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:contractor-motion-feb-2026"),
      createdAt: asIso(subDays(context.today, 67)),
      date: dateOnly(subDays(context.today, 67)),
      name: "Contractor motion design February 2026",
      method: "transfer" as const,
      amount: -2850,
      currency: context.currency,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-motion-feb-2026",
      status: "posted" as const,
      balance: 114950,
      manual: false,
      internal: false,
      description: "Motion design and ad creative support for client launch assets.",
      categorySlug: "contractors",
      baseAmount: -2850,
      baseCurrency: context.currency,
      taxAmount: 0,
      recurring: false,
      frequency: "irregular" as const,
      merchantName: "Motion Design Contractor",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:orbit-retainer-jun-2025"),
      createdAt: asIso(subDays(context.today, 300)),
      date: dateOnly(subDays(context.today, 300)),
      name: "Orbit Labs retainer payment June 2025",
      method: "payment" as const,
      amount: 5600,
      currency: context.currency,
      assignedId: customerByName.get("Orbit Labs")?.id ?? null,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-orbit-jun-2025",
      status: "posted" as const,
      balance: 95000,
      manual: false,
      internal: false,
      description: "Monthly Orbit retainer collected ahead of the summer campaign cycle.",
      categorySlug: "revenue",
      baseAmount: 5600,
      counterpartyName: "Orbit Labs",
      baseCurrency: context.currency,
      recurring: true,
      frequency: "monthly" as const,
      merchantName: "Orbit Labs",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:orbit-retainer-jul-2025"),
      createdAt: asIso(subDays(context.today, 271)),
      date: dateOnly(subDays(context.today, 271)),
      name: "Orbit Labs retainer payment July 2025",
      method: "payment" as const,
      amount: 5600,
      currency: context.currency,
      assignedId: customerByName.get("Orbit Labs")?.id ?? null,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-orbit-jul-2025",
      status: "posted" as const,
      balance: 100600,
      manual: false,
      internal: false,
      description: "Monthly Orbit retainer collected for landing page and funnel work.",
      categorySlug: "revenue",
      baseAmount: 5600,
      counterpartyName: "Orbit Labs",
      baseCurrency: context.currency,
      recurring: true,
      frequency: "monthly" as const,
      merchantName: "Orbit Labs",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:orbit-retainer-sep-2025"),
      createdAt: asIso(subDays(context.today, 212)),
      date: dateOnly(subDays(context.today, 212)),
      name: "Orbit Labs retainer payment September 2025",
      method: "payment" as const,
      amount: 6250,
      currency: context.currency,
      assignedId: customerByName.get("Orbit Labs")?.id ?? null,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-orbit-sep-2025",
      status: "posted" as const,
      balance: 110900,
      manual: false,
      internal: false,
      description: "Monthly Orbit retainer plus reporting pack settled in September.",
      categorySlug: "revenue",
      baseAmount: 6250,
      counterpartyName: "Orbit Labs",
      baseCurrency: context.currency,
      recurring: true,
      frequency: "monthly" as const,
      merchantName: "Orbit Labs",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:orbit-retainer-jan-2026"),
      createdAt: asIso(subDays(context.today, 86)),
      date: dateOnly(subDays(context.today, 86)),
      name: "Orbit Labs retainer payment January 2026",
      method: "payment" as const,
      amount: 6250,
      currency: context.currency,
      assignedId: customerByName.get("Orbit Labs")?.id ?? null,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-orbit-jan-2026",
      status: "posted" as const,
      balance: 124050,
      manual: false,
      internal: false,
      description: "January Orbit retainer settled before the month-end reporting run.",
      categorySlug: "revenue",
      baseAmount: 6250,
      counterpartyName: "Orbit Labs",
      baseCurrency: context.currency,
      recurring: true,
      frequency: "monthly" as const,
      merchantName: "Orbit Labs",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:orbit-retainer-feb-2026"),
      createdAt: asIso(subDays(context.today, 30)),
      date: dateOnly(subDays(context.today, 30)),
      name: "Orbit Labs retainer payment February 2026",
      method: "payment" as const,
      amount: 6250,
      currency: context.currency,
      assignedId: customerByName.get("Orbit Labs")?.id ?? null,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-orbit-feb-2026",
      status: "posted" as const,
      balance: 144650,
      manual: false,
      internal: false,
      description: "February Orbit retainer landed on time via bank transfer.",
      categorySlug: "revenue",
      baseAmount: 6250,
      counterpartyName: "Orbit Labs",
      baseCurrency: context.currency,
      recurring: true,
      frequency: "monthly" as const,
      merchantName: "Orbit Labs",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:delivery-pod-oct-2025"),
      createdAt: asIso(subDays(context.today, 170)),
      date: dateOnly(subDays(context.today, 170)),
      name: "Delivery pod contractor cost October 2025",
      method: "transfer" as const,
      amount: -6500,
      currency: context.currency,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-pod-oct-2025",
      status: "posted" as const,
      balance: 104400,
      manual: false,
      internal: false,
      description: "Monthly contractor pod cost for copy, design, and analytics support.",
      categorySlug: "contractors",
      baseAmount: -6500,
      baseCurrency: context.currency,
      taxAmount: 0,
      recurring: true,
      frequency: "monthly" as const,
      merchantName: "Delivery Pod Contractors",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:delivery-pod-nov-2025"),
      createdAt: asIso(subDays(context.today, 140)),
      date: dateOnly(subDays(context.today, 140)),
      name: "Delivery pod contractor cost November 2025",
      method: "transfer" as const,
      amount: -6500,
      currency: context.currency,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-pod-nov-2025",
      status: "posted" as const,
      balance: 108150,
      manual: false,
      internal: false,
      description: "Monthly contractor pod cost for copy, design, and analytics support.",
      categorySlug: "contractors",
      baseAmount: -6500,
      baseCurrency: context.currency,
      taxAmount: 0,
      recurring: true,
      frequency: "monthly" as const,
      merchantName: "Delivery Pod Contractors",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:delivery-pod-dec-2025"),
      createdAt: asIso(subDays(context.today, 110)),
      date: dateOnly(subDays(context.today, 110)),
      name: "Delivery pod contractor cost December 2025",
      method: "transfer" as const,
      amount: -6800,
      currency: context.currency,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-pod-dec-2025",
      status: "posted" as const,
      balance: 112900,
      manual: false,
      internal: false,
      description: "Monthly contractor pod cost including extra seasonal launch support.",
      categorySlug: "contractors",
      baseAmount: -6800,
      baseCurrency: context.currency,
      taxAmount: 0,
      recurring: true,
      frequency: "monthly" as const,
      merchantName: "Delivery Pod Contractors",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:delivery-pod-jan-2026"),
      createdAt: asIso(subDays(context.today, 80)),
      date: dateOnly(subDays(context.today, 80)),
      name: "Delivery pod contractor cost January 2026",
      method: "transfer" as const,
      amount: -7200,
      currency: context.currency,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-pod-jan-2026",
      status: "posted" as const,
      balance: 116850,
      manual: false,
      internal: false,
      description: "Monthly contractor pod cost as delivery volume stepped up in January.",
      categorySlug: "contractors",
      baseAmount: -7200,
      baseCurrency: context.currency,
      taxAmount: 0,
      recurring: true,
      frequency: "monthly" as const,
      merchantName: "Delivery Pod Contractors",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:delivery-pod-feb-2026"),
      createdAt: asIso(subDays(context.today, 50)),
      date: dateOnly(subDays(context.today, 50)),
      name: "Delivery pod contractor cost February 2026",
      method: "transfer" as const,
      amount: -7200,
      currency: context.currency,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-pod-feb-2026",
      status: "posted" as const,
      balance: 141450,
      manual: false,
      internal: false,
      description: "Monthly contractor pod cost across strategy, reporting, and experiment support.",
      categorySlug: "contractors",
      baseAmount: -7200,
      baseCurrency: context.currency,
      taxAmount: 0,
      recurring: true,
      frequency: "monthly" as const,
      merchantName: "Delivery Pod Contractors",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:delivery-pod-mar-2026"),
      createdAt: asIso(subDays(context.today, 20)),
      date: dateOnly(subDays(context.today, 20)),
      name: "Delivery pod contractor cost March 2026",
      method: "transfer" as const,
      amount: -7600,
      currency: context.currency,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-pod-mar-2026",
      status: "posted" as const,
      balance: 141252,
      manual: false,
      internal: false,
      description: "Monthly contractor pod cost with added delivery capacity for Q2 planning.",
      categorySlug: "contractors",
      baseAmount: -7600,
      baseCurrency: context.currency,
      taxAmount: 0,
      recurring: true,
      frequency: "monthly" as const,
      merchantName: "Delivery Pod Contractors",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:capital-investment-apr-2025"),
      createdAt: asIso(subDays(context.today, 340)),
      date: dateOnly(subDays(context.today, 340)),
      name: "Founder capital injection April 2025",
      method: "transfer" as const,
      amount: 25000,
      currency: context.currency,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-capital-apr-2025",
      status: "posted" as const,
      balance: 84000,
      manual: false,
      internal: false,
      description: "Founder capital introduced to support expansion and hiring.",
      categorySlug: "capital-investment",
      baseAmount: 25000,
      baseCurrency: context.currency,
      recurring: false,
      frequency: "irregular" as const,
      merchantName: "Founder Capital",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:annual-insurance-aug-2025"),
      createdAt: asIso(subDays(context.today, 235)),
      date: dateOnly(subDays(context.today, 235)),
      name: "Annual PI and cyber insurance",
      method: "card_purchase" as const,
      amount: -2400,
      currency: context.currency,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-insurance-aug-2025",
      status: "posted" as const,
      balance: 102250,
      manual: false,
      internal: false,
      description: "Annual prepaid professional indemnity and cyber cover.",
      categorySlug: "prepaid-expenses",
      baseAmount: -2400,
      baseCurrency: context.currency,
      recurring: false,
      frequency: "irregular" as const,
      merchantName: "Hiscox",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:laptop-upgrade-sep-2025"),
      createdAt: asIso(subDays(context.today, 205)),
      date: dateOnly(subDays(context.today, 205)),
      name: "Laptop and monitor upgrade",
      method: "card_purchase" as const,
      amount: -4200,
      currency: context.currency,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-equipment-sep-2025",
      status: "posted" as const,
      balance: 106700,
      manual: false,
      internal: false,
      description: "MacBook Pros, monitors, and peripherals for the delivery team.",
      categorySlug: "equipment",
      baseAmount: -4200,
      baseCurrency: context.currency,
      taxAmount: -700,
      taxRate: 20,
      taxType: "vat",
      recurring: false,
      frequency: "irregular" as const,
      merchantName: "Apple Business",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:seabright-deposit-oct-2025"),
      createdAt: asIso(subDays(context.today, 182)),
      date: dateOnly(subDays(context.today, 182)),
      name: "Seabright Coffee deposit received",
      method: "payment" as const,
      amount: 5200,
      currency: context.currency,
      assignedId: customerByName.get("Seabright Coffee")?.id ?? null,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-deferred-revenue-oct-2025",
      status: "posted" as const,
      balance: 109600,
      manual: false,
      internal: false,
      description: "Upfront deposit for launch work not yet fully recognised as revenue.",
      categorySlug: "deferred-revenue",
      baseAmount: 5200,
      counterpartyName: "Seabright Coffee",
      baseCurrency: context.currency,
      recurring: false,
      frequency: "irregular" as const,
      merchantName: "Seabright Coffee",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:salary-jan-2026"),
      createdAt: asIso(subDays(context.today, 57)),
      date: dateOnly(subDays(context.today, 57)),
      name: "Payroll January 2026",
      method: "transfer" as const,
      amount: -5800,
      currency: context.currency,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-salary-jan-2026",
      status: "posted" as const,
      balance: 122100,
      manual: false,
      internal: false,
      description: "Net salary payments for two employees for January payroll.",
      categorySlug: "salary",
      baseAmount: -5800,
      baseCurrency: context.currency,
      taxAmount: 0,
      recurring: true,
      frequency: "monthly" as const,
      merchantName: "Payroll Bureau",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:employer-taxes-jan-2026"),
      createdAt: asIso(subDays(context.today, 56)),
      date: dateOnly(subDays(context.today, 56)),
      name: "Employer taxes January 2026",
      method: "transfer" as const,
      amount: -760,
      currency: context.currency,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-employer-tax-jan-2026",
      status: "posted" as const,
      balance: 121340,
      manual: false,
      internal: false,
      description: "Employer NIC and apprenticeship levy for January payroll.",
      categorySlug: "employer-taxes",
      baseAmount: -760,
      baseCurrency: context.currency,
      taxAmount: 0,
      recurring: true,
      frequency: "monthly" as const,
      merchantName: "HMRC",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:paye-remittance-jan-2026"),
      createdAt: asIso(subDays(context.today, 54)),
      date: dateOnly(subDays(context.today, 54)),
      name: "PAYE remittance January 2026",
      method: "transfer" as const,
      amount: -2180,
      currency: context.currency,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-paye-jan-2026",
      status: "posted" as const,
      balance: 119160,
      manual: false,
      internal: false,
      description: "PAYE and employee NIC remitted to HMRC for January payroll.",
      categorySlug: "payroll-tax-remittances",
      baseAmount: -2180,
      baseCurrency: context.currency,
      taxAmount: 0,
      recurring: true,
      frequency: "monthly" as const,
      merchantName: "HMRC",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:salary-feb-2026"),
      createdAt: asIso(subDays(context.today, 28)),
      date: dateOnly(subDays(context.today, 28)),
      name: "Payroll February 2026",
      method: "transfer" as const,
      amount: -5900,
      currency: context.currency,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-salary-feb-2026",
      status: "posted" as const,
      balance: 138750,
      manual: false,
      internal: false,
      description: "Net salary payments for February payroll.",
      categorySlug: "salary",
      baseAmount: -5900,
      baseCurrency: context.currency,
      taxAmount: 0,
      recurring: true,
      frequency: "monthly" as const,
      merchantName: "Payroll Bureau",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:employer-taxes-feb-2026"),
      createdAt: asIso(subDays(context.today, 27)),
      date: dateOnly(subDays(context.today, 27)),
      name: "Employer taxes February 2026",
      method: "transfer" as const,
      amount: -780,
      currency: context.currency,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-employer-tax-feb-2026",
      status: "posted" as const,
      balance: 137970,
      manual: false,
      internal: false,
      description: "Employer NIC and levy for February payroll.",
      categorySlug: "employer-taxes",
      baseAmount: -780,
      baseCurrency: context.currency,
      taxAmount: 0,
      recurring: true,
      frequency: "monthly" as const,
      merchantName: "HMRC",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:paye-remittance-feb-2026"),
      createdAt: asIso(subDays(context.today, 25)),
      date: dateOnly(subDays(context.today, 25)),
      name: "PAYE remittance February 2026",
      method: "transfer" as const,
      amount: -2240,
      currency: context.currency,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-paye-feb-2026",
      status: "posted" as const,
      balance: 135730,
      manual: false,
      internal: false,
      description: "PAYE and employee NIC remitted to HMRC for February payroll.",
      categorySlug: "payroll-tax-remittances",
      baseAmount: -2240,
      baseCurrency: context.currency,
      taxAmount: 0,
      recurring: true,
      frequency: "monthly" as const,
      merchantName: "HMRC",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:salary-mar-2026"),
      createdAt: asIso(subDays(context.today, 4)),
      date: dateOnly(subDays(context.today, 4)),
      name: "Payroll March 2026",
      method: "transfer" as const,
      amount: -6100,
      currency: context.currency,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-salary-mar-2026",
      status: "posted" as const,
      balance: 142752,
      manual: false,
      internal: false,
      description: "Net salary payments for March payroll including annual review uplift.",
      categorySlug: "salary",
      baseAmount: -6100,
      baseCurrency: context.currency,
      taxAmount: 0,
      recurring: true,
      frequency: "monthly" as const,
      merchantName: "Payroll Bureau",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:employer-taxes-mar-2026"),
      createdAt: asIso(subDays(context.today, 3)),
      date: dateOnly(subDays(context.today, 3)),
      name: "Employer taxes March 2026",
      method: "transfer" as const,
      amount: -820,
      currency: context.currency,
      bankAccountId: accountId("operating"),
      internalId: "seed-txn-employer-tax-mar-2026",
      status: "posted" as const,
      balance: 141932,
      manual: false,
      internal: false,
      description: "Employer NIC and levy for March payroll.",
      categorySlug: "employer-taxes",
      baseAmount: -820,
      baseCurrency: context.currency,
      taxAmount: 0,
      recurring: true,
      frequency: "monthly" as const,
      merchantName: "HMRC",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:corporation-tax-dec-2025"),
      createdAt: asIso(subDays(context.today, 104)),
      date: dateOnly(subDays(context.today, 104)),
      name: "Corporation tax payment Q4 2025",
      method: "transfer" as const,
      amount: -3200,
      currency: context.currency,
      bankAccountId: accountId("tax-reserve"),
      internalId: "seed-txn-corp-tax-dec-2025",
      status: "posted" as const,
      balance: 20800,
      manual: false,
      internal: false,
      description: "Corporation tax payment transferred from tax reserve.",
      categorySlug: "taxes",
      baseAmount: -3200,
      baseCurrency: context.currency,
      taxAmount: 0,
      recurring: false,
      frequency: "irregular" as const,
      merchantName: "HMRC",
      enrichmentCompleted: true,
    },
    {
      id: seedId(context, "transaction:vat-payment-feb-2026"),
      createdAt: asIso(subDays(context.today, 45)),
      date: dateOnly(subDays(context.today, 45)),
      name: "VAT payment Q4 2025",
      method: "transfer" as const,
      amount: -2480,
      currency: context.currency,
      bankAccountId: accountId("tax-reserve"),
      internalId: "seed-txn-vat-feb-2026",
      status: "posted" as const,
      balance: 18320,
      manual: false,
      internal: false,
      description: "Quarterly VAT payment settled from tax reserve.",
      categorySlug: "taxes",
      baseAmount: -2480,
      baseCurrency: context.currency,
      taxAmount: 0,
      recurring: false,
      frequency: "irregular" as const,
      merchantName: "HMRC",
      enrichmentCompleted: true,
    },
  ] satisfies Parameters<typeof upsertTransactionsInConvex>[0]["transactions"];

  return await upsertTransactionsInConvex({
    teamId: context.teamId,
    transactions: items,
  });
}

async function seedTransactionTags(
  context: SeedContext,
  transactions: TransactionRecord[],
  tagsByName: Map<string, TagRecord>,
) {
  const transactionByName = new Map(transactions.map((transaction) => [transaction.name, transaction]));

  const retainerTag = tagsByName.get("Retainer");
  if (retainerTag) {
    await createTransactionTagInConvex({
      teamId: context.teamId,
      transactionId: transactionByName.get("Orbit Labs invoice payment")!.id,
      tagId: retainerTag.id,
    });
    await createTransactionTagInConvex({
      teamId: context.teamId,
      transactionId: transactionByName.get("Northwind Studio invoice payment")!.id,
      tagId: retainerTag.id,
    });
  }

  const subscriptionTag = tagsByName.get("Subscription");
  if (subscriptionTag) {
    await createTransactionTagInConvex({
      teamId: context.teamId,
      transactionId: transactionByName.get("AWS bill")!.id,
      tagId: subscriptionTag.id,
    });
    await createTransactionTagInConvex({
      teamId: context.teamId,
      transactionId: transactionByName.get("Figma subscription")!.id,
      tagId: subscriptionTag.id,
    });
    await createTransactionTagInConvex({
      teamId: context.teamId,
      transactionId: transactionByName.get("Google Workspace subscription")!.id,
      tagId: subscriptionTag.id,
    });
  }
}

async function seedDocuments(context: SeedContext) {
  const documentSpecs = [
      {
        seedScope: "document:orbit-msa",
        teamId: context.teamId,
        name: "vault/contracts/orbit-labs-master-services-agreement.pdf",
        createdAt: asIso(subDays(context.today, 75)),
        updatedAt: asIso(subDays(context.today, 75)),
        metadata: { seedKey: "orbit-msa", category: "contract" },
        pathTokens: ["vault", "contracts", "orbit-labs-master-services-agreement.pdf"],
        title: "Orbit Labs Master Services Agreement",
        summary: "Signed retained services agreement for Orbit Labs.",
        content: "Retained growth strategy agreement covering monthly planning, reporting, and experimentation.",
        date: dateOnly(subDays(context.today, 75)),
        language: "en",
        processingStatus: "completed",
      },
      {
        seedScope: "document:aws-receipt",
        teamId: context.teamId,
        name: "vault/receipts/aws-invoice-feb-2026.pdf",
        createdAt: asIso(subDays(context.today, 44)),
        updatedAt: asIso(subDays(context.today, 44)),
        metadata: { seedKey: "aws-receipt", category: "receipt" },
        pathTokens: ["vault", "receipts", "aws-invoice-feb-2026.pdf"],
        title: "AWS invoice February 2026",
        summary: "Cloud infrastructure bill covering EC2, RDS, CloudFront, and support.",
        content:
          "Monthly AWS invoice for Acme Inc including EC2 compute, Amazon RDS database, S3 and CloudFront delivery, and business support.",
        date: dateOnly(subDays(context.today, 44)),
        language: "en",
        processingStatus: "completed",
      },
      {
        seedScope: "document:google-workspace-receipt",
        teamId: context.teamId,
        name: "vault/receipts/google-workspace-feb-2026.pdf",
        createdAt: asIso(subDays(context.today, 35)),
        updatedAt: asIso(subDays(context.today, 35)),
        metadata: { seedKey: "google-workspace-receipt", category: "receipt" },
        pathTokens: ["vault", "receipts", "google-workspace-feb-2026.pdf"],
        title: "Google Workspace invoice February 2026",
        summary: "Team productivity subscription for Workspace seats and Gemini add-ons.",
        content:
          "Invoice from Google Cloud EMEA Limited for four Google Workspace Business Standard seats and two Gemini add-ons.",
        date: dateOnly(subDays(context.today, 35)),
        language: "en",
        processingStatus: "completed",
      },
      {
        seedScope: "document:workspace-collective-invoice",
        teamId: context.teamId,
        name: "vault/receipts/workspace-collective-mar-2026.pdf",
        createdAt: asIso(subDays(context.today, 10)),
        updatedAt: asIso(subDays(context.today, 10)),
        metadata: { seedKey: "workspace-collective-invoice", category: "receipt" },
        pathTokens: ["vault", "receipts", "workspace-collective-mar-2026.pdf"],
        title: "Workspace Collective March invoice",
        summary: "Studio membership invoice with meeting room and mail handling add-ons.",
        content:
          "Workspace Collective monthly office invoice for dedicated desks, meeting room credits, and mail handling.",
        date: dateOnly(subDays(context.today, 10)),
        language: "en",
        processingStatus: "completed",
      },
      {
        seedScope: "document:figma-receipt",
        teamId: context.teamId,
        name: "vault/receipts/figma-mar-2026.pdf",
        createdAt: asIso(subDays(context.today, 6)),
        updatedAt: asIso(subDays(context.today, 6)),
        metadata: { seedKey: "figma-receipt", category: "receipt" },
        pathTokens: ["vault", "receipts", "figma-mar-2026.pdf"],
        title: "Figma invoice March 2026",
        summary: "Design collaboration subscription for three editors and one Dev Mode seat.",
        content:
          "Monthly Figma subscription invoice for Acme Inc covering editor seats, Dev Mode, and file storage.",
        date: dateOnly(subDays(context.today, 6)),
        language: "en",
        processingStatus: "completed",
      },
      {
        seedScope: "document:q2-growth-plan",
        teamId: context.teamId,
        name: "vault/planning/q2-growth-plan.md",
        createdAt: asIso(subDays(context.today, 12)),
        updatedAt: asIso(subDays(context.today, 2)),
        metadata: { seedKey: "q2-plan", category: "planning" },
        pathTokens: ["vault", "planning", "q2-growth-plan.md"],
        title: "Q2 growth plan",
        summary: "Pipeline and retention priorities for the next quarter.",
        content: "Focus areas: retain Orbit Labs, close Seabright Coffee, improve campaign efficiency, tighten invoice follow-up.",
        date: dateOnly(subDays(context.today, 12)),
        language: "en",
        processingStatus: "completed",
      },
  ] satisfies Parameters<typeof upsertDocumentsInConvex>[0]["documents"];

  const existingDocuments = await getDocumentsFromConvex({ teamId: context.teamId });
  const existingByName = new Map(
    existingDocuments.map((document) => [document.name, document]),
  );

  const documents = await upsertDocumentsInConvex({
    documents: documentSpecs.map((document) => {
      const existing = existingByName.get(document.name);
      const { seedScope, ...payload } = document;
      return {
        ...payload,
        id: existing?.id ?? convexSeedId(context, seedScope),
      };
    }),
  });
  const documentByName = new Map(documents.map((document) => [document.name, document]));

  const documentTagResults = await upsertDocumentTagsInConvex({
    tags: [
      { teamId: context.teamId, name: "Contracts", slug: "contracts" },
      { teamId: context.teamId, name: "Receipts", slug: "receipts" },
      { teamId: context.teamId, name: "Planning", slug: "planning" },
    ],
  });
  const documentTags = await getDocumentTagsFromConvex({ teamId: context.teamId });
  const tagBySlug = new Map(documentTags.map((tag) => [tag.slug, tag]));

  await upsertDocumentTagAssignmentsInConvex({
    assignments: [
      {
        teamId: context.teamId,
        documentId:
          documentByName.get(
            "vault/contracts/orbit-labs-master-services-agreement.pdf",
          )!.id,
        tagId: tagBySlug.get("contracts")!.id,
      },
      {
        teamId: context.teamId,
        documentId:
          documentByName.get("vault/receipts/aws-invoice-feb-2026.pdf")!.id,
        tagId: tagBySlug.get("receipts")!.id,
      },
      {
        teamId: context.teamId,
        documentId:
          documentByName.get("vault/receipts/google-workspace-feb-2026.pdf")!.id,
        tagId: tagBySlug.get("receipts")!.id,
      },
      {
        teamId: context.teamId,
        documentId:
          documentByName.get("vault/receipts/workspace-collective-mar-2026.pdf")!.id,
        tagId: tagBySlug.get("receipts")!.id,
      },
      {
        teamId: context.teamId,
        documentId:
          documentByName.get("vault/receipts/figma-mar-2026.pdf")!.id,
        tagId: tagBySlug.get("receipts")!.id,
      },
      {
        teamId: context.teamId,
        documentId: documentByName.get("vault/planning/q2-growth-plan.md")!.id,
        tagId: tagBySlug.get("planning")!.id,
      },
    ],
  });

  return {
    tags: documentTagResults,
    documents: await getDocumentsFromConvex({ teamId: context.teamId }),
  };
}

async function seedInbox(context: SeedContext, transactions: TransactionRecord[]) {
  const existingAccounts = await getInboxAccountsFromConvex({
    teamId: context.teamId,
  });

  async function ensureInboxAccount(args: {
    provider: "gmail" | "outlook";
    email: string;
    accessToken: string;
    refreshToken: string;
    lastAccessed: string;
    expiryDate: string;
    externalIdScope: string;
  }) {
    const existing = existingAccounts.find(
      (account) =>
        account.provider === args.provider && account.email === args.email,
    );

    if (existing) {
      await updateInboxAccountInConvex({
        id: existing.id,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        lastAccessed: args.lastAccessed,
        expiryDate: args.expiryDate,
        status: "connected",
        errorMessage: null,
      });

      return { id: existing.id };
    }

    const created = await upsertInboxAccountInConvex({
      teamId: context.teamId,
      provider: args.provider,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      email: args.email,
      lastAccessed: args.lastAccessed,
      externalId: seedId(context, args.externalIdScope),
      expiryDate: args.expiryDate,
    });

    return { id: created.id };
  }

  const gmailAccount = await ensureInboxAccount({
    provider: "gmail",
    email: "receipts@acme.example",
    accessToken: "seed-gmail-access",
    refreshToken: "seed-gmail-refresh",
    lastAccessed: asIso(subDays(context.today, 1)),
    expiryDate: asIso(addDays(context.today, 30)),
    externalIdScope: "inbox-account:gmail",
  });

  const outlookAccount = await ensureInboxAccount({
    provider: "outlook",
    email: "payables@acme.example",
    accessToken: "seed-outlook-access",
    refreshToken: "seed-outlook-refresh",
    lastAccessed: asIso(subDays(context.today, 2)),
    expiryDate: asIso(addDays(context.today, 30)),
    externalIdScope: "inbox-account:outlook",
  });

  const blocklist = await getInboxBlocklistFromConvex({ teamId: context.teamId });
  if (!blocklist.some((item) => item.value === "spamvendor.example")) {
    await createInboxBlocklistInConvex({
      teamId: context.teamId,
      type: "domain",
      value: "spamvendor.example",
    });
  }

  const transactionByName = new Map(transactions.map((transaction) => [transaction.name, transaction]));
  const existingItems = await getInboxItemsFromConvex({ teamId: context.teamId });
  const existingItemByReferenceId = new Map(
    existingItems
      .filter((item) => item.referenceId !== null)
      .map((item) => [item.referenceId!, item]),
  );

  const inboxSpecs = [
      {
        seedScope: "inbox-item:aws-receipt",
        teamId: context.teamId,
        createdAt: asIso(subDays(context.today, 44)),
        updatedAt: asIso(subDays(context.today, 44)),
        filePath: ["inbox", "receipts", "aws-feb-2026.pdf"],
        fileName: "aws-feb-2026.pdf",
        transactionId: transactionByName.get("AWS bill")!.id,
        amount: 684.22,
        currency: context.currency,
        contentType: "application/pdf",
        size: 248000,
        date: dateOnly(subDays(context.today, 44)),
        referenceId: "seed-ref-aws-receipt",
        status: "done",
        senderEmail: "no-reply@amazonaws.com",
        displayName: "AWS Billing",
        type: "expense",
        description: "January AWS invoice for hosting, database, CDN, support, and data transfer.",
        pdfLines: [
          "AWS EMEA SARL - Tax Invoice",
          "Invoice date: 11 Feb 2026",
          "Billing period: 1 Jan 2026 - 31 Jan 2026",
          "Account ID: 4813-1908",
          "Customer: Acme Inc",
          "EC2 Linux instances ................. GBP 226.40",
          "Amazon RDS database ................ GBP 138.12",
          "S3 + CloudFront .................... GBP 97.89",
          "Business support ................... GBP 82.77",
          "Data transfer out .................. GBP 25.00",
          "Subtotal ........................... GBP 570.18",
          "VAT (20%) ......................... GBP 114.04",
          "Total due ......................... GBP 684.22",
        ],
        baseAmount: 684.22,
        baseCurrency: context.currency,
        taxAmount: 114.04,
        taxRate: 20,
        taxType: "vat",
        inboxAccountId: gmailAccount.id,
      },
      {
        seedScope: "inbox-item:google-workspace",
        teamId: context.teamId,
        createdAt: asIso(subDays(context.today, 35)),
        updatedAt: asIso(subDays(context.today, 35)),
        filePath: ["inbox", "receipts", "google-workspace-feb-2026.pdf"],
        fileName: "google-workspace-feb-2026.pdf",
        transactionId: transactionByName.get("Google Workspace subscription")!.id,
        amount: 144,
        currency: context.currency,
        contentType: "application/pdf",
        size: 164000,
        date: dateOnly(subDays(context.today, 35)),
        referenceId: "seed-ref-google-workspace",
        status: "done",
        senderEmail: "billing-noreply@google.com",
        displayName: "Google Workspace",
        type: "expense",
        description: "Workspace seats, Gemini add-ons, and shared storage for the team.",
        pdfLines: [
          "Google Cloud EMEA Limited - Invoice",
          "Invoice date: 20 Feb 2026",
          "Billing account: 0017-4819-2210",
          "Customer: Acme Inc",
          "Workspace Business Standard x6 ..... GBP 108.00",
          "Gemini add-on x2 ................... GBP 12.00",
          "Vault storage overage .............. GBP 0.00",
          "Subtotal ........................... GBP 120.00",
          "VAT (20%) ......................... GBP 24.00",
          "Total due ......................... GBP 144.00",
        ],
        baseAmount: 144,
        baseCurrency: context.currency,
        taxAmount: 24,
        taxRate: 20,
        taxType: "vat",
        inboxAccountId: gmailAccount.id,
      },
      {
        seedScope: "inbox-item:northwind-remittance",
        teamId: context.teamId,
        createdAt: asIso(subDays(context.today, 20)),
        updatedAt: asIso(subDays(context.today, 20)),
        filePath: ["inbox", "payments", "northwind-remittance.eml"],
        fileName: "northwind-remittance.eml",
        amount: 2900,
        currency: context.currency,
        contentType: "message/rfc822",
        size: 54000,
        date: dateOnly(subDays(context.today, 20)),
        referenceId: "seed-ref-northwind-remittance",
        status: "suggested_match",
        senderEmail: "ap@northwind.studio",
        displayName: "Northwind Accounts Payable",
        type: "invoice",
        description: "Remittance advice for invoice NW-220.",
        emailBody: [
          "Hello Acme team,",
          "",
          "Please find remittance details for invoice INV-2026-002 / client ref NW-220.",
          "",
          `Payment date: ${dateOnly(subDays(context.today, 20))}`,
          "Payment reference: NW-220-7183",
          "Amount paid: GBP 2,900.00",
          "",
          "This settles the February growth sprint approved last week.",
          "",
          "Regards,",
          "Northwind Accounts Payable",
        ].join("\n"),
        baseAmount: 2900,
        baseCurrency: context.currency,
        inboxAccountId: outlookAccount.id,
        invoiceNumber: "INV-2026-002",
      },
      {
        seedScope: "inbox-item:travel-receipt",
        teamId: context.teamId,
        createdAt: asIso(subDays(context.today, 14)),
        updatedAt: asIso(subDays(context.today, 13)),
        filePath: ["inbox", "travel", "edinburgh-workshop-receipt.jpg"],
        fileName: "edinburgh-workshop-receipt.jpg",
        amount: 120,
        currency: context.currency,
        contentType: "image/jpeg",
        size: 182000,
        date: dateOnly(subDays(context.today, 14)),
        referenceId: "seed-ref-travel-receipt",
        status: "no_match",
        senderEmail: "bookings@lner.co.uk",
        displayName: "LNER",
        type: "expense",
        description: "Travel receipt without an accepted match yet.",
        baseAmount: 120,
        baseCurrency: context.currency,
        inboxAccountId: gmailAccount.id,
      },
      {
        seedScope: "inbox-item:workspace-collective",
        teamId: context.teamId,
        createdAt: asIso(subDays(context.today, 10)),
        updatedAt: asIso(subDays(context.today, 10)),
        filePath: ["inbox", "receipts", "workspace-collective-mar-2026.pdf"],
        fileName: "workspace-collective-mar-2026.pdf",
        transactionId: transactionByName.get("Studio rent")!.id,
        amount: 2250,
        currency: context.currency,
        contentType: "application/pdf",
        size: 176000,
        date: dateOnly(subDays(context.today, 10)),
        referenceId: "seed-ref-workspace-collective",
        status: "done",
        senderEmail: "billing@workspacecollective.co",
        displayName: "Workspace Collective",
        type: "expense",
        description: "March studio membership invoice with meeting rooms and production space.",
        pdfLines: [
          "Workspace Collective - March Invoice",
          "Invoice date: 18 Mar 2026",
          "Customer: Acme Inc",
          "Dedicated studio membership ........ GBP 1,650.00",
          "Meeting room credits ............... GBP 420.00",
          "Mail handling + lockers ............ GBP 180.00",
          "Total due ......................... GBP 2,250.00",
        ],
        baseAmount: 2250,
        baseCurrency: context.currency,
        inboxAccountId: outlookAccount.id,
      },
      {
        seedScope: "inbox-item:figma",
        teamId: context.teamId,
        createdAt: asIso(subDays(context.today, 6)),
        updatedAt: asIso(subDays(context.today, 6)),
        filePath: ["inbox", "receipts", "figma-mar-2026.pdf"],
        fileName: "figma-mar-2026.pdf",
        transactionId: transactionByName.get("Figma subscription")!.id,
        amount: 186,
        currency: context.currency,
        contentType: "application/pdf",
        size: 152000,
        date: dateOnly(subDays(context.today, 6)),
        referenceId: "seed-ref-figma",
        status: "done",
        senderEmail: "billing@figma.com",
        displayName: "Figma",
        type: "expense",
        description: "Monthly design collaboration subscription with extra editor capacity.",
        pdfLines: [
          "Figma, Inc. - Invoice",
          "Invoice date: 22 Mar 2026",
          "Workspace: Acme Design",
          "Professional editor seats x5 ...... GBP 115.00",
          "Dev Mode seat x2 ................... GBP 40.00",
          "Subtotal ........................... GBP 155.00",
          "VAT (20%) ......................... GBP 31.00",
          "Total due ......................... GBP 186.00",
        ],
        baseAmount: 186,
        baseCurrency: context.currency,
        taxAmount: 31,
        taxRate: 20,
        taxType: "vat",
        inboxAccountId: gmailAccount.id,
      },
      {
        seedScope: "inbox-item:slack-renewal",
        teamId: context.teamId,
        createdAt: asIso(subDays(context.today, 2)),
        updatedAt: asIso(subDays(context.today, 2)),
        filePath: ["inbox", "receipts", "slack-mar-2026.pdf"],
        fileName: "slack-mar-2026.pdf",
        amount: 264,
        currency: context.currency,
        contentType: "application/pdf",
        size: 148000,
        date: dateOnly(subDays(context.today, 2)),
        referenceId: "seed-ref-slack-renewal",
        status: "pending",
        senderEmail: "billing@slack.com",
        displayName: "Slack",
        type: "expense",
        description: "New workspace invoice waiting to be categorised and matched.",
        pdfLines: [
          "Slack Technologies - Invoice",
          "Invoice date: 26 Mar 2026",
          "Workspace: Acme Ops",
          "Business+ seats x10 ............... GBP 220.00",
          "VAT (20%) ......................... GBP 44.00",
          "Total due ......................... GBP 264.00",
        ],
        baseAmount: 264,
        baseCurrency: context.currency,
        taxAmount: 44,
        taxRate: 20,
        taxType: "vat",
        inboxAccountId: gmailAccount.id,
      },
      {
        seedScope: "inbox-item:contract-renewal",
        teamId: context.teamId,
        createdAt: asIso(subDays(context.today, 1)),
        updatedAt: asIso(subDays(context.today, 1)),
        filePath: ["inbox", "contracts", "orbit-renewal-draft.pdf"],
        fileName: "orbit-renewal-draft.pdf",
        contentType: "application/pdf",
        size: 166000,
        date: dateOnly(subDays(context.today, 1)),
        referenceId: "seed-ref-contract-renewal",
        status: "other",
        senderEmail: "legal@orbitlabs.co",
        displayName: "Orbit Labs Legal",
        type: "other",
        description: "Contract renewal draft waiting for review.",
        pdfLines: [
          "Orbit Labs - Renewal Draft",
          "Prepared for: Acme Inc",
          "Term: 1 Apr 2026 - 30 Sep 2026",
          "Retainer: GBP 2,500 per month",
          "Forecast pack: GBP 650 per month",
          "Notice period: 30 days",
          "Status: awaiting review",
        ],
        inboxAccountId: outlookAccount.id,
      },
  ] satisfies Parameters<typeof upsertInboxItemsInConvex>[0]["items"];

  await ensureSeedInboxSampleFiles(context, inboxSpecs);

  const seededItems = await upsertInboxItemsInConvex({
    items: inboxSpecs.map((item) => {
      const existing = item.referenceId
        ? existingItemByReferenceId.get(item.referenceId)
        : null;
      const { seedScope, ...payload } = item;
      return {
        ...payload,
        id: existing?.id ?? convexSeedId(context, seedScope),
      };
    }),
  });
  const inboxItemByReferenceId = new Map(
    seededItems
      .filter((item) => item.referenceId !== null)
      .map((item) => [item.referenceId!, item]),
  );
  const existingSuggestions = await getTransactionMatchSuggestionsFromConvex({
    teamId: context.teamId,
  });
  const existingSuggestionBySeedKey = new Map(
    existingSuggestions
      .map((suggestion) => {
        const seedKey = metadataSeedKey(suggestion.matchDetails);
        return seedKey ? [seedKey, suggestion] : null;
      })
      .filter(
        (
          entry,
        ): entry is [string, (typeof existingSuggestions)[number]] => entry !== null,
      ),
  );

  await upsertTransactionMatchSuggestionsInConvex({
    suggestions: [
      {
        teamId: context.teamId,
        ...(existingSuggestionBySeedKey.has("northwind-remittance")
          ? {
              id: existingSuggestionBySeedKey.get("northwind-remittance")!.id,
            }
          : {}),
        inboxId: inboxItemByReferenceId.get("seed-ref-northwind-remittance")!.id,
        transactionId: transactionByName.get("Northwind Studio invoice payment")!.id,
        confidenceScore: 0.94,
        amountScore: 1,
        currencyScore: 1,
        dateScore: 0.92,
        nameScore: 0.89,
        matchType: "suggested",
        matchDetails: {
          seedKey: "northwind-remittance",
          reason: "Amount, sender, and date line up with the payment.",
        },
        status: "pending",
        createdAt: asIso(subDays(context.today, 20)),
        updatedAt: asIso(subDays(context.today, 20)),
      },
    ],
  });

  return seededItems;
}

async function seedInvoiceSetup(context: SeedContext) {
  const productSpecs = [
    {
      name: "Fractional CMO Retainer",
      description: "Monthly planning, reporting, and campaign leadership.",
      price: 4800,
      unit: "month",
      taxRate: 0,
      usageCount: 8,
    },
    {
      name: "Growth Experiment Sprint",
      description: "Two-week sprint for landing page and funnel experiments.",
      price: 2900,
      unit: "project",
      taxRate: 0,
      usageCount: 5,
    },
    {
      name: "Reporting & Forecast Pack",
      description: "Monthly KPI pack, cash view, and forecast notes.",
      price: 1450,
      unit: "project",
      taxRate: 0,
      usageCount: 4,
    },
  ] as const;

  const existingProducts = await getInvoiceProductsFromConvex({
    teamId: context.teamId,
    includeInactive: true,
    sortBy: "recent",
    limit: 100,
  });

  const productsByName = new Map<string, typeof existingProducts>();
  for (const product of existingProducts) {
    const matches = productsByName.get(product.name) ?? [];
    matches.push(product);
    productsByName.set(product.name, matches);
  }

  for (const spec of productSpecs) {
    const matches = productsByName.get(spec.name) ?? [];

    if (matches.length === 0) {
      await upsertInvoiceProductInConvex({
        teamId: context.teamId,
        userId: context.userId,
        name: spec.name,
        description: spec.description,
        price: spec.price,
        currency: context.currency,
        unit: spec.unit,
        taxRate: spec.taxRate,
      });
      continue;
    }

    const [primary, ...duplicates] = matches;

    await updateInvoiceProductInConvex({
      teamId: context.teamId,
      id: primary.id,
      name: spec.name,
      description: spec.description,
      price: spec.price,
      currency: context.currency,
      unit: spec.unit,
      taxRate: spec.taxRate,
      isActive: true,
      usageCount: spec.usageCount,
      lastUsedAt: asIso(subDays(context.today, 1)),
    });

    for (const duplicate of duplicates) {
      await deleteInvoiceProductInConvex({
        teamId: context.teamId,
        id: duplicate.id,
      });
    }
  }

  const products = await getInvoiceProductsFromConvex({
    teamId: context.teamId,
    includeInactive: true,
    sortBy: "recent",
    limit: 20,
  });

  const templateName = "Local Sample Invoice Template";
  const templateData = {
    ...DEFAULT_TEMPLATE,
    currency: context.currency,
    locale: context.locale,
    timezone: context.timezone,
    includeDecimals: true,
    includeUnits: true,
    paymentEnabled: true,
    paymentTermsDays: 14,
    fromDetails: editorDoc(`${context.teamName}\n${context.team.email ?? ""}`),
    paymentDetails: editorDoc(
      "Bank transfer to Acme Inc\nSort code: 20-45-67\nAccount number: 11009988",
    ),
    noteDetails: editorDoc("Thanks for the partnership."),
  };

  const existingTemplates = await getInvoiceTemplatesFromConvex({
    teamId: context.teamId,
  });
  const existingTemplate = existingTemplates.find(
    (template) => template.name === templateName,
  );

  const template = existingTemplate
    ? await upsertInvoiceTemplateInConvex({
        teamId: context.teamId,
        id: existingTemplate.id,
        name: templateName,
        templateData,
      })
    : await createInvoiceTemplateInConvex({
        teamId: context.teamId,
        name: templateName,
        isDefault: existingTemplates.length === 0,
        templateData,
      });

  return {
    products: await getInvoiceProductsFromConvex({
      teamId: context.teamId,
      includeInactive: true,
      sortBy: "recent",
      limit: 20,
    }),
    template,
    templateData,
  };
}

async function upsertInvoiceRecord(args: {
  context: SeedContext;
  id: string;
  invoiceNumber: string;
  customer: CustomerRecord;
  templateId: string | null;
  template: Record<string, unknown>;
  lineItems: LineItem[];
  issueDate: Date;
  dueDate: Date;
  status: "draft" | "scheduled" | "unpaid" | "overdue" | "paid";
  sentTo?: string | null;
  sentAt?: Date | null;
  paidAt?: Date | null;
  scheduledAt?: Date | null;
  discount?: number;
  internalNote?: string | null;
}) {
  const subtotal = amountForLineItems(args.lineItems);
  const discount = args.discount ?? 0;
  const amount = subtotal - discount;

  await draftInvoice(db, {
    id: args.id,
    teamId: args.context.teamId,
    userId: args.context.userId,
    templateId: args.templateId,
    template: args.template as any,
    customerId: args.customer.id,
    customerName: args.customer.name,
    customerDetails: editorDoc(
      `${args.customer.name}\n${args.customer.billingEmail ?? args.customer.email}`,
    ) as any,
    fromDetails: (args.template.fromDetails ?? null) as any,
    paymentDetails: (args.template.paymentDetails ?? null) as any,
    noteDetails: (args.template.noteDetails ?? null) as any,
    dueDate: asIso(args.dueDate),
    issueDate: asIso(args.issueDate),
    invoiceNumber: args.invoiceNumber,
    logoUrl: null,
    vat: 0,
    tax: 0,
    discount,
    subtotal,
    amount,
    lineItems: args.lineItems as any,
  });

  const currentInvoice = await getInvoices(db, {
    teamId: args.context.teamId,
    ids: [args.id],
    pageSize: 1,
  });

  const current = currentInvoice.data[0] ?? null;

  if (args.status !== "draft" && current?.status !== args.status) {
    await updateInvoice(db, {
      id: args.id,
      teamId: args.context.teamId,
      userId: args.context.userId,
      status: args.status,
      sentTo: args.sentTo ?? null,
      sentAt: args.sentAt ? asIso(args.sentAt) : null,
      paidAt: args.paidAt ? asIso(args.paidAt) : null,
      scheduledAt: args.scheduledAt ? asIso(args.scheduledAt) : null,
      internalNote: args.internalNote ?? null,
    });
  }

  const invoice = await getInvoices(db, {
    teamId: args.context.teamId,
    ids: [args.id],
    pageSize: 1,
  });

  return invoice.data[0]!;
}

async function seedInvoices(
  context: SeedContext,
  customers: CustomerRecord[],
  products: Awaited<ReturnType<typeof getInvoiceProductsFromConvex>>,
  template: InvoiceTemplateRecord,
  templateData: Record<string, unknown>,
) {
  const customerByName = new Map(customers.map((customer) => [customer.name, customer]));
  const productByName = new Map(products.map((product) => [product.name, product]));

  const orbitRetainer: LineItem[] = [
    {
      name: "Fractional CMO Retainer",
      quantity: 1,
      price: productByName.get("Fractional CMO Retainer")?.price ?? 2500,
      unit: "month",
      productId: productByName.get("Fractional CMO Retainer")?.id,
    },
    {
      name: "Reporting & Forecast Pack",
      quantity: 1,
      price: productByName.get("Reporting & Forecast Pack")?.price ?? 650,
      unit: "project",
      productId: productByName.get("Reporting & Forecast Pack")?.id,
    },
  ];
  const sprint: LineItem[] = [
    {
      name: "Growth Experiment Sprint",
      quantity: 1,
      price: productByName.get("Growth Experiment Sprint")?.price ?? 1200,
      unit: "project",
      productId: productByName.get("Growth Experiment Sprint")?.id,
    },
  ];
  const retainerOnly: LineItem[] = [
    {
      name: "Fractional CMO Retainer",
      quantity: 1,
      price: productByName.get("Fractional CMO Retainer")?.price ?? 2500,
      unit: "month",
      productId: productByName.get("Fractional CMO Retainer")?.id,
    },
  ];
  const reportingAndSprint: LineItem[] = [
    {
      name: "Growth Experiment Sprint",
      quantity: 1,
      price: productByName.get("Growth Experiment Sprint")?.price ?? 1200,
      unit: "project",
      productId: productByName.get("Growth Experiment Sprint")?.id,
    },
    {
      name: "Reporting & Forecast Pack",
      quantity: 1,
      price: productByName.get("Reporting & Forecast Pack")?.price ?? 650,
      unit: "project",
      productId: productByName.get("Reporting & Forecast Pack")?.id,
    },
  ];

  const paidInvoice = await upsertInvoiceRecord({
    context,
    id: seedId(context, "invoice:paid"),
    invoiceNumber: "INV-2026-001",
    customer: customerByName.get("Orbit Labs")!,
    templateId: template.id,
    template: templateData,
    lineItems: orbitRetainer,
    issueDate: subDays(context.today, 42),
    dueDate: subDays(context.today, 28),
    status: "paid",
    sentTo: customerByName.get("Orbit Labs")!.billingEmail,
    sentAt: subDays(context.today, 41),
    paidAt: subDays(context.today, 27),
    internalNote: "Paid on time via bank transfer.",
  });

  const overdueInvoice = await upsertInvoiceRecord({
    context,
    id: seedId(context, "invoice:overdue"),
    invoiceNumber: "INV-2026-002",
    customer: customerByName.get("Northwind Studio")!,
    templateId: template.id,
    template: templateData,
    lineItems: sprint,
    issueDate: subDays(context.today, 24),
    dueDate: subDays(context.today, 10),
    status: "overdue",
    sentTo: customerByName.get("Northwind Studio")!.billingEmail,
    sentAt: subDays(context.today, 23),
    internalNote: "Follow up with AP early next week.",
  });

  const unpaidInvoice = await upsertInvoiceRecord({
    context,
    id: seedId(context, "invoice:unpaid"),
    invoiceNumber: "INV-2026-003",
    customer: customerByName.get("Alder Analytics")!,
    templateId: template.id,
    template: templateData,
    lineItems: [
      {
        name: "Reporting & Forecast Pack",
        quantity: 2,
        price: productByName.get("Reporting & Forecast Pack")?.price ?? 650,
        unit: "project",
        productId: productByName.get("Reporting & Forecast Pack")?.id,
      },
    ],
    issueDate: subDays(context.today, 6),
    dueDate: addDays(context.today, 8),
    status: "unpaid",
    sentTo: customerByName.get("Alder Analytics")!.billingEmail,
    sentAt: subDays(context.today, 5),
    internalNote: "Expected to clear this week.",
  });

  const draftInvoiceRecord = await upsertInvoiceRecord({
    context,
    id: seedId(context, "invoice:draft"),
    invoiceNumber: "INV-2026-004",
    customer: customerByName.get("Seabright Coffee")!,
    templateId: template.id,
    template: templateData,
    lineItems: sprint,
    issueDate: context.today,
    dueDate: addDays(context.today, 14),
    status: "draft",
    internalNote: "Awaiting scope sign-off before sending.",
  });

  const scheduledInvoice = await upsertInvoiceRecord({
    context,
    id: seedId(context, "invoice:scheduled"),
    invoiceNumber: "INV-2026-005",
    customer: customerByName.get("Orbit Labs")!,
    templateId: template.id,
    template: templateData,
    lineItems: orbitRetainer,
    issueDate: addDays(context.today, 12),
    dueDate: addDays(context.today, 26),
    status: "scheduled",
    scheduledAt: addDays(context.today, 12),
    internalNote: "Queued as the next recurring Orbit invoice.",
  });

  const recentPaidInvoice = await upsertInvoiceRecord({
    context,
    id: seedId(context, "invoice:recent-paid"),
    invoiceNumber: "INV-2025-012",
    customer: customerByName.get("Northwind Studio")!,
    templateId: template.id,
    template: templateData,
    lineItems: orbitRetainer,
    issueDate: subDays(context.today, 74),
    dueDate: subDays(context.today, 60),
    status: "paid",
    sentTo: customerByName.get("Northwind Studio")!.billingEmail,
    sentAt: subDays(context.today, 73),
    paidAt: subDays(context.today, 59),
    internalNote: "January retainer cleared via same-day bank transfer.",
  });

  const paidExpansionInvoice = await upsertInvoiceRecord({
    context,
    id: seedId(context, "invoice:paid-expansion"),
    invoiceNumber: "INV-2026-006",
    customer: customerByName.get("Alder Analytics")!,
    templateId: template.id,
    template: templateData,
    lineItems: reportingAndSprint,
    issueDate: subDays(context.today, 18),
    dueDate: subDays(context.today, 4),
    status: "paid",
    sentTo: customerByName.get("Alder Analytics")!.billingEmail,
    sentAt: subDays(context.today, 17),
    paidAt: subDays(context.today, 3),
    internalNote: "Paid alongside quarterly reporting workshop.",
  });

  const currentUnpaidRetainer = await upsertInvoiceRecord({
    context,
    id: seedId(context, "invoice:current-unpaid"),
    invoiceNumber: "INV-2026-007",
    customer: customerByName.get("Orbit Labs")!,
    templateId: template.id,
    template: templateData,
    lineItems: retainerOnly,
    issueDate: subDays(context.today, 2),
    dueDate: addDays(context.today, 12),
    status: "unpaid",
    sentTo: customerByName.get("Orbit Labs")!.billingEmail,
    sentAt: subDays(context.today, 2),
    internalNote: "March retainer sent and awaiting approval in AP queue.",
  });

  return {
    paidInvoice,
    overdueInvoice,
    unpaidInvoice,
    draftInvoice: draftInvoiceRecord,
    scheduledInvoice,
    extraInvoices: [recentPaidInvoice, paidExpansionInvoice, currentUnpaidRetainer],
  };
}

async function seedRecurringInvoice(
  context: SeedContext,
  customer: CustomerRecord,
  invoices: Awaited<ReturnType<typeof seedInvoices>>,
  templateData: Record<string, unknown>,
  templateId: string | null,
) {
  const recurringId = seedId(context, "recurring:orbit-retainer");
  const existing = await getInvoiceRecurringById(db, {
    id: recurringId,
    teamId: context.teamId,
  });

  const recurringPayload = {
    id: recurringId,
    createdAt: existing?.createdAt ?? asIso(subDays(context.today, 42)),
    updatedAt: asIso(context.today),
    teamId: context.teamId,
    userId: context.userId,
    customerId: customer.id,
    customerName: customer.name,
    frequency: "monthly_date" as const,
    frequencyDay: 1,
    frequencyWeek: null,
    frequencyInterval: null,
    endType: "after_count" as const,
    endDate: null,
    endCount: 12,
    status: "active",
    invoicesGenerated: 1,
    consecutiveFailures: 0,
    nextScheduledAt: asIso(addDays(context.today, 12)),
    lastGeneratedAt: invoices.paidInvoice.issueDate,
    upcomingNotificationSentAt: null,
    timezone: context.timezone,
    dueDateOffset: 14,
    amount: invoices.scheduledInvoice.amount,
    currency: context.currency,
    lineItems: invoices.scheduledInvoice.lineItems,
    template: templateData,
    paymentDetails: templateData.paymentDetails ?? null,
    fromDetails: templateData.fromDetails ?? null,
    noteDetails: templateData.noteDetails ?? null,
    vat: 0,
    tax: 0,
    discount: 0,
    subtotal: invoices.scheduledInvoice.subtotal,
    topBlock: null,
    bottomBlock: null,
    templateId,
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      website: customer.website,
    },
  };

  await upsertInvoiceRecurringSeriesInConvex({
    teamId: context.teamId,
    id: recurringId,
    customerId: customer.id,
    customerName: customer.name,
    status: "active",
    nextScheduledAt: recurringPayload.nextScheduledAt,
    payload: recurringPayload as Record<string, unknown>,
  });

  await updateInvoice(db, {
    id: invoices.paidInvoice.id,
    teamId: context.teamId,
    userId: context.userId,
    invoiceRecurringId: recurringId,
    recurringSequence: 1,
  });
  await updateInvoice(db, {
    id: invoices.scheduledInvoice.id,
    teamId: context.teamId,
    userId: context.userId,
    invoiceRecurringId: recurringId,
    recurringSequence: 2,
  });

  return await getInvoiceRecurringSeriesByLegacyIdFromConvex({ id: recurringId });
}

async function seedTracker(
  context: SeedContext,
  customers: CustomerRecord[],
  tagsByName: Map<string, TagRecord>,
) {
  const customerByName = new Map(customers.map((customer) => [customer.name, customer]));
  const existingProjects = await getTrackerProjectsFromConvex({
    teamId: context.teamId,
  });
  const existingProjectByName = new Map(
    existingProjects.map((project) => [project.name, project]),
  );

  const projects: TrackerProjectRecord[] = [];
  for (const project of [
    {
      teamId: context.teamId,
      name: "Orbit Retainer Refresh",
      description: "Monthly planning, reporting, and experiment cadence.",
      status: "in_progress" as const,
      customerId: customerByName.get("Orbit Labs")!.id,
      estimate: 24,
      currency: context.currency,
      billable: true,
      rate: 125,
    },
    {
      teamId: context.teamId,
      name: "Alder Forecast Sprint",
      description: "Reporting cleanup and forecast modelling.",
      status: "completed" as const,
      customerId: customerByName.get("Alder Analytics")!.id,
      estimate: 12,
      currency: context.currency,
      billable: true,
      rate: 110,
    },
    {
      teamId: context.teamId,
      name: "Internal Operating Cadence",
      description: "Planning, invoicing, and process cleanup.",
      status: "in_progress" as const,
      customerId: null,
      estimate: 8,
      currency: context.currency,
      billable: false,
      rate: null,
    },
  ] satisfies Array<Omit<TrackerProjectRecord, "createdAt" | "updatedAt" | "id">>) {
    const existing = existingProjectByName.get(project.name);
    projects.push(
      await upsertTrackerProjectInConvex({
        ...project,
        id: existing?.id ?? convexSeedId(context, `project:${project.name}`),
      }),
    );
  }

  const projectByName = new Map(projects.map((project) => [project.name, project]));
  const existingEntries = await getTrackerEntriesByRangeFromConvex({
    teamId: context.teamId,
    from: "2026-01-01",
    to: "2026-12-31",
  });
  const existingEntryByKey = new Map(
    existingEntries.map((entry) => [
      `${entry.date}::${entry.description ?? ""}::${entry.projectId ?? ""}`,
      entry,
    ]),
  );

  await upsertTrackerEntriesInConvex({
    teamId: context.teamId,
    entries: [
      {
        id:
          existingEntryByKey.get(
            `${dateOnly(subDays(context.today, 8))}::Monthly planning call and experiment backlog.::${projectByName.get("Orbit Retainer Refresh")!.id}`,
          )?.id ??
          convexSeedId(context, "entry:orbit-kickoff"),
        teamId: context.teamId,
        projectId: projectByName.get("Orbit Retainer Refresh")!.id,
        assignedId: context.userId,
        description: "Monthly planning call and experiment backlog.",
        date: dateOnly(subDays(context.today, 8)),
        start: asIso(subDays(context.today, 8)),
        stop: asIso(addDays(subDays(context.today, 8), 0)),
        duration: 7200,
        rate: 125,
        currency: context.currency,
        billed: false,
      },
      {
        id:
          existingEntryByKey.get(
            `${dateOnly(subDays(context.today, 6))}::Weekly reporting and optimisation notes.::${projectByName.get("Orbit Retainer Refresh")!.id}`,
          )?.id ??
          convexSeedId(context, "entry:orbit-reporting"),
        teamId: context.teamId,
        projectId: projectByName.get("Orbit Retainer Refresh")!.id,
        assignedId: context.userId,
        description: "Weekly reporting and optimisation notes.",
        date: dateOnly(subDays(context.today, 6)),
        duration: 5400,
        rate: 125,
        currency: context.currency,
        billed: false,
      },
      {
        id:
          existingEntryByKey.get(
            `${dateOnly(subDays(context.today, 5))}::Forecast model cleanup and commentary.::${projectByName.get("Alder Forecast Sprint")!.id}`,
          )?.id ??
          convexSeedId(context, "entry:alder-model"),
        teamId: context.teamId,
        projectId: projectByName.get("Alder Forecast Sprint")!.id,
        assignedId: context.userId,
        description: "Forecast model cleanup and commentary.",
        date: dateOnly(subDays(context.today, 5)),
        duration: 10800,
        rate: 110,
        currency: context.currency,
        billed: true,
      },
      {
        id:
          existingEntryByKey.get(
            `${dateOnly(subDays(context.today, 3))}::Invoice follow-up and collections review.::${projectByName.get("Internal Operating Cadence")!.id}`,
          )?.id ??
          convexSeedId(context, "entry:ops-invoicing"),
        teamId: context.teamId,
        projectId: projectByName.get("Internal Operating Cadence")!.id,
        assignedId: context.userId,
        description: "Invoice follow-up and collections review.",
        date: dateOnly(subDays(context.today, 3)),
        duration: 3600,
        rate: null,
        currency: context.currency,
        billed: false,
      },
      {
        id:
          existingEntryByKey.get(
            `${dateOnly(subDays(context.today, 1))}::Q2 planning and KPI review.::${projectByName.get("Internal Operating Cadence")!.id}`,
          )?.id ??
          convexSeedId(context, "entry:ops-planning"),
        teamId: context.teamId,
        projectId: projectByName.get("Internal Operating Cadence")!.id,
        assignedId: context.userId,
        description: "Q2 planning and KPI review.",
        date: dateOnly(subDays(context.today, 1)),
        duration: 4500,
        rate: null,
        currency: context.currency,
        billed: false,
      },
    ],
  });

  const q2FocusTagId = tagsByName.get("Q2 Focus")?.id;
  if (q2FocusTagId) {
    await replaceTrackerProjectTagsInConvex({
      teamId: context.teamId,
      trackerProjectId: projectByName.get("Orbit Retainer Refresh")!.id,
      tagIds: [q2FocusTagId],
    });
    await replaceTrackerProjectTagsInConvex({
      teamId: context.teamId,
      trackerProjectId: projectByName.get("Alder Forecast Sprint")!.id,
      tagIds: [q2FocusTagId],
    });
  }

  return projects;
}

/**
 * HMRC Developer Hub sandbox test user — values as issued for Marlowe Walker.
 * Password must not be stored in the repo; use HMRC / team secrets only.
 * `legalEntityType` stays `uk_ltd` because app/API enums only allow that value today.
 */
const HMRC_SANDBOX_MARLOWE = {
  hmrcUserId: "843689232556",
  email: "marlowe.walker@example.com",
  vatRegistrationDate: "2009-03-05",
  selfAssessmentUtr: "2288403582",
  vrn: "170177965",
  eori: "GB242836484927",
  nino: "WM737740D",
  mtdIncomeTaxId: "XFIT00444997560",
  groupIdentifier: "697699197204",
  fullName: "Marlowe Walker",
  firstName: "Marlowe",
  lastName: "Walker",
  dateOfBirth: "1992-03-01",
  addressLine1: "20 Tower Hill",
  addressLine2: "Folkstone",
  postcode: "TS13 1PA",
} as const;

async function seedCompliance(context: SeedContext) {
  const filingProfile = await upsertFilingProfileInConvex({
    id: seedId(context, "filing-profile:vat"),
    teamId: context.teamId,
    provider: "hmrc",
    legalEntityType: "uk_ltd",
    enabled: true,
    countryCode: "GB",
    companyName: HMRC_SANDBOX_MARLOWE.fullName,
    companyNumber: null,
    utr: HMRC_SANDBOX_MARLOWE.selfAssessmentUtr,
    vrn: HMRC_SANDBOX_MARLOWE.vrn,
    vatScheme: "standard",
    accountingBasis: "accrual",
    filingMode: "manual",
    yearEndMonth: 3,
    yearEndDay: 31,
    baseCurrency: context.currency,
    signingDirectorName: HMRC_SANDBOX_MARLOWE.fullName,
    directors: [HMRC_SANDBOX_MARLOWE.fullName],
  });

  const obligation = await upsertVatObligationInConvex({
    id: seedId(context, "vat-obligation:q1-2026"),
    teamId: context.teamId,
    filingProfileId: filingProfile.id,
    provider: "hmrc",
    obligationType: "vat",
    periodKey: "26A1",
    periodStart: "2026-01-01T00:00:00.000Z",
    periodEnd: "2026-03-31T23:59:59.999Z",
    dueDate: "2026-05-07T00:00:00.000Z",
    status: "fulfilled",
    externalId: "seed-hmrc-obligation-q1",
    raw: {
      seedKey: "vat-obligation-q1",
      hmrcSandboxTestUser: {
        ...HMRC_SANDBOX_MARLOWE,
        individual: {
          firstName: HMRC_SANDBOX_MARLOWE.firstName,
          lastName: HMRC_SANDBOX_MARLOWE.lastName,
          dateOfBirth: HMRC_SANDBOX_MARLOWE.dateOfBirth,
          address: {
            line1: HMRC_SANDBOX_MARLOWE.addressLine1,
            line2: HMRC_SANDBOX_MARLOWE.addressLine2,
            postcode: HMRC_SANDBOX_MARLOWE.postcode,
          },
        },
      },
    },
  });

  const vatReturn = await upsertVatReturnInConvex({
    id: seedId(context, "vat-return:q1-2026"),
    teamId: context.teamId,
    filingProfileId: filingProfile.id,
    obligationId: obligation.id,
    periodKey: "26A1",
    periodStart: "2026-01-01T00:00:00.000Z",
    periodEnd: "2026-03-31T23:59:59.999Z",
    status: "submitted",
    currency: context.currency,
    netVatDue: 1860,
    submittedAt: asIso(subDays(context.today, 5)),
    externalSubmissionId: "seed-hmrc-submission-q1",
    declarationAccepted: true,
    lines: [
      { code: "box1", label: "VAT due on sales", amount: 2100 },
      { code: "box2", label: "VAT due on acquisitions", amount: 0 },
      { code: "box3", label: "Total VAT due", amount: 2100 },
      { code: "box4", label: "VAT reclaimed on purchases", amount: 240 },
      { code: "box5", label: "Net VAT due", amount: 1860 },
      { code: "box6", label: "Total sales", amount: 18350 },
      { code: "box7", label: "Total purchases", amount: 6120 },
      { code: "box8", label: "Total dispatches", amount: 0 },
      { code: "box9", label: "Total acquisitions", amount: 0 },
    ],
  });

  const adjustments = await createMissingComplianceAdjustments(context, filingProfile.id, obligation.id, vatReturn.id);

  return {
    filingProfile,
    obligation,
    vatReturn,
    adjustments,
  };
}

async function createMissingComplianceAdjustments(
  context: SeedContext,
  filingProfileId: string,
  obligationId: string,
  vatReturnId: string,
) {
  const adjustments = [
    {
      id: seedId(context, "compliance-adjustment:box1"),
      lineCode: "box1" as const,
      amount: 120,
      reason: "Late supplier invoice posted after draft was prepared",
      note: "Seeded VAT sales-side adjustment.",
      createdBy: context.userId,
    },
    {
      id: seedId(context, "compliance-adjustment:box4"),
      lineCode: "box4" as const,
      amount: -35,
      reason: "Corrected non-recoverable VAT on travel",
      note: "Seeded purchase-side adjustment.",
      createdBy: context.userId,
    },
  ];

  const created = [];
  const existingAdjustments = await getComplianceAdjustmentsForPeriodFromConvex({
    teamId: context.teamId,
    filingProfileId,
    periodStart: "2026-01-01T00:00:00.000Z",
    periodEnd: "2026-03-31T23:59:59.999Z",
  });

  for (const adjustment of adjustments) {
    if (existingAdjustments.some((item) => item.id === adjustment.id)) {
      continue;
    }

    created.push(
      await createComplianceAdjustmentInConvex({
        id: adjustment.id,
        teamId: context.teamId,
        filingProfileId,
        vatReturnId,
        obligationId,
        effectiveDate: "2026-03-31T00:00:00.000Z",
        lineCode: adjustment.lineCode,
        amount: adjustment.amount,
        reason: adjustment.reason,
        note: adjustment.note,
        createdBy: adjustment.createdBy,
        meta: { seedKey: adjustment.id },
      }),
    );
  }

  return created;
}

async function seedInsight(
  context: SeedContext,
  invoices: Awaited<ReturnType<typeof seedInvoices>>,
  projects: TrackerProjectRecord[],
) {
  const periodStart = startOfWeek(subDays(context.today, 7), {
    weekStartsOn: 1,
  });
  const periodEnd = endOfWeek(subDays(context.today, 7), { weekStartsOn: 1 });
  const periodYear = getISOWeekYear(periodStart);
  const periodNumber = getISOWeek(periodStart);

  let insight =
    (await getInsightByPeriod(db, {
      teamId: context.teamId,
      periodType: "weekly",
      periodYear,
      periodNumber,
    })) ??
    null;

  if (!insight) {
    const created = await createInsightInConvex({
      teamId: context.teamId,
      periodType: "weekly",
      periodStart: asIso(periodStart),
      periodEnd: asIso(periodEnd),
      periodYear,
      periodNumber,
      currency: context.currency,
    });

    insight = created
      ? await getInsightByIdFromConvex({
          teamId: context.teamId,
          id: created.id,
        })
      : null;
  }

  if (!insight) {
    throw new Error("Failed to create or resolve the seeded weekly insight.");
  }

  await updateInsightInConvex({
    teamId: context.teamId,
    id: insight.id,
    status: "completed",
    title: "Revenue accelerated while cash reserves and retained work both grew",
    selectedMetrics: [
      {
        type: "revenue",
        label: "Revenue",
        value: 31850,
        previousValue: 24600,
        change: 29.5,
        changeDirection: "up",
      },
      {
        type: "expenses",
        label: "Expenses",
        value: 10940,
        previousValue: 9180,
        change: 19.2,
        changeDirection: "up",
      },
      {
        type: "net_profit",
        label: "Net profit",
        value: 20910,
        previousValue: 15420,
        change: 35.6,
        changeDirection: "up",
      },
      {
        type: "hours_tracked",
        label: "Hours tracked",
        value: 42.5,
        previousValue: 35,
        change: 21.4,
        changeDirection: "up",
        unit: "hours",
      },
    ],
    allMetrics: {
      revenue: {
        type: "revenue",
        label: "Revenue",
        value: 31850,
        previousValue: 24600,
        change: 29.5,
        changeDirection: "up",
      },
      expenses: {
        type: "expenses",
        label: "Expenses",
        value: 10940,
        previousValue: 9180,
        change: 19.2,
        changeDirection: "up",
      },
      net_profit: {
        type: "net_profit",
        label: "Net profit",
        value: 20910,
        previousValue: 15420,
        change: 35.6,
        changeDirection: "up",
      },
      runway_months: {
        type: "runway_months",
        label: "Runway",
        value: 16.8,
        previousValue: 14.1,
        change: 19.1,
        changeDirection: "up",
      },
      hours_tracked: {
        type: "hours_tracked",
        label: "Hours tracked",
        value: 42.5,
        previousValue: 35,
        change: 21.4,
        changeDirection: "up",
        unit: "hours",
      },
    },
    anomalies: [
      {
        type: "overdue_invoice",
        severity: "warning",
        message: "Northwind Studio is now 10 days overdue on invoice INV-2026-002.",
        metricType: "revenue",
      },
    ],
    expenseAnomalies: [
      {
        type: "category_spike",
        severity: "info",
        categoryName: "Marketing",
        categorySlug: "marketing",
        currentAmount: 2140,
        previousAmount: 920,
        change: 132.6,
        currency: context.currency,
        message: "Marketing spend more than doubled week over week as paid search and paid social ramped.",
        tip: "Review CAC and pipeline quality before carrying the same spend into April.",
      },
    ],
    milestones: [
      {
        type: "recurring_revenue",
        description: "Orbit Labs and Alder both cleared larger retained work this cycle.",
        achievedAt: asIso(subDays(context.today, 2)),
      },
    ],
    activity: {
      invoicesSent: 5,
      invoicesPaid: 3,
      invoicesOverdue: 1,
      overdueAmount: invoices.overdueInvoice.amount ?? 0,
      hoursTracked: 42.5,
      largestPayment: {
        customer: "Orbit Labs",
        amount: invoices.paidInvoice.amount ?? 0,
      },
      newCustomers: 1,
      receiptsMatched: 4,
      transactionsCategorized: 28,
      upcomingInvoices: {
        count: 3,
        totalAmount:
          (invoices.unpaidInvoice.amount ?? 0) +
          (invoices.scheduledInvoice.amount ?? 0) +
          (invoices.extraInvoices[2]?.amount ?? 0),
        nextDueDate: invoices.unpaidInvoice.dueDate,
        items: [
          {
            customerName: "Alder Analytics",
            amount: invoices.unpaidInvoice.amount ?? 0,
            scheduledAt: invoices.unpaidInvoice.sentAt ?? "",
          },
          {
            customerName: "Orbit Labs",
            amount: invoices.extraInvoices[2]?.amount ?? 0,
            scheduledAt: invoices.extraInvoices[2]?.sentAt ?? "",
          },
          {
            customerName: "Orbit Labs",
            amount: invoices.scheduledInvoice.amount ?? 0,
            scheduledAt: invoices.scheduledInvoice.scheduledAt ?? "",
            frequency: "monthly_date",
          },
        ],
      },
    },
    content: {
      title: "Revenue accelerated while cash reserves and retained work both grew",
      summary:
        "Retainer cash landed from Orbit, Alder, and Seabright, lifting revenue meaningfully while reserves stayed strong despite a heavier paid acquisition push.",
      story:
        "Orbit Labs continues to anchor cash flow, while Alder and Seabright add useful project revenue on top. Expenses are now large enough to model a real operating business: contractor spend, workspace costs, software, and paid acquisition all moved this cycle. The main drag is still Northwind follow-up plus checking whether the recent marketing burst is converting into qualified pipeline.",
      actions: [
        {
          text: "Review Northwind invoice follow-up",
          type: "open_invoice",
          entityType: "invoice",
          entityId: invoices.overdueInvoice.id,
        },
        {
          text: "Open Orbit retainer project",
          type: "open_project",
          entityType: "project",
          entityId: projects[0]?.id,
        },
      ],
    },
    predictions: {
      invoicesDue: {
        count: 3,
        totalAmount:
          (invoices.unpaidInvoice.amount ?? 0) +
          (invoices.scheduledInvoice.amount ?? 0) +
          (invoices.extraInvoices[2]?.amount ?? 0),
        currency: context.currency,
      },
      notes: [
        "If Northwind settles this week, cash conversion improves further without cutting spend.",
        "Recurring Orbit revenue remains the strongest signal for next month's baseline, with Alder providing upside on project work.",
      ],
    },
    generatedAt: asIso(context.today),
  });

  return await getInsightByIdFromConvex({
    teamId: context.teamId,
    id: insight.id,
  });
}

async function seedNotificationSettings(context: SeedContext) {
  await bulkUpsertNotificationSettingsInConvex({
    teamId: context.teamId,
    userId: context.userId,
    updates: [
      { notificationType: "invoice_created", channel: "in_app", enabled: true },
      { notificationType: "invoice_created", channel: "email", enabled: true },
      { notificationType: "inbox_new", channel: "in_app", enabled: true },
      { notificationType: "insight_ready", channel: "in_app", enabled: true },
      { notificationType: "insight_ready", channel: "email", enabled: true },
    ],
  });
}

async function seedActivities(
  context: SeedContext,
  insightId: string,
  overdueInvoice: SeedInvoice,
  inboxItemId: string,
) {
  const existing = await getActivitiesFromConvex({
    teamId: context.teamId,
    userId: context.userId,
    pageSize: 100,
  });
  const seenSeedKeys = new Set(
    existing.data
      .map((activity) => metadataSeedKey(activity.metadata))
      .filter((value): value is string => value !== null),
  );

  const activitySpecs = [
    {
      seedKey: "seed-activity-invoice-created",
      type: "invoice_created",
        priority: 2,
        metadata: {
          seedKey: "seed-activity-invoice-created",
          recordId: overdueInvoice.id,
          customerName: "Northwind Studio",
          amount: overdueInvoice.amount ?? 0,
        },
      },
    {
      seedKey: "seed-activity-inbox-new",
      type: "inbox_new",
      priority: 2,
      metadata: {
        seedKey: "seed-activity-inbox-new",
        recordId: inboxItemId,
        count: 1,
        sourceType: "email",
        provider: "gmail",
      },
    },
    {
      seedKey: "seed-activity-insight-ready",
      type: "insight_ready",
      priority: 3,
      metadata: {
        seedKey: "seed-activity-insight-ready",
        recordId: insightId,
        periodLabel: `Week ${getISOWeek(subDays(context.today, 7))}, ${getISOWeekYear(
          subDays(context.today, 7),
        )}`,
      },
    },
  ] as const;

  for (const spec of activitySpecs) {
    if (seenSeedKeys.has(spec.seedKey)) {
      continue;
    }

    await createActivityInConvex({
      teamId: context.teamId,
      userId: context.userId,
      type: spec.type,
      source: "system",
      status: "unread",
      priority: spec.priority,
      metadata: spec.metadata,
    });
  }
}

async function main() {
  const context = await resolveTargetContext();
  const categories = await seedTransactionCategories(context);
  const tagsByName = await seedTags(context);
  const customers = await seedCustomers(context);
  await seedCustomerTags(context, customers, tagsByName);
  const bankAccounts = await seedBanking(context);
  const transactions = await seedTransactions(context, bankAccounts, customers);
  await seedTransactionTags(context, transactions, tagsByName);
  const documentSeed = await seedDocuments(context);
  const inboxItems = await seedInbox(context, transactions);
  const { products, template, templateData } = await seedInvoiceSetup(context);
  const invoices = await seedInvoices(context, customers, products, template, templateData);
  const recurring = await seedRecurringInvoice(
    context,
    customers.find((customer) => customer.name === "Orbit Labs")!,
    invoices,
    templateData,
    template.id,
  );
  const projects = await seedTracker(context, customers, tagsByName);
  const compliance = await seedCompliance(context);
  const insight = await seedInsight(context, invoices, projects);
  await seedNotificationSettings(context);
  const contractRenewalInboxItem =
    inboxItems.find((item) => item.referenceId === "seed-ref-contract-renewal") ??
    null;
  await seedActivities(
    context,
    insight!.id,
    invoices.overdueInvoice,
    contractRenewalInboxItem?.id ?? "",
  );

  const [
    allCustomers,
    allTransactions,
    allDocuments,
    allInboxAccounts,
    allInboxItems,
    allProducts,
    allTemplates,
    allCategories,
    allInsights,
    allBankAccounts,
    allVatObligations,
    allRecurring,
    allActivities,
  ] = await Promise.all([
    getCustomersFromConvex({ teamId: context.teamId }),
    getTransactionsFromConvex({ teamId: context.teamId, limit: 200 }),
    getDocumentsFromConvex({ teamId: context.teamId }),
    getInboxAccountsFromConvex({ teamId: context.teamId }),
    getInboxItemsFromConvex({ teamId: context.teamId }),
    getInvoiceProductsFromConvex({
      teamId: context.teamId,
      includeInactive: true,
      limit: 50,
    }),
    getInvoiceTemplatesFromConvex({ teamId: context.teamId }),
    getTransactionCategoriesFromConvex({ teamId: context.teamId }),
    listInsightsFromConvex({ teamId: context.teamId }),
    getBankAccountsFromConvex({ teamId: context.teamId }),
    listVatObligationsFromConvex({ teamId: context.teamId }),
    getInvoiceRecurringById(db, {
      id: seedId(context, "recurring:orbit-retainer"),
      teamId: context.teamId,
    }),
    getActivitiesFromConvex({
      teamId: context.teamId,
      userId: context.userId,
      pageSize: 100,
    }),
  ]);

  const invoicesList = await getInvoices(db, {
    teamId: context.teamId,
    pageSize: 50,
  });

  console.log(
    JSON.stringify(
      {
        target: {
          teamId: context.teamId,
          teamName: context.teamName,
          ownerUserId: context.userId,
          ownerEmail: context.owner.user.email,
          selectedVia: {
            teamIdArg: argValue("--team-id"),
            userEmailArg: argValue("--user-email"),
          },
        },
        seeded: {
          customerIds: customers.map((customer) => customer.id),
          invoiceIds: [
            invoices.paidInvoice.id,
            invoices.overdueInvoice.id,
            invoices.unpaidInvoice.id,
            invoices.draftInvoice.id,
            invoices.scheduledInvoice.id,
            ...invoices.extraInvoices.map((invoice) => invoice.id),
          ],
          trackerProjectIds: projects.map((project) => project.id),
          insightId: insight?.id ?? null,
          recurringId: recurring?.id ?? null,
          filingProfileId: compliance.filingProfile.id,
          vatReturnId: compliance.vatReturn.id,
        },
        totals: {
          customers: allCustomers.length,
          bankAccounts: allBankAccounts.length,
          transactions: allTransactions.length,
          transactionCategories: allCategories.length,
          invoiceProducts: allProducts.length,
          invoiceTemplates: allTemplates.length,
          invoices: invoicesList.data.length,
          inboxAccounts: allInboxAccounts.length,
          inboxItems: allInboxItems.length,
          documents: allDocuments.length,
          insights: allInsights.length,
          obligations: allVatObligations.length,
          recurringSeries: allRecurring ? 1 : 0,
          activities: allActivities.data.length,
        },
      },
      null,
      2,
    ),
  );
}

await main();
