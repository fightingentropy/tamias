import { createLazyFileRoute } from "@tanstack/react-router";
import { PublicInvoicePage } from "./-public-invoice-page";

export const Route = createLazyFileRoute("/i/$token")({
  component: PublicInvoicePage,
});
