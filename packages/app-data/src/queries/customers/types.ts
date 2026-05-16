export type CustomerRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  teamId: string;
  name: string;
  email: string;
  billingEmail: string | null;
  country: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  note: string | null;
  website: string | null;
  phone: string | null;
  vatNumber: string | null;
  countryCode: string | null;
  token: string | null;
  contact: string | null;
  status: string | null;
  preferredCurrency: string | null;
  defaultPaymentTerms: number | null;
  isArchived: boolean;
  source: string | null;
  externalId: string | null;
  logoUrl: string | null;
  description: string | null;
  industry: string | null;
  companyType: string | null;
  employeeCount: string | null;
  foundedYear: number | null;
  estimatedRevenue: string | null;
  fundingStage: string | null;
  totalFunding: string | null;
  headquartersLocation: string | null;
  timezone: string | null;
  linkedinUrl: string | null;
  twitterUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  ceoName: string | null;
  financeContact: string | null;
  financeContactEmail: string | null;
  primaryLanguage: string | null;
  fiscalYearEnd: string | null;
  enrichmentStatus: string | null;
  enrichedAt: string | null;
  portalEnabled: boolean;
  portalId: string | null;
};

export type UserId = string;

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
  userId?: UserId;
  createdAt?: string | null;
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
  token?: string | null;
  status?: string | null;
  preferredCurrency?: string | null;
  defaultPaymentTerms?: number | null;
  isArchived?: boolean | null;
  source?: string | null;
  externalId?: string | null;
  logoUrl?: string | null;
  description?: string | null;
  industry?: string | null;
  companyType?: string | null;
  employeeCount?: string | null;
  foundedYear?: number | null;
  estimatedRevenue?: string | null;
  fundingStage?: string | null;
  totalFunding?: string | null;
  headquartersLocation?: string | null;
  timezone?: string | null;
  linkedinUrl?: string | null;
  twitterUrl?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  ceoName?: string | null;
  financeContact?: string | null;
  financeContactEmail?: string | null;
  primaryLanguage?: string | null;
  fiscalYearEnd?: string | null;
  enrichmentStatus?: string | null;
  enrichedAt?: string | null;
  portalEnabled?: boolean | null;
  portalId?: string | null;
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
