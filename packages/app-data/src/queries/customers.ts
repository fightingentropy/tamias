import {
  deleteCustomerInConvex,
  deleteCustomerTagsForCustomerInConvex,
  type CurrentUserIdentityRecord,
  getCustomerByIdFromConvex,
  getCustomerByPortalIdFromConvex,
  getCustomerTagAssignmentsForCustomerIdsFromConvex,
  getCustomersByIdsFromConvex,
  getCustomersPageFromConvex,
  getCustomersFromConvex,
  getPublicInvoicesByCustomerIdsFromConvex,
  getTagsByIdsFromConvex,
  getTrackerProjectsByCustomerIdsFromConvex,
  getTrackerProjectsFromConvex,
  replaceCustomerTagsInConvex,
  toggleCustomerPortalInConvex,
  upsertCustomerInConvex,
  type CustomerRecord,
  type CustomerTagAssignmentRecord,
} from "@tamias/app-data-convex";
import { generateToken } from "@tamias/invoice/token";
import type { Database } from "../client";
import { createActivity } from "./activities";
import {
  getExchangeRatesBatch,
  getProjectedInvoicesForTeam as getProjectedInvoicesForTeamFromAppData,
  getTeamById,
} from "./index";

type ConvexUserId = CurrentUserIdentityRecord["convexId"];
const CUSTOMER_PAGE_CURSOR_PREFIX = "customer:";

type IndexedCustomerCursorState = {
  sourceCursor: string | null;
  sourceExhausted: boolean;
  bufferedIds: string[];
};

