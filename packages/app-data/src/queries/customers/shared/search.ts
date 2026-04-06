import type { CustomerRecord } from "@tamias/app-data-convex";
import type { CustomerListRow } from "../types";
import { compareCustomersByTags } from "./tags";

export function matchesCustomerSearch(
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

export function sortCustomers(data: CustomerListRow[], sort?: string[] | null) {
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
