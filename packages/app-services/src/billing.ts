import { getPlanIntervalByProductId } from "@tamias/plans";

type BillingApi = InstanceType<(typeof import("@polar-sh/sdk"))["Polar"]>;

let billingApiPromise: Promise<BillingApi> | null = null;

async function getBillingApi(): Promise<BillingApi> {
  if (!billingApiPromise) {
    billingApiPromise = import("@polar-sh/sdk").then(({ Polar }) => {
      return new Polar({
        accessToken: process.env.POLAR_ACCESS_TOKEN!,
        server: process.env.POLAR_ENVIRONMENT as "production" | "sandbox",
      });
    });
  }

  return billingApiPromise;
}

export type BillingOrdersPage = {
  data: Array<{
    id: string;
    createdAt: Date;
    amount: {
      amount: number;
      currency: string;
    };
    status: string;
    product: {
      name: string;
    };
    invoiceId: string | null;
  }>;
  meta: {
    hasNextPage: boolean;
    cursor: string | undefined;
  };
};

export type ActiveBillingSubscription = {
  isYearly: boolean;
};

function getOrderPageNumber(cursor?: string) {
  return cursor ? Number(cursor) : 1;
}

export async function getBillingOrdersPageForTeam(args: {
  teamId: string;
  cursor?: string;
  pageSize?: number;
}): Promise<BillingOrdersPage> {
  try {
    const billingApi = await getBillingApi();
    const customer = await billingApi.customers.getExternal({
      externalId: args.teamId,
    });
    const page = getOrderPageNumber(args.cursor);
    const ordersResult = await billingApi.orders.list({
      customerId: customer.id,
      page,
      limit: args.pageSize,
    });
    const orders = ordersResult.result.items;
    const pagination = ordersResult.result.pagination;

    return {
      data: orders
        .filter((order) => order.metadata?.teamId === args.teamId)
        .map((order) => ({
          id: order.id,
          createdAt: order.createdAt,
          amount: {
            amount: order.totalAmount,
            currency: order.currency,
          },
          status: order.status,
          product: {
            name: order.product?.name || "Subscription",
          },
          invoiceId: order.isInvoiceGenerated ? order.id : null,
        })),
      meta: {
        hasNextPage: page < pagination.maxPage,
        cursor: page < pagination.maxPage ? String(page + 1) : undefined,
      },
    };
  } catch {
    return {
      data: [],
      meta: {
        hasNextPage: false,
        cursor: undefined,
      },
    };
  }
}

export async function getActiveSubscriptionForTeam(
  teamId: string,
): Promise<ActiveBillingSubscription | null> {
  try {
    const billingApi = await getBillingApi();
    const subscriptions = await billingApi.subscriptions.list({
      externalCustomerId: teamId,
    });
    const active = subscriptions.result.items.find(
      (subscription) =>
        subscription.status === "active" || subscription.status === "past_due",
    );

    if (!active) {
      return null;
    }

    const interval = getPlanIntervalByProductId(active.productId);

    return {
      isYearly: interval === "year",
    };
  } catch {
    return null;
  }
}
