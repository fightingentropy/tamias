import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getCustomerPortalDataLocally,
  getCustomerPortalInvoicesLocally,
} from "@/server/loaders/public";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";
import { PortalContent } from "./portal-content";

export async function generateMetadata(props: {
  params: Promise<{ portalId: string }>;
}): Promise<Metadata> {
  const params = await props.params;

  try {
    const data = await getCustomerPortalDataLocally(params.portalId);

    if (!data) {
      return {
        title: "Portal Not Found",
        robots: {
          index: false,
          follow: false,
        },
      };
    }

    const title = `${data.customer.name} | ${data.customer.team.name}`;
    const description = `Customer portal for ${data.customer.name}`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
      },
      twitter: {
        card: "summary_large_image",
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
      title: "Portal Not Found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }
}

type Props = {
  params: Promise<{ portalId: string }>;
};

export default async function Page(props: Props) {
  const params = await props.params;
  const queryClient = getQueryClient();
  const portalDataQuery = trpc.customers.getByPortalId.queryOptions({
    portalId: params.portalId,
  });
  const portalInvoicesQuery =
    trpc.customers.getPortalInvoices.infiniteQueryOptions(
      {
        portalId: params.portalId,
      },
      {
        getNextPageParam: ({ meta }) => meta?.cursor,
      },
    );

  const [portalData, portalInvoices] = await Promise.all([
    getCustomerPortalDataLocally(params.portalId),
    getCustomerPortalInvoicesLocally(params.portalId),
  ]);

  if (!portalData) {
    notFound();
  }

  queryClient.setQueryData(portalDataQuery.queryKey, portalData);
  queryClient.setQueryData(portalInvoicesQuery.queryKey, {
    pages: [portalInvoices],
    pageParams: [null],
  });

  return (
    <HydrateClient>
      <PortalContent portalId={params.portalId} />
    </HydrateClient>
  );
}