type GetCustomerByIdParams = {
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

type ProjectedCustomerInvoice = {
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

type CustomerListMetrics = {
  invoiceCount: number;
  totalRevenue: number;
  outstandingAmount: number;
  lastInvoiceDate: string | null;
  invoiceCurrency: string | null;
};

type CustomerListRow = CustomerRecord &
  CustomerListMetrics & {
    projectCount: number;
    tags: CustomerTag[];
  };

function groupCustomerTagAssignmentsByCustomerId(
  assignments: CustomerTagAssignmentRecord[],
) {
  const assignmentsByCustomerId = new Map<
    string,
    CustomerTagAssignmentRecord[]
  >();

  for (const assignment of assignments) {
    const current = assignmentsByCustomerId.get(assignment.customerId) ?? [];
    current.push(assignment);
    assignmentsByCustomerId.set(assignment.customerId, current);
  }

  return assignmentsByCustomerId;
}

function decodeIndexedCustomerCursor(
  cursor: string | null | undefined,
): IndexedCustomerCursorState {
  if (!cursor || !cursor.startsWith(CUSTOMER_PAGE_CURSOR_PREFIX)) {
    return {
      sourceCursor: null,
      sourceExhausted: false,
      bufferedIds: [],
    };
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(
        cursor.slice(CUSTOMER_PAGE_CURSOR_PREFIX.length),
        "base64url",
      ).toString("utf8"),
    ) as Partial<IndexedCustomerCursorState>;

    return {
      sourceCursor:
        typeof parsed.sourceCursor === "string" ? parsed.sourceCursor : null,
      sourceExhausted: parsed.sourceExhausted === true,
      bufferedIds: Array.isArray(parsed.bufferedIds)
        ? parsed.bufferedIds.filter(
            (bufferedId): bufferedId is string =>
              typeof bufferedId === "string",
          )
        : [],
    };
  } catch {
    return {
      sourceCursor: null,
      sourceExhausted: false,
      bufferedIds: [],
    };
  }
}

function encodeIndexedCustomerCursor(state: IndexedCustomerCursorState) {
  return `${CUSTOMER_PAGE_CURSOR_PREFIX}${Buffer.from(
    JSON.stringify(state),
    "utf8",
  ).toString("base64url")}`;
}

async function getCustomerTagsByCustomerId(
  teamId: string,
  customerIds: string[],
) {
  if (customerIds.length === 0) {
    return new Map<string, CustomerTag[]>();
  }

  const assignments = await getCustomerTagAssignmentsForCustomerIdsFromConvex({
    teamId,
    customerIds,
  });

  if (assignments.length === 0) {
    return new Map<string, CustomerTag[]>();
  }

  const assignmentsByCustomerId =
    groupCustomerTagAssignmentsByCustomerId(assignments);
  const tagIds = [
    ...new Set(assignments.map((assignment) => assignment.tagId)),
  ];
  const tagRows = await getTagsByIdsFromConvex({
    teamId,
    tagIds,
  });
  const tagNameById = new Map(tagRows.map((tag) => [tag.id, tag.name]));
  const tagsByCustomerId = new Map<string, CustomerTag[]>();

  for (const [customerId, customerAssignments] of assignmentsByCustomerId) {
    const customerTags = customerAssignments
      .map((assignment) => {
        const name = tagNameById.get(assignment.tagId);

        if (!name) {
          return null;
        }

        return {
          id: assignment.tagId,
          name,
        };
      })
      .filter((tag): tag is CustomerTag => tag !== null)
      .sort((left, right) => left.name.localeCompare(right.name));

    tagsByCustomerId.set(customerId, customerTags);
  }

  return tagsByCustomerId;
}

async function attachCustomerTags<T extends { id: string }>(
  teamId: string,
  rows: T[],
): Promise<Array<T & { tags: CustomerTag[] }>> {
  if (rows.length === 0) {
    return [];
  }

  const tagsByCustomerId = await getCustomerTagsByCustomerId(
    teamId,
    rows.map((row) => row.id),
  );

  return rows.map((row) => ({
    ...row,
    tags: tagsByCustomerId.get(row.id) ?? [],
  }));
}

function compareCustomersByTags(
  left: { tags: CustomerTag[]; createdAt: string },
  right: { tags: CustomerTag[]; createdAt: string },
  isAscending: boolean,
) {
  const leftTag = left.tags[0]?.name;
  const rightTag = right.tags[0]?.name;

  if (!leftTag && !rightTag) {
    return right.createdAt.localeCompare(left.createdAt);
  }

  if (!leftTag) {
    return isAscending ? 1 : -1;
  }

  if (!rightTag) {
    return isAscending ? -1 : 1;
  }

  const delta = leftTag.localeCompare(rightTag);

  if (delta !== 0) {
    return isAscending ? delta : -delta;
  }

  return right.createdAt.localeCompare(left.createdAt);
}

function toProjectedCustomerInvoice(
  value: unknown,
): ProjectedCustomerInvoice | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (
    typeof record.id !== "string" ||
    typeof record.teamId !== "string" ||
    typeof record.createdAt !== "string"
  ) {
    return null;
  }

  return {
    id: record.id,
    teamId: record.teamId,
    customerId:
      typeof record.customerId === "string" ? record.customerId : null,
    amount: typeof record.amount === "number" ? record.amount : null,
    currency: typeof record.currency === "string" ? record.currency : null,
    status: typeof record.status === "string" ? record.status : null,
    issueDate: typeof record.issueDate === "string" ? record.issueDate : null,
    dueDate: typeof record.dueDate === "string" ? record.dueDate : null,
    token: typeof record.token === "string" ? record.token : null,
    createdAt: record.createdAt,
  };
}

async function getProjectedInvoicesForTeam(teamId: string) {
  return (await getProjectedInvoicesForTeamFromAppData(teamId))
    .map((record) => toProjectedCustomerInvoice(record))
    .filter(
      (record): record is ProjectedCustomerInvoice =>
        !!record && record.teamId === teamId,
    );
}

async function getProjectedInvoicesForCustomers(
  teamId: string,
  customerIds: string[],
) {
  if (customerIds.length === 0) {
    return [];
  }

  return (await getPublicInvoicesByCustomerIdsFromConvex({ teamId, customerIds }))
    .map((record) => toProjectedCustomerInvoice(record.payload))
    .filter(
      (record): record is ProjectedCustomerInvoice =>
        !!record && record.teamId === teamId,
    );
}

