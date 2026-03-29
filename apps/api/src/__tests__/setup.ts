import { mock } from "bun:test";

// Mock all external dependencies that the API uses
// These mocks are applied globally before any test files run

const createMockDb = () => ({});

export const mockDb = createMockDb();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockFn = ReturnType<typeof mock<(...args: any[]) => any>>;

// Create reusable mock functions that tests can access
export const mocks = {
  // Transaction queries
  getTransactions: mock(() => ({
    data: [],
    meta: { hasNextPage: false, hasPreviousPage: false },
  })) as MockFn,
  getTransactionById: mock(() => null) as MockFn,
  createTransaction: mock(() => ({})) as MockFn,
  createTransactions: mock(() => []) as MockFn,
  updateTransaction: mock(() => ({})) as MockFn,
  updateTransactions: mock(() => ({ data: [], meta: {} })) as MockFn,
  deleteTransactions: mock(() => []) as MockFn,
  getTransactionAttachment: mock(() => null) as MockFn,
  getSimilarTransactions: mock(() => []) as MockFn,
  searchTransactionMatch: mock(() => []) as MockFn,
  getTransactionsReadyForExportCount: mock(() => 0) as MockFn,
  moveTransactionToReview: mock(() => ({})) as MockFn,

  // Invoice queries
  getInvoices: mock(() => ({
    data: [],
    meta: { hasNextPage: false, hasPreviousPage: false },
  })) as MockFn,
  getInvoiceById: mock(() => null) as MockFn,
  createInvoice: mock(() => ({})) as MockFn,
  updateInvoice: mock(() => ({})) as MockFn,
  deleteInvoice: mock(() => ({})) as MockFn,
  draftInvoice: mock(() => ({})) as MockFn,
  duplicateInvoice: mock(() => ({})) as MockFn,
  getInvoiceNumber: mock(() => "INV-001") as MockFn,
  getNextInvoiceNumber: mock(() => "INV-002") as MockFn,
  getInvoiceSummary: mock(() => ({
    paid: { count: 0, amount: 0 },
    unpaid: { count: 0, amount: 0 },
    overdue: { count: 0, amount: 0 },
    draft: { count: 0, amount: 0 },
  })) as MockFn,
  getInvoiceTemplate: mock(() => null) as MockFn,
  getPaymentStatus: mock(() => ({
    score: 0,
    paymentStatus: "none",
  })) as MockFn,
  isInvoiceNumberUsed: mock(() => false) as MockFn,
  searchInvoiceNumber: mock(() => []) as MockFn,
  getAverageDaysToPayment: mock(() => 15) as MockFn,
  getAverageInvoiceSize: mock(() => 1000) as MockFn,
  getInactiveClientsCount: mock(() => 0) as MockFn,
  getNewCustomersCount: mock(() => 5) as MockFn,
  getMostActiveClient: mock(() => null) as MockFn,
  getTopRevenueClient: mock(() => null) as MockFn,

  // Customer queries
  getCustomers: mock(() => ({
    data: [],
    meta: { hasNextPage: false, hasPreviousPage: false },
  })) as MockFn,
  getCustomerPageSummary: mock(() => ({
    mostActiveClient: null,
    inactiveClientsCount: 0,
    topRevenueClient: null,
    newCustomersCount: 0,
  })) as MockFn,
  getCustomerById: mock(() => null) as MockFn,
  createCustomer: mock(() => ({})) as MockFn,
  updateCustomer: mock(() => ({})) as MockFn,
  deleteCustomer: mock(() => ({})) as MockFn,

  // Document queries
  getDocuments: mock(() => ({
    data: [],
    meta: { hasNextPage: false, hasPreviousPage: false },
  })) as MockFn,

  // Bank account queries
  getBankAccounts: mock(() => []) as MockFn,
  getBankConnections: mock(() => []) as MockFn,
  getBankAccountById: mock(() => null) as MockFn,
  createBankAccount: mock(() => ({})) as MockFn,
  updateBankAccount: mock(() => ({})) as MockFn,
  deleteBankAccount: mock(() => ({})) as MockFn,

  // Tag queries
  getTags: mock(() => []) as MockFn,

  // Tracker queries
  getTrackerProjects: mock(() => ({
    data: [],
    meta: { hasNextPage: false, hasPreviousPage: false },
  })) as MockFn,

  // Invoice product queries
  getInvoiceProducts: mock(() => []) as MockFn,

  // Compliance queries
  getFilingProfile: mock(() => null) as MockFn,
  getVatDashboard: mock(() => ({
    enabled: false,
    team: {
      id: "",
      name: null,
      countryCode: null,
      baseCurrency: null,
    },
    profile: null,
    connected: false,
    obligations: [],
    latestDraft: null,
    latestSubmission: null,
  })) as MockFn,
  listVatSubmissions: mock(() => []) as MockFn,
  getYearEndDashboard: mock(() => null) as MockFn,
  getPayrollDashboard: mock(() => null) as MockFn,

  // Inbox queries
  getInboxItems: mock(() => ({
    data: [],
    meta: { hasNextPage: false, hasPreviousPage: false },
  })) as MockFn,
  getInboxItemById: mock(() => null) as MockFn,
  updateInboxItem: mock(() => ({})) as MockFn,
  deleteInboxItem: mock(() => ({})) as MockFn,

  // API Keys
  getApiKeyByToken: mock(() => null) as MockFn,
  upsertApiKey: mock(() => ({})) as MockFn,
  getApiKeysByTeam: mock(() => []) as MockFn,
  deleteApiKey: mock(() => ({})) as MockFn,
  updateApiKeyLastUsedAt: mock(() => ({})) as MockFn,

  // Users
  getUserById: mock(() => null) as MockFn,
  getUser: mock(() => null) as MockFn,
  updateUser: mock(() => ({})) as MockFn,

  // Teams
  getTeamById: mock(() => null) as MockFn,
  getTeam: mock(() => null) as MockFn,
  updateTeam: mock(() => ({})) as MockFn,

  // Other commonly used queries
  validateAccessToken: mock(() => null) as MockFn,
  signedUrl: mock(() => ({
    data: { signedUrl: "https://example.com/signed" },
    error: null,
  })) as MockFn,
  formatAmountValue: mock(
    ({ amount }: { amount: string }) => Number.parseFloat(amount) || 0,
  ) as MockFn,
};

