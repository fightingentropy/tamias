"use client";

import dynamic from "@/framework/dynamic";
import { CategoryCreateSheet } from "@/components/sheets/category-create-sheet";
import { CategoryEditSheet } from "@/components/sheets/category-edit-sheet";
import { CustomerCreateSheet } from "@/components/sheets/customer-create-sheet";
import { CustomerEditSheet } from "@/components/sheets/customer-edit-sheet";
import { ProductCreateSheet } from "@/components/sheets/product-create-sheet";
import { ProductEditSheet } from "@/components/sheets/product-edit-sheet";
import { useCustomerParams } from "@/hooks/use-customer-params";
import { useDeferredSheetMount } from "./global-sheet-mount";

const CustomerDetailsSheet = dynamic(
  () =>
    import("@/components/sheets/customer-details-sheet").then(
      (mod) => mod.CustomerDetailsSheet,
    ),
  { ssr: false },
);

function CustomerDetailsSheetMount() {
  const { customerId, details } = useCustomerParams();
  const shouldMount = useDeferredSheetMount(Boolean(customerId && details));

  return shouldMount ? <CustomerDetailsSheet /> : null;
}

export function GlobalEntitySheets() {
  return (
    <>
      <CategoryCreateSheet />
      <CategoryEditSheet />

      <CustomerCreateSheet />
      <CustomerDetailsSheetMount />
      <CustomerEditSheet />

      <ProductCreateSheet />
      <ProductEditSheet />
    </>
  );
}
