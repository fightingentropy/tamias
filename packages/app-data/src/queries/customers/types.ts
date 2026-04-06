import type { CurrentUserIdentityRecord, CustomerRecord } from "@tamias/app-data-convex";

export type ConvexUserId = CurrentUserIdentityRecord["convexId"];

export type GetCustomerByIdParams = {
  id: string;
  teamId: string;
};

export type GetCustomersParams = {
  teamId: string;
  cursor?: string | null;
  pageSize?: number;
  q?: string | null;
  sort?: string[] | null;
};

export type CustomerTag = {
  id: string;
  name: string;
};

export type ProjectedCustomerInvoice = {
  id: string;
  teamId: string;
  customerId: string | null;
  amount: number | null;
  currency: string | null;
  status: string | null;
  issueDate: string | null;
  dueDate: string | null;
  token: string | null;
  createdAt: string;
};

export type CustomerListMetrics = {
  invoiceCount: number;
  totalRevenue: number;
  outstandingAmount: number;
  lastInvoiceDate: string | null;
  invoiceCurrency: string | null;
};

export type CustomerListRow = CustomerRecord &
  CustomerListMetrics & {
    projectCount: number;
    tags: CustomerTag[];
  };

export type UpsertCustomerParams = {
  id?: string;
  teamId: string;
  userId?: ConvexUserId;
  name: string;
  email: string;
  billingEmail?: string | null;
  country?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  note?: string | null;
  website?: string | null;
  phone?: string | null;
  contact?: string | null;
  vatNumber?: string | null;
  countryCode?: string | null;
  tags?: CustomerTag[] | null;
};

export type DeleteCustomerParams = {
  id: string;
  teamId: string;
};

export type GetCustomerInvoiceSummaryParams = {
  customerId: string;
  teamId: string;
};

export type ToggleCustomerPortalParams = {
  customerId: string;
  teamId: string;
  enabled: boolean;
};

export type GetCustomerByPortalIdParams = {
  portalId: string;
};

export type GetCustomerPortalInvoicesParams = {
  customerId: string;
  teamId: string;
  cursor?: string | null;
  pageSize?: number;
};