// Create a default mock function that returns empty data
const createDefaultMock = () => mock(() => null);

// Mock @tamias/app-data/queries with a Proxy to handle any export
const dbQueriesMock = new Proxy(
  {
    // Transaction functions
    getTransactions: mocks.getTransactions,
    getTransactionById: mocks.getTransactionById,
    createTransaction: mocks.createTransaction,
    createTransactions: mocks.createTransactions,
    updateTransaction: mocks.updateTransaction,
    updateTransactions: mocks.updateTransactions,
    deleteTransactions: mocks.deleteTransactions,
    getTransactionAttachment: mocks.getTransactionAttachment,
    getSimilarTransactions: mocks.getSimilarTransactions,
    searchTransactionMatch: mocks.searchTransactionMatch,
    getTransactionsReadyForExportCount:
      mocks.getTransactionsReadyForExportCount,
    moveTransactionToReview: mocks.moveTransactionToReview,

    // Invoice functions
    getInvoices: mocks.getInvoices,
    getInvoiceById: mocks.getInvoiceById,
    createInvoice: mocks.createInvoice,
    updateInvoice: mocks.updateInvoice,
    deleteInvoice: mocks.deleteInvoice,
    draftInvoice: mocks.draftInvoice,
    duplicateInvoice: mocks.duplicateInvoice,
    getInvoiceNumber: mocks.getInvoiceNumber,
    getNextInvoiceNumber: mocks.getNextInvoiceNumber,
    getInvoiceSummary: mocks.getInvoiceSummary,
    getInvoiceTemplate: mocks.getInvoiceTemplate,
    getPaymentStatus: mocks.getPaymentStatus,
    isInvoiceNumberUsed: mocks.isInvoiceNumberUsed,
    searchInvoiceNumber: mocks.searchInvoiceNumber,
    getAverageDaysToPayment: mocks.getAverageDaysToPayment,
    getAverageInvoiceSize: mocks.getAverageInvoiceSize,
    getInactiveClientsCount: mocks.getInactiveClientsCount,
    getNewCustomersCount: mocks.getNewCustomersCount,
    getMostActiveClient: mocks.getMostActiveClient,
    getTopRevenueClient: mocks.getTopRevenueClient,

    // Customer functions
    getCustomers: mocks.getCustomers,
    getCustomerPageSummary: mocks.getCustomerPageSummary,
    getCustomerById: mocks.getCustomerById,
    createCustomer: mocks.createCustomer,
    updateCustomer: mocks.updateCustomer,
    deleteCustomer: mocks.deleteCustomer,
    upsertCustomer: mock(() => ({})),
    getCustomerInvoiceSummary: mock(() => ({ total: 0, paid: 0, overdue: 0 })),
    clearCustomerEnrichment: mock(() => ({})),
    updateCustomerEnrichmentStatus: mock(() => ({})),
    toggleCustomerPortal: mock(() => ({})),
    getCustomerByPortalId: mock(() => null),
    getCustomerPortalInvoices: mock(() => ({ data: [], meta: {} })),

    // Document functions
    getDocuments: mocks.getDocuments,

    // Bank account functions
    getBankAccounts: mocks.getBankAccounts,
    getBankConnections: mocks.getBankConnections,
    getBankAccountById: mocks.getBankAccountById,
    createBankAccount: mocks.createBankAccount,
    updateBankAccount: mocks.updateBankAccount,
    deleteBankAccount: mocks.deleteBankAccount,
    getBankAccountDetails: mock(() => null),
    getBankAccountsBalances: mock(() => []),
    getBankAccountsCurrencies: mock(() => []),
    getBankAccountsWithPaymentInfo: mock(() => []),

    // Tags
    getTags: mocks.getTags,

    // Inbox functions
    getInboxItems: mocks.getInboxItems,
    getInboxItemById: mocks.getInboxItemById,
    updateInboxItem: mocks.updateInboxItem,
    deleteInboxItem: mocks.deleteInboxItem,
    getInbox: mock(() => ({
      data: [],
      meta: { hasNextPage: false, hasPreviousPage: false },
    })),
    getInboxById: mock(() => null),
    createInbox: mock(() => ({})),
    updateInbox: mock(() => ({})),
    deleteInbox: mock(() => ({})),
    deleteInboxMany: mock(() => []),
    getInboxByStatus: mock(() => ({ pending: 0, completed: 0 })),
    getInboxSearch: mock(() => []),
    getInboxBlocklist: mock(() => []),
    createInboxBlocklist: mock(() => ({})),
    deleteInboxBlocklist: mock(() => ({})),
    checkInboxAttachments: mock(() => []),
    matchTransaction: mock(() => ({})),
    unmatchTransaction: mock(() => ({})),
    confirmSuggestedMatch: mock(() => ({})),
    declineSuggestedMatch: mock(() => ({})),

    // API Keys
    getApiKeyByToken: mocks.getApiKeyByToken,
    upsertApiKey: mocks.upsertApiKey,
    getApiKeysByTeam: mocks.getApiKeysByTeam,
    deleteApiKey: mocks.deleteApiKey,
    updateApiKeyLastUsedAt: mocks.updateApiKeyLastUsedAt,

    // Users
    getUserById: mocks.getUserById,
    getUser: mocks.getUser,
    updateUser: mocks.updateUser,
    getUserTeamId: mock(() => "test-team-id"),

    // Teams
    getTeamById: mocks.getTeamById,
    getTeam: mocks.getTeam,
    updateTeam: mocks.updateTeam,

    // Tracker
    getTrackerProjects: mocks.getTrackerProjects,
    getTrackerProjectById: mock(() => null),
    getTrackerRecordsByRange: mock(() => []),

    // Invoice products
    getInvoiceProducts: mocks.getInvoiceProducts,

    // Compliance
    getFilingProfile: mocks.getFilingProfile,
    getVatDashboard: mocks.getVatDashboard,
    listVatSubmissions: mocks.listVatSubmissions,
    getYearEndDashboard: mocks.getYearEndDashboard,
    getPayrollDashboard: mocks.getPayrollDashboard,

    // Validation
    validateAccessToken: mocks.validateAccessToken,
  } as Record<string, any>,
  {
    get(target, prop) {
      if (prop in target) {
        return target[prop as string];
      }
      // Return a default mock for any unspecified export
      target[prop as string] = createDefaultMock();
      return target[prop as string];
    },
  },
);

