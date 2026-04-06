"use client";

import { getRouteApi } from "@tanstack/react-router";
import { HtmlTemplate } from "@tamias/invoice/templates/html";
import { InvoiceViewWrapper } from "@/components/invoice-view-wrapper";
import { NotFoundPage } from "@/start/components/not-found-page";
import type { PublicInvoiceLoaderData } from "./$token";

const routeApi = getRouteApi("/i/$token");

export function PublicInvoicePage() {
  const loaderData = routeApi.useLoaderData() as PublicInvoiceLoaderData;

  if (loaderData.status !== "ok") {
    return <NotFoundPage />;
  }

  const { invoice, width, height, paymentEnabled } = loaderData;

  return (
    <>
      <InvoiceViewWrapper
        token={invoice.token}
        invoiceNumber={invoice.invoiceNumber || "invoice"}
        paymentEnabled={paymentEnabled}
        amount={invoice.amount ?? undefined}
        currency={invoice.currency ?? undefined}
        initialStatus={invoice.status}
        customerName={invoice.customerName || (invoice.customer?.name as string)}
        customerWebsite={invoice.customer?.website}
        customerPortalEnabled={invoice.customer?.portalEnabled ?? false}
        customerPortalId={invoice.customer?.portalId ?? undefined}
        invoiceWidth={width}
      >
        <div className="pb-24 md:pb-0">
          <div className="shadow-[0_24px_48px_-12px_rgba(0,0,0,0.3)] dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.6)]">
            <HtmlTemplate data={invoice} width={width} height={height} />
          </div>
        </div>
      </InvoiceViewWrapper>

      <div className="fixed bottom-4 right-4 z-10">
        <a
          href="https://tamias.xyz?utm_source=invoice"
          target="_blank"
          rel="noreferrer"
          className="text-[9px] text-[#878787]"
        >
          Powered by <span className="text-primary">tamias</span>
        </a>
      </div>
    </>
  );
}