function buildInvoiceMetricsByCustomerId(invoices: ProjectedCustomerInvoice[]) {
  const metricsByCustomerId = new Map<string, CustomerListMetrics>();

  for (const invoice of invoices) {
    if (!invoice.customerId) {
      continue;
    }

    const current = metricsByCustomerId.get(invoice.customerId) ?? {
      invoiceCount: 0,
      totalRevenue: 0,
      outstandingAmount: 0,
      lastInvoiceDate: null,
      invoiceCurrency: null,
    };

    current.invoiceCount += 1;

    const amount = invoice.amount ?? 0;

    if (invoice.status === "paid") {
      current.totalRevenue += amount;
    } else if (invoice.status === "unpaid" || invoice.status === "overdue") {
      current.outstandingAmount += amount;
    }

    if (
      invoice.issueDate &&
      (!current.lastInvoiceDate || invoice.issueDate > current.lastInvoiceDate)
    ) {
      current.lastInvoiceDate = invoice.issueDate;
    }

    if (!current.invoiceCurrency && invoice.currency) {
      current.invoiceCurrency = invoice.currency;
    }

    metricsByCustomerId.set(invoice.customerId, current);
  }

  return metricsByCustomerId;
}

function buildProjectCountByCustomerId(
  trackerProjects: Awaited<ReturnType<typeof getTrackerProjectsFromConvex>>,
) {
  const projectCountByCustomerId = new Map<string, number>();

  for (const project of trackerProjects) {
    if (!project.customerId) {
      continue;
    }

    projectCountByCustomerId.set(
      project.customerId,
      (projectCountByCustomerId.get(project.customerId) ?? 0) + 1,
    );
  }

  return projectCountByCustomerId;
}

function matchesCustomerSearch(
  customer: CustomerRecord,
  query?: string | null,
) {
  if (!query) {
    return true;
  }

  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  return [
    customer.name,
    customer.email,
    customer.billingEmail ?? "",
    customer.contact ?? "",
    customer.phone ?? "",
    customer.website ?? "",
    customer.city ?? "",
    customer.state ?? "",
    customer.country ?? "",
    customer.industry ?? "",
  ].some((value) => value.toLowerCase().includes(normalized));
}

function compareNullableString(
  left: string | null | undefined,
  right: string | null | undefined,
  isAscending: boolean,
) {
  const leftValue = left ?? "";
  const rightValue = right ?? "";
  const delta = leftValue.localeCompare(rightValue);

  return isAscending ? delta : -delta;
}

function compareNullableNumber(
  left: number | null | undefined,
  right: number | null | undefined,
  isAscending: boolean,
) {
  const delta = (left ?? 0) - (right ?? 0);

  return isAscending ? delta : -delta;
}

function sortCustomers(data: CustomerListRow[], sort?: string[] | null) {
  const [column, direction = "desc"] = sort ?? [];
  const isAscending = direction === "asc";
  const sorted = [...data];

  sorted.sort((left, right) => {
    const delta = (() => {
      switch (column) {
        case "name":
          return compareNullableString(left.name, right.name, isAscending);
        case "created_at":
          return compareNullableString(
            left.createdAt,
            right.createdAt,
            isAscending,
          );
        case "contact":
          return compareNullableString(
            left.contact,
            right.contact,
            isAscending,
          );
        case "email":
          return compareNullableString(left.email, right.email, isAscending);
        case "invoices":
          return compareNullableNumber(
            left.invoiceCount,
            right.invoiceCount,
            isAscending,
          );
        case "industry":
          return compareNullableString(
            left.industry,
            right.industry,
            isAscending,
          );
        case "country":
          return compareNullableString(
            left.country,
            right.country,
            isAscending,
          );
        case "total_revenue":
          return compareNullableNumber(
            left.totalRevenue,
            right.totalRevenue,
            isAscending,
          );
        case "outstanding":
          return compareNullableNumber(
            left.outstandingAmount,
            right.outstandingAmount,
            isAscending,
          );
        case "last_invoice":
          return compareNullableString(
            left.lastInvoiceDate,
            right.lastInvoiceDate,
            isAscending,
          );
        case "projects":
          return compareNullableNumber(
            left.projectCount,
            right.projectCount,
            isAscending,
          );
        case "tags":
          return compareCustomersByTags(left, right, isAscending);
        default:
          return compareNullableString(left.createdAt, right.createdAt, false);
      }
    })();

    if (delta !== 0) {
      return delta;
    }

    return right.createdAt.localeCompare(left.createdAt);
  });

  return sorted;
}

