import { complianceRouter } from "../compliance";
import { companiesHouseRouter } from "../companies-house";
import { customersRouter } from "../customers";
import { documentTagAssignmentsRouter } from "../document-tag-assignments";
import { documentTagsRouter } from "../document-tags";
import { documentsRouter } from "../documents";
import { inboxRouter } from "../inbox";
import { inboxAccountsRouter } from "../inbox-accounts";
import { uploadsRouter } from "../uploads";

export const contentRouters = {
  compliance: complianceRouter,
  companiesHouse: companiesHouseRouter,
  customers: customersRouter,
  documentTagAssignments: documentTagAssignmentsRouter,
  documentTags: documentTagsRouter,
  documents: documentsRouter,
  inbox: inboxRouter,
  inboxAccounts: inboxAccountsRouter,
  uploads: uploadsRouter,
};