mock.module("@tamias/app-data/queries", () => dbQueriesMock);
mock.module("@tamias/app-data/queries/inbox", () => ({
  getInbox: dbQueriesMock.getInbox,
}));
mock.module("@tamias/app-data/queries/inbox-accounts", () => ({
  getInboxAccounts: dbQueriesMock.getInboxAccounts,
}));
mock.module("@tamias/app-data/queries/inbox-blocklist", () => ({
  getInboxBlocklist: dbQueriesMock.getInboxBlocklist,
}));
mock.module("@tamias/app-data/queries/invoices", () => ({
  getInvoices: dbQueriesMock.getInvoices,
  getInvoiceSummary: dbQueriesMock.getInvoiceSummary,
  getPaymentStatus: dbQueriesMock.getPaymentStatus,
}));
mock.module("@tamias/app-data/queries/customers", () => ({
  getCustomers: dbQueriesMock.getCustomers,
}));
mock.module("@tamias/app-data/queries/customer-summary", () => ({
  getCustomerPageSummary: dbQueriesMock.getCustomerPageSummary,
}));
mock.module("@tamias/app-data/queries/documents", () => ({
  getDocuments: dbQueriesMock.getDocuments,
}));
mock.module("@tamias/app-data/queries/bank-accounts", () => ({
  getBankAccounts: dbQueriesMock.getBankAccounts,
}));
mock.module("@tamias/app-data/queries/bank-connections", () => ({
  getBankConnections: dbQueriesMock.getBankConnections,
}));
mock.module("@tamias/app-data/queries/tags", () => ({
  getTags: dbQueriesMock.getTags,
}));
mock.module("@tamias/app-data/queries/tracker-projects", () => ({
  getTrackerProjects: dbQueriesMock.getTrackerProjects,
}));
mock.module("@tamias/app-data/queries/invoice-products", () => ({
  getInvoiceProducts: dbQueriesMock.getInvoiceProducts,
}));
mock.module("@tamias/app-data/queries/compliance", () => ({
  getFilingProfile: dbQueriesMock.getFilingProfile,
  getVatDashboard: dbQueriesMock.getVatDashboard,
  listVatSubmissions: dbQueriesMock.listVatSubmissions,
}));
mock.module("@tamias/app-data/queries/year-end", () => ({
  getYearEndDashboard: dbQueriesMock.getYearEndDashboard,
}));
mock.module("@tamias/app-data/queries/payroll", () => ({
  getPayrollDashboard: dbQueriesMock.getPayrollDashboard,
}));
mock.module("@tamias/app-data/queries/transactions", () => ({
  getTransactions: dbQueriesMock.getTransactions,
  getTransactionsReadyForExportCount:
    dbQueriesMock.getTransactionsReadyForExportCount,
}));
mock.module("@tamias/app-data/queries/transaction-categories", () => ({
  getCategories: dbQueriesMock.getCategories,
}));

