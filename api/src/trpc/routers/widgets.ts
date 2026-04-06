import { createTRPCRouter } from "../init";
import { widgetFinanceProcedures } from "./widgets-finance";
import { widgetOperationProcedures } from "./widgets-operations";
import { widgetOverviewProcedures } from "./widgets-overview";
import { widgetPreferenceProcedures } from "./widgets-preferences";

export const widgetsRouter = createTRPCRouter({
  ...widgetOverviewProcedures,
  ...widgetFinanceProcedures,
  ...widgetOperationProcedures,
  ...widgetPreferenceProcedures,
});
