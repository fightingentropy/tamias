import { HtmlTemplate } from "@tamias/invoice/templates/html";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getAppUrl } from "@tamias/utils/envs";
import { InvoiceViewWrapper } from "@/components/invoice-view-wrapper";
import { NotFoundPage } from "@/start/components/not-found-page";

const appUrl = getAppUrl();

const loadPublicInvoice = createServerFn({ method: "GET" })
  .inputValidator((data: { token: string; viewer?: string | null }) => data)
  .handler(async ({ data }) => {
    const { buildPublicInvoicePageData } = await import("@/start/server/route-data");
    return (await buildPublicInvoicePageData({
      token: data.token,
      viewer: data.viewer ?? undefined,
    })) as any;
  });

export const Route = createFileRoute("/i/$token")({
  loader: ({ params, location }) => {
    const url = new URL(location.href, "http://localhost");
    return loadPublicInvoice({
      data: {
        token: params.token,
        viewer: url.searchParams.get("viewer"),
      },
    });
  },
  head: ({ loaderData }) => {
    const data = loaderData as Awaited<
      ReturnType<typeof loadPublicInvoice>
    > | null | undefined;

    if (!data || data.status !== "ok") {
      return {
        meta: [
          { title: "Page not found" },
          { name: "robots", content: "noindex,nofollow" },
        ],
      };
    }

    const imageUrl = `${appUrl}/i/${data.invoice.token}/opengraph-image`;

    return {
      meta: [
        { title: data.metadata.title },
        {
          name: "description",
          content: data.metadata.description,
        },
        { name: "robots", content: "noindex,nofollow" },
        { property: "og:title", content: data.metadata.title },
        {
          property: "og:description",
          content: data.metadata.description,
        },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${appUrl}/i/${data.invoice.token}` },
        { property: "og:image", content: imageUrl },
        { name: "twitter:card", content: "summary" },
        { name: "twitter:title", content: data.metadata.title },
        { name: "twitter:description", content: data.metadata.description },
        { name: "twitter:image", content: imageUrl },
      ],
    };
  },
  component: PublicInvoicePage,
});

function PublicInvoicePage() {
  const loaderData = Route.useLoaderData() as Awaited<
    ReturnType<typeof loadPublicInvoice>
  >;

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
        customerName={
          invoice.customerName || (invoice.customer?.name as string)
        }
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

      <div className="fixed bottom-4 right-4 hidden md:block">
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