// Mock @tamias/job-client
mock.module("@tamias/job-client", () => ({
  enqueue: mock(() => ({ runId: "run-123" })),
  startCloudflareWorkflow: mock(() => ({ runId: "run-123" })),
  scheduleRecurring: mock(() => ({ runId: "run-123" })),
  cancelRun: mock(() => false),
  getRunStatus: mock(() => ({ status: "completed" })),
}));

// Mock @tamias/import
mock.module("@tamias/import", () => ({
  formatAmountValue: mocks.formatAmountValue,
}));

// Mock @tamias/invoice
mock.module("@tamias/invoice/calculate", () => ({
  calculateTotal: mock(({ lineItems }: { lineItems: any[] }) => ({
    subTotal: lineItems.reduce(
      (sum: number, item: any) => sum + item.price * item.quantity,
      0,
    ),
    total: lineItems.reduce(
      (sum: number, item: any) => sum + item.price * item.quantity,
      0,
    ),
    vat: 0,
    tax: 0,
  })),
}));

mock.module("@tamias/invoice/utils", () => ({
  transformCustomerToContent: mock((customer: any) => ({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: customer?.name || "" }],
      },
    ],
  })),
}));

mock.module("@tamias/invoice/token", () => ({
  verify: mock(() => ({ id: "invoice-123", teamId: "test-team-id" })),
}));

mock.module("@tamias/invoice", () => ({
  DEFAULT_TEMPLATE: {},
}));

// Mock @tamias/auth-session - needed by tRPC init
mock.module("@tamias/auth-session", () => ({
  verifyAccessToken: mock(async () => ({
    user: {
      id: "test-user-id",
      email: "test@example.com",
      user_metadata: {},
      app_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    },
    access_token: "test-access-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "test-refresh-token",
  })),
  createUserSessionResolver: mock(() => async () => ({
    teamId: "test-team-id",
    user: {
      id: "test-user-id",
      convexId: "test-user-id",
      email: "test@example.com",
      full_name: "Test User",
    },
  })),
  createTrustedSessionSnapshot: mock(async () => ({
    session: null,
    headerValue: null,
  })),
  resolveRequestAuth: mock(async () => ({
    session: {
      teamId: "test-team-id",
      user: {
        id: "test-user-id",
        convexId: "test-user-id",
        email: "test@example.com",
        full_name: "Test User",
      },
    },
    teamId: "test-team-id",
    scopes: ["apis.all"],
    isInternalRequest: false,
  })),
}));

// Mock @tamias/app-data/client
mock.module("@tamias/app-data/client", () => ({
  db: mockDb,
}));

// Set required environment variables for tests
process.env.CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";
process.env.NEXT_PUBLIC_CONVEX_URL =
  process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL;
process.env.CONVEX_SITE_URL =
  process.env.CONVEX_SITE_URL || "http://127.0.0.1:3211";
process.env.NEXT_PUBLIC_CONVEX_SITE_URL =
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL || process.env.CONVEX_SITE_URL;
process.env.TAMIAS_DASHBOARD_URL =
  process.env.TAMIAS_DASHBOARD_URL || "https://tamias.xyz";