function getIndexedCustomerOrder(sort: GetCustomersParams["sort"]) {
  if (!sort || sort.length === 0) {
    return "desc" as const;
  }

  if (sort.length !== 2) {
    return null;
  }

  const [column, direction] = sort;

  if (
    column !== "created_at" ||
    (direction !== "asc" && direction !== "desc")
  ) {
    return null;
  }

  return direction;
}

function canUseIndexedCustomerPage(sort?: string[] | null) {
  return getIndexedCustomerOrder(sort) !== null;
}

function getIndexedCustomerBatchSize(pageSize: number) {
  return Math.min(Math.max(pageSize * 3, 50), 200);
}

async function getCustomersByIdsInOrder(args: {
  teamId: string;
  customerIds: string[];
}) {
  if (args.customerIds.length === 0) {
    return [];
  }

  const customers = await getCustomersByIdsFromConvex({
    teamId: args.teamId,
    customerIds: args.customerIds,
  });
  const customersById = new Map(customers.map((customer) => [customer.id, customer]));

  return args.customerIds.flatMap((customerId) => {
    const customer = customersById.get(customerId);

    return customer ? [customer] : [];
  });
}

async function buildCustomerRows(
  teamId: string,
  customers: CustomerRecord[],
): Promise<CustomerListRow[]> {
  if (customers.length === 0) {
    return [];
  }

  const customerIds = customers.map((customer) => customer.id);
  const [trackerProjects, invoices] = await Promise.all([
    getTrackerProjectsByCustomerIdsFromConvex({
      teamId,
      customerIds,
    }),
    getProjectedInvoicesForCustomers(teamId, customerIds),
  ]);
  const metricsByCustomerId = buildInvoiceMetricsByCustomerId(invoices);
  const projectCountByCustomerId = buildProjectCountByCustomerId(trackerProjects);

  return attachCustomerTags(
    teamId,
    customers.map((customer) => {
      const metrics = metricsByCustomerId.get(customer.id) ?? {
        invoiceCount: 0,
        totalRevenue: 0,
        outstandingAmount: 0,
        lastInvoiceDate: null,
        invoiceCurrency: null,
      };

      return {
        ...customer,
        ...metrics,
        projectCount: projectCountByCustomerId.get(customer.id) ?? 0,
      };
    }),
  );
}

async function getIndexedCustomersPage(params: GetCustomersParams) {
  const { teamId, sort, cursor, pageSize = 25, q } = params;
  const order = getIndexedCustomerOrder(sort) ?? "desc";
  const cursorState = decodeIndexedCustomerCursor(cursor);
  let sourceCursor = cursorState.sourceCursor;
  let sourceExhausted = cursorState.sourceExhausted;
  let bufferedIds = [...cursorState.bufferedIds];
  const eligibleCustomers: CustomerRecord[] = [];

  while (eligibleCustomers.length <= pageSize && bufferedIds.length > 0) {
    const takeCount = pageSize + 1 - eligibleCustomers.length;
    const bufferedCustomers = await getCustomersByIdsInOrder({
      teamId,
      customerIds: bufferedIds.slice(0, takeCount),
    });

    bufferedIds = bufferedIds.slice(takeCount);
    eligibleCustomers.push(
      ...bufferedCustomers.filter((customer) => matchesCustomerSearch(customer, q)),
    );
  }

  while (eligibleCustomers.length <= pageSize && !sourceExhausted) {
    const result = await getCustomersPageFromConvex({
      teamId,
      cursor: sourceCursor,
      pageSize: getIndexedCustomerBatchSize(pageSize),
      order,
    });

    eligibleCustomers.push(
      ...result.page.filter((customer) => matchesCustomerSearch(customer, q)),
    );

    sourceCursor = result.isDone ? null : result.continueCursor;
    sourceExhausted = result.isDone;

    if (result.page.length === 0) {
      break;
    }
  }

  const pagedCustomers = eligibleCustomers.slice(0, pageSize);
  const nextBufferedIds = [
    ...eligibleCustomers.slice(pageSize).map((customer) => customer.id),
    ...bufferedIds,
  ];
  const hasNextPage = nextBufferedIds.length > 0;
  const nextCursor = hasNextPage
    ? encodeIndexedCustomerCursor({
        sourceCursor,
        sourceExhausted,
        bufferedIds: nextBufferedIds,
      })
    : undefined;
  const data = await buildCustomerRows(teamId, pagedCustomers);

  return {
    meta: {
      cursor: nextCursor ?? null,
      hasPreviousPage: Boolean(cursor),
      hasNextPage,
    },
    data,
  };
}

