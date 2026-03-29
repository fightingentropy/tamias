import { decrypt } from "@tamias/encryption";
import { HtmlTemplate } from "@tamias/invoice/templates/html";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { SearchParams } from "nuqs";
import { InvoiceViewWrapper } from "@/components/invoice-view-wrapper";
import { getInvoiceByTokenLocally } from "@/server/loaders/public";
import { getTRPCClient } from "@/trpc/server";

export async function generateMetadata(props: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const params = await props.params;

  try {
    const invoice = await getInvoiceByTokenLocally(params.token);

    if (!invoice) {
      return {
        title: "Invoice Not Found",
        robots: {
          index: false,
          follow: false,
        },
      };
    }

    const title = `Invoice ${invoice.invoiceNumber} | ${invoice.team?.name}`;
    const description = `Invoice for ${invoice.customerName || invoice.customer?.name || "Customer"}`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
      },
      twitter: {
        card: "summary",
        title,
        description,
      },
      robots: {
        index: false,
        follow: false,
      },
    };
  } catch (_error) {
    return {
      title: "Invoice Not Found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }
}

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<SearchParams>;
};

async function updateInvoiceViewedAt(token: string) {
  const client = await getTRPCClient();

  await client.invoice.markViewedByToken.mutate({ token });
}

export default async function Page(props: Props) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const viewerParam = searchParams?.viewer as string | undefined;
  const viewer = viewerParam ? decodeURIComponent(viewerParam) : undefined;
  const token = await convexAuthNextjsToken();
  const invoice = await getInvoiceByTokenLocally(params.token);

  if (!invoice) {
    notFound();
  }

  if (viewer && viewer.trim().length > 0) {
    try {
      const decryptedEmail = decrypt(viewer);

      if (decryptedEmail === invoice?.customer?.email) {
        // Only update the invoice viewed_at if the user is a viewer
        // Fire and forget - don't block the page render
        updateInvoiceViewedAt(params.token).catch(() => {});
      }
    } catch (_error) {
      // Silently fail if decryption fails - viewer might be invalid or malformed
      // This is expected when accessing the invoice without a valid viewer parameter
    }
  }

  // If the invoice is draft and the user is not logged in, return 404 or if the invoice is not found
  if (!invoice || (invoice.status === "draft" && !token)) {
    notFound();
  }

  const width = invoice.template.size === "letter" ? 750 : 595;
  const height = invoice.template.size === "letter" ? 1056 : 842;

  // Payment is only enabled if: template has it enabled AND team has Stripe connected
  const paymentEnabled =
    invoice.template.paymentEnabled && invoice.team?.stripeConnected === true;

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
