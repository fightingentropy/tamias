import {
  type GetInvoiceProductsParams,
  getInvoiceProducts,
} from "@tamias/app-data/queries/invoice-products";

export async function getInvoiceProductsForTeam(args: {
  teamId: string;
  input?: GetInvoiceProductsParams;
}) {
  return getInvoiceProducts(args.teamId, args.input);
}