export const getCustomerById = async (
  _db: Database,
  params: GetCustomerByIdParams,
) => {
  const customer = await getCustomerByIdFromConvex({
    teamId: params.teamId,
    customerId: params.id,
  });

  if (!customer) {
    return null;
  }

  const [customerWithTags] = await buildCustomerRows(params.teamId, [customer]);

  return customerWithTags ?? null;
};

export const getCustomers = async (
  _db: Database,
  params: GetCustomersParams,
) => {
  const { teamId, sort, cursor, pageSize = 25, q } = params;

  if (canUseIndexedCustomerPage(sort)) {
    return getIndexedCustomersPage(params);
  }

  const offset = cursor ? Number.parseInt(cursor, 10) : 0;
  const customers = await getCustomersFromConvex({ teamId });
  const matchedCustomers = customers.filter((customer) =>
    matchesCustomerSearch(customer, q),
  );
  const dataWithTags = await buildCustomerRows(teamId, matchedCustomers);

  const sortedData = sortCustomers(dataWithTags, sort);
  const paginatedData = sortedData.slice(offset, offset + pageSize);
  const nextCursor =
    sortedData.length > offset + pageSize
      ? (offset + pageSize).toString()
      : undefined;

  return {
    meta: {
      cursor: nextCursor ?? null,
      hasPreviousPage: offset > 0,
      hasNextPage: sortedData.length > offset + pageSize,
    },
    data: paginatedData,
  };
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
  tags?: { id: string; name: string }[] | null;
};

export const upsertCustomer = async (
  db: Database,
  params: UpsertCustomerParams,
) => {
  const { id, tags: inputTags, teamId, userId, ...rest } = params;
  const customerId = id ?? crypto.randomUUID();
  const isNewCustomer = !id;
  const token = await generateToken(customerId);
  const customer = await upsertCustomerInConvex({
    teamId,
    id: customerId,
    createdAt: isNewCustomer ? new Date().toISOString() : undefined,
    token,
    ...rest,
  });

  if (isNewCustomer) {
    createActivity(db, {
      teamId,
      userId,
      type: "customer_created",
      source: "user",
      priority: 7,
      metadata: {
        customerId,
        customerName: customer.name,
        customerEmail: customer.email,
        website: customer.website,
        country: customer.country,
        city: customer.city,
      },
    });
  }

  await replaceCustomerTagsInConvex({
    teamId,
    customerId,
    tagIds: inputTags?.map((tag) => tag.id) ?? [],
  });

  const result = await getCustomerById(db, { id: customerId, teamId });

  if (!result) {
    throw new Error("Failed to load customer after upsert");
  }

  return result;
};

export type DeleteCustomerParams = {
  id: string;
  teamId: string;
};

export const deleteCustomer = async (
  db: Database,
  params: DeleteCustomerParams,
) => {
  const { id, teamId } = params;
  const customerToDelete = await getCustomerById(db, { id, teamId });

  if (!customerToDelete) {
    throw new Error("Customer not found");
  }

  await deleteCustomerInConvex({
    teamId,
    customerId: id,
  });

  await deleteCustomerTagsForCustomerInConvex({
    teamId,
    customerId: id,
  });

  return customerToDelete;
};

export type GetCustomerInvoiceSummaryParams = {
  customerId: string;
  teamId: string;
};

