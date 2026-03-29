import { UTCDate } from "@date-fns/utc";
import {
  getInvoiceTemplate,
  getTeamById,
  getUserByConvexId,
} from "@tamias/app-data/queries";
import {
  allocateNextInvoiceNumber,
  draftInvoice,
  getCustomerById,
  getNextInvoiceNumber,
  getTrackerProjectById,
  getTrackerRecordsByRange,
} from "@tamias/app-data/queries";
import { transformCustomerToContent } from "@tamias/invoice/utils";
import { TRPCError } from "@trpc/server";
import { addDays, format, parseISO } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { protectedProcedure } from "../init";
import { defaultTemplate, requireConvexUserId } from "./invoice-shared";

export const invoiceDefaultProcedures = {
  createFromTracker: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        dateFrom: z.string(),
        dateTo: z.string(),
      }),
    )
    .mutation(async ({ ctx: { db, teamId, session }, input }) => {
      const { projectId, dateFrom, dateTo } = input;
      const convexUserId = requireConvexUserId(session);

      const [projectData, trackerData] = await Promise.all([
        getTrackerProjectById(db, { id: projectId, teamId: teamId! }),
        getTrackerRecordsByRange(db, {
          teamId: teamId!,
          projectId,
          from: dateFrom,
          to: dateTo,
        }),
      ]);

      if (!projectData) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "PROJECT_NOT_FOUND",
        });
      }

      if (!projectData.billable) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "PROJECT_NOT_BILLABLE",
        });
      }

      if (!projectData.rate || projectData.rate <= 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "PROJECT_NO_RATE",
        });
      }

      const allEntries = Object.values(trackerData.result || {}).flat();
      const totalDuration = allEntries.reduce(
        (sum, entry) => sum + (entry.duration || 0),
        0,
      );
      const totalHours = Math.round((totalDuration / 3600) * 100) / 100;

      if (totalHours === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "NO_TRACKED_HOURS",
        });
      }

      const [nextInvoiceNumber, template, team, fullCustomer, user] =
        await Promise.all([
          allocateNextInvoiceNumber(db, teamId!),
          getInvoiceTemplate(teamId!),
          getTeamById(db, teamId!),
          projectData.customerId
            ? getCustomerById(db, {
                id: projectData.customerId,
                teamId: teamId!,
              })
            : null,
          getUserByConvexId(db, convexUserId),
        ]);

      const invoiceId = uuidv4();
      const currency = projectData.currency || team?.baseCurrency || "USD";
      const amount = totalHours * Number(projectData.rate);
      const userDateFormat =
        template?.dateFormat ?? user?.dateFormat ?? defaultTemplate.dateFormat;
      const formattedDateFrom = format(parseISO(dateFrom), userDateFormat);
      const formattedDateTo = format(parseISO(dateTo), userDateFormat);
      const dateRangeDescription = `${projectData.name} (${formattedDateFrom} - ${formattedDateTo})`;

      const templateData = {
        ...defaultTemplate,
        currency: currency.toUpperCase(),
        ...(template
          ? Object.fromEntries(
              Object.entries(template).map(([key, value]) => [
                key,
                value === null ? undefined : value,
              ]),
            )
          : {}),
        size: (template?.size === "a4" || template?.size === "letter"
          ? template.size
          : defaultTemplate.size) as "a4" | "letter",
        deliveryType: (template?.deliveryType === "create" ||
        template?.deliveryType === "create_and_send"
          ? template.deliveryType
          : defaultTemplate.deliveryType) as
          | "create"
          | "create_and_send"
          | undefined,
      };

      return draftInvoice(db, {
        id: invoiceId,
        teamId: teamId!,
        userId: convexUserId,
        customerId: projectData.customerId,
        customerName: fullCustomer?.name,
        invoiceNumber: nextInvoiceNumber,
        amount,
        lineItems: [
          {
            name: dateRangeDescription,
            quantity: totalHours,
            price: Number(projectData.rate),
            vat: 0,
          },
        ],
        issueDate: new Date().toISOString(),
        dueDate: addDays(
          new Date(),
          template?.paymentTermsDays ?? 30,
        ).toISOString(),
        template: templateData,
        fromDetails: (template?.fromDetails || null) as string | null,
        paymentDetails: (template?.paymentDetails || null) as string | null,
        customerDetails: fullCustomer
          ? JSON.stringify(transformCustomerToContent(fullCustomer))
          : null,
        noteDetails: null,
        topBlock: null,
        bottomBlock: null,
        vat: null,
        tax: null,
        discount: null,
        subtotal: null,
      });
    }),

  defaultSettings: protectedProcedure.query(
    async ({ ctx: { db, teamId, session, geo } }) => {
      const convexUserId = requireConvexUserId(session);

      const [nextInvoiceNumber, template, team, user] = await Promise.all([
        getNextInvoiceNumber(db, teamId!),
        getInvoiceTemplate(teamId!),
        getTeamById(db, teamId!),
        getUserByConvexId(db, convexUserId),
      ]);

      const locale = user?.locale ?? geo?.locale ?? "en";
      const timezone = user?.timezone ?? geo?.timezone ?? "America/New_York";
      const currency =
        template?.currency ?? team?.baseCurrency ?? defaultTemplate.currency;
      const dateFormat =
        template?.dateFormat ?? user?.dateFormat ?? defaultTemplate.dateFormat;
      const logoUrl = template?.logoUrl ?? defaultTemplate.logoUrl;
      const countryCode = geo?.country ?? "US";
      const size = ["US", "CA"].includes(countryCode) ? "letter" : "a4";
      const includeTax = ["US", "CA", "AU", "NZ", "SG", "MY", "IN"].includes(
        countryCode,
      );

      const savedTemplate = {
        id: template?.id,
        name: template?.name ?? "Default",
        isDefault: template?.isDefault ?? true,
        title: template?.title ?? defaultTemplate.title,
        logoUrl,
        currency,
        size: template?.size ?? defaultTemplate.size,
        includeTax: template?.includeTax ?? includeTax,
        includeVat: template?.includeVat ?? !includeTax,
        includeDiscount:
          template?.includeDiscount ?? defaultTemplate.includeDiscount,
        includeDecimals:
          template?.includeDecimals ?? defaultTemplate.includeDecimals,
        includeUnits: template?.includeUnits ?? defaultTemplate.includeUnits,
        includeQr: template?.includeQr ?? defaultTemplate.includeQr,
        includeLineItemTax:
          template?.includeLineItemTax ?? defaultTemplate.includeLineItemTax,
        lineItemTaxLabel:
          template?.lineItemTaxLabel ?? defaultTemplate.lineItemTaxLabel,
        includePdf: template?.includePdf ?? defaultTemplate.includePdf,
        sendCopy: template?.sendCopy ?? defaultTemplate.sendCopy,
        customerLabel: template?.customerLabel ?? defaultTemplate.customerLabel,
        fromLabel: template?.fromLabel ?? defaultTemplate.fromLabel,
        invoiceNoLabel:
          template?.invoiceNoLabel ?? defaultTemplate.invoiceNoLabel,
        subtotalLabel: template?.subtotalLabel ?? defaultTemplate.subtotalLabel,
        issueDateLabel:
          template?.issueDateLabel ?? defaultTemplate.issueDateLabel,
        totalSummaryLabel:
          template?.totalSummaryLabel ?? defaultTemplate.totalSummaryLabel,
        dueDateLabel: template?.dueDateLabel ?? defaultTemplate.dueDateLabel,
        discountLabel: template?.discountLabel ?? defaultTemplate.discountLabel,
        descriptionLabel:
          template?.descriptionLabel ?? defaultTemplate.descriptionLabel,
        priceLabel: template?.priceLabel ?? defaultTemplate.priceLabel,
        quantityLabel: template?.quantityLabel ?? defaultTemplate.quantityLabel,
        totalLabel: template?.totalLabel ?? defaultTemplate.totalLabel,
        vatLabel: template?.vatLabel ?? defaultTemplate.vatLabel,
        taxLabel: template?.taxLabel ?? defaultTemplate.taxLabel,
        paymentLabel: template?.paymentLabel ?? defaultTemplate.paymentLabel,
        noteLabel: template?.noteLabel ?? defaultTemplate.noteLabel,
        dateFormat,
        deliveryType: template?.deliveryType ?? defaultTemplate.deliveryType,
        taxRate: template?.taxRate ?? defaultTemplate.taxRate,
        vatRate: template?.vatRate ?? defaultTemplate.vatRate,
        fromDetails: template?.fromDetails ?? defaultTemplate.fromDetails,
        paymentDetails:
          template?.paymentDetails ?? defaultTemplate.paymentDetails,
        noteDetails: template?.noteDetails ?? defaultTemplate.noteDetails,
        timezone,
        locale,
        paymentEnabled:
          template?.paymentEnabled ?? defaultTemplate.paymentEnabled,
        paymentTermsDays: template?.paymentTermsDays ?? 30,
        emailSubject: template?.emailSubject ?? null,
        emailHeading: template?.emailHeading ?? null,
        emailBody: template?.emailBody ?? null,
        emailButtonText: template?.emailButtonText ?? null,
      };

      const paymentTermsDays = savedTemplate.paymentTermsDays ?? 30;

      return {
        id: uuidv4(),
        currency,
        status: "draft",
        size,
        includeTax: savedTemplate.includeTax ?? includeTax,
        includeVat: savedTemplate.includeVat ?? !includeTax,
        includeDiscount: false,
        includeDecimals: false,
        includePdf: false,
        sendCopy: false,
        includeUnits: false,
        includeQr: true,
        invoiceNumber: nextInvoiceNumber,
        timezone,
        locale,
        fromDetails: savedTemplate.fromDetails,
        paymentDetails: savedTemplate.paymentDetails,
        customerDetails: undefined,
        noteDetails: savedTemplate.noteDetails,
        customerId: undefined,
        issueDate: new UTCDate().toISOString(),
        dueDate: addDays(new UTCDate(), paymentTermsDays).toISOString(),
        lineItems: [{ name: "", quantity: 0, price: 0, vat: 0 }],
        tax: undefined,
        token: undefined,
        discount: undefined,
        subtotal: undefined,
        topBlock: undefined,
        bottomBlock: undefined,
        amount: undefined,
        customerName: undefined,
        logoUrl: undefined,
        vat: undefined,
        template: savedTemplate,
      };
    },
  ),
};