export async function getCustomerInvoiceSummary(
  db: Database,
  params: GetCustomerInvoiceSummaryParams,
) {
  const { customerId, teamId } = params;
  const team = await getTeamById(db, teamId);
  const baseCurrency = team?.baseCurrency || "USD";
  const invoiceData = await getProjectedInvoicesForCustomers(teamId, [customerId]);

  if (invoiceData.length === 0) {
    return {
      totalAmount: 0,
      paidAmount: 0,
      outstandingAmount: 0,
      invoiceCount: 0,
      currency: baseCurrency,
    };
  }

  const currenciesToConvert = [
    ...new Set(
      invoiceData
        .map((invoice) => invoice.currency || baseCurrency)
        .filter((currency) => currency !== baseCurrency),
    ),
  ];

  const exchangeRateMap = new Map<string, number>();

  if (currenciesToConvert.length > 0) {
    const pairs = currenciesToConvert.map((currency) => ({
      base: currency,
      target: baseCurrency,
    }));
    const batchRates = await getExchangeRatesBatch(db, { pairs });

    for (const [key, rate] of batchRates) {
      const base = key.split(":")[0];

      if (base) {
        exchangeRateMap.set(base, rate);
      }
    }
  }

  let totalAmount = 0;
  let paidAmount = 0;
  let outstandingAmount = 0;
  let invoiceCount = 0;

  for (const invoice of invoiceData) {
    const amount = Number(invoice.amount) || 0;
    const currency = invoice.currency || baseCurrency;
    let convertedAmount = amount;
    let canConvert = true;

    if (currency !== baseCurrency) {
      const exchangeRate = exchangeRateMap.get(currency);

      if (exchangeRate) {
        convertedAmount = amount * exchangeRate;
      } else {
        canConvert = false;
      }
    }

    if (!canConvert) {
      continue;
    }

    if (invoice.status === "paid") {
      paidAmount += convertedAmount;
      totalAmount += convertedAmount;
      invoiceCount += 1;
    } else if (invoice.status === "unpaid" || invoice.status === "overdue") {
      outstandingAmount += convertedAmount;
      totalAmount += convertedAmount;
      invoiceCount += 1;
    }
  }

  return {
    totalAmount: Math.round(totalAmount * 100) / 100,
    paidAmount: Math.round(paidAmount * 100) / 100,
    outstandingAmount: Math.round(outstandingAmount * 100) / 100,
    invoiceCount,
    currency: baseCurrency,
  };
}

export type ToggleCustomerPortalParams = {
  customerId: string;
  teamId: string;
  enabled: boolean;
};

export async function toggleCustomerPortal(
  _db: Database,
  params: ToggleCustomerPortalParams,
) {
  return toggleCustomerPortalInConvex({
    teamId: params.teamId,
    customerId: params.customerId,
    enabled: params.enabled,
  });
}

export type GetCustomerByPortalIdParams = {
  portalId: string;
};

export async function getCustomerByPortalId(
  db: Database,
  params: GetCustomerByPortalIdParams,
) {
  const customer = await getCustomerByPortalIdFromConvex({
    portalId: params.portalId,
  });

  if (!customer) {
    return null;
  }

  const team = await getTeamById(db, customer.teamId);

  if (!team) {
    return null;
  }

  return {
    ...customer,
    team: {
      id: team.id,
      name: team.name,
      logoUrl: team.logoUrl,
      baseCurrency: team.baseCurrency,
    },
  };
}

export type GetCustomerPortalInvoicesParams = {
  customerId: string;
  teamId: string;
  cursor?: string | null;
  pageSize?: number;
};

export async function getCustomerPortalInvoices(
  _db: Database,
  params: GetCustomerPortalInvoicesParams,
) {
  const { customerId, teamId, cursor, pageSize = 10 } = params;
  const offset = cursor ? Number.parseInt(cursor, 10) : 0;
  const data = (await getProjectedInvoicesForCustomers(teamId, [customerId]))
    .filter(
      (invoice) =>
        invoice.customerId === customerId &&
        (invoice.status === "paid" ||
          invoice.status === "unpaid" ||
          invoice.status === "overdue"),
    )
    .sort((left, right) =>
      (right.issueDate ?? "").localeCompare(left.issueDate ?? ""),
    )
    .slice(offset, offset + pageSize)
    .map((invoice) => ({
      id: invoice.id,
      invoiceNumber: null,
      status: invoice.status,
      amount: invoice.amount,
      currency: invoice.currency,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      token: invoice.token,
    }));

  const nextCursor =
    data.length === pageSize ? (offset + pageSize).toString() : null;

  return {
    data,
    nextCursor,
    hasMore: data.length === pageSize,
  };
}
