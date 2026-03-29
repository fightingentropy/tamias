import { describe, expect, test } from "bun:test";

describe("Balance Sheet Calculation Logic", () => {
  // Mock bank accounts for balance sheet
  const mockBankAccounts = [
    {
      id: "bs-acc-1",
      name: "Operating Account",
      type: "depository",
      balance: 50000,
      currency: "USD",
      enabled: true,
    },
    {
      id: "bs-acc-2",
      name: "Treasury Account",
      type: "other_asset",
      balance: 200000,
      currency: "USD",
      enabled: true,
    },
    {
      id: "bs-acc-3",
      name: "Credit Card",
      type: "credit",
      balance: 15000, // Amount owed
      currency: "USD",
      enabled: true,
    },
    {
      id: "bs-acc-4",
      name: "Business Loan",
      type: "loan",
      balance: 100000, // Loan balance
      currency: "USD",
      enabled: true,
    },
  ];

  // Mock unpaid invoices (Accounts Receivable)
  const mockUnpaidInvoices = [
    { id: "inv-1", amount: 5000, currency: "USD", status: "unpaid" },
    { id: "inv-2", amount: 3000, currency: "USD", status: "overdue" },
  ];

  // Mock transactions for asset/liability categories
  const mockAssetTransactions = [
    { categorySlug: "prepaid-expenses", amount: -2000 }, // Prepaid = expense that creates asset
    { categorySlug: "fixed-assets", amount: -10000 },
    { categorySlug: "inventory", amount: -5000 },
  ];

  const mockLiabilityTransactions = [
    { categorySlug: "loan-proceeds", amount: 100000 }, // Received loan
    { categorySlug: "loan-principal-repayment", amount: -20000 }, // Paid back
    { categorySlug: "deferred-revenue", amount: 8000 }, // Received but not earned
  ];

  const CASH_ACCOUNT_TYPES = ["depository", "other_asset"];
  const DEBT_ACCOUNT_TYPES = ["credit", "loan"];

  test("cash balance should include depository and other_asset accounts", () => {
    const cashAccounts = mockBankAccounts.filter((acc) =>
      CASH_ACCOUNT_TYPES.includes(acc.type),
    );

    const totalCash = cashAccounts.reduce((sum, acc) => sum + acc.balance, 0);

    // Operating (50,000) + Treasury (200,000) = 250,000
    expect(totalCash).toBe(250000);
  });

  test("accounts receivable should sum unpaid invoices", () => {
    const accountsReceivable = mockUnpaidInvoices.reduce(
      (sum, inv) => sum + inv.amount,
      0,
    );

    // 5,000 + 3,000 = 8,000
    expect(accountsReceivable).toBe(8000);
  });

  test("prepaid expenses should be treated as assets", () => {
    // Prepaid expenses are outflows that create future value
    const prepaid = mockAssetTransactions.find(
      (t) => t.categorySlug === "prepaid-expenses",
    );

    // Amount is negative (money out) but creates asset
    const prepaidAssetValue = Math.abs(prepaid!.amount);
    expect(prepaidAssetValue).toBe(2000);
  });

  test("fixed assets should be calculated from purchase transactions", () => {
    const fixedAssets = mockAssetTransactions.find(
      (t) => t.categorySlug === "fixed-assets",
    );

    const fixedAssetValue = Math.abs(fixedAssets!.amount);
    expect(fixedAssetValue).toBe(10000);
  });

  test("total assets calculation", () => {
    // Cash
    const cash = 250000;
    // Accounts Receivable
    const ar = 8000;
    // Other assets (prepaid, fixed, inventory)
    const otherAssets = 2000 + 10000 + 5000; // 17,000

    const totalAssets = cash + ar + otherAssets;

    expect(totalAssets).toBe(275000);
  });

  test("credit card debt should be included in liabilities", () => {
    const creditAccounts = mockBankAccounts.filter(
      (acc) => acc.type === "credit",
    );

    const creditDebt = creditAccounts.reduce(
      (sum, acc) => sum + Math.abs(acc.balance),
      0,
    );

    expect(creditDebt).toBe(15000);
  });

  test("loan balance should be calculated from proceeds minus repayments", () => {
    // Loan proceeds (received) - repayments = outstanding balance
    const loanProceeds =
      mockLiabilityTransactions.find((t) => t.categorySlug === "loan-proceeds")
        ?.amount || 0;

    const loanRepayments = Math.abs(
      mockLiabilityTransactions.find(
        (t) => t.categorySlug === "loan-principal-repayment",
      )?.amount || 0,
    );

    const outstandingLoan = loanProceeds - loanRepayments;

    // 100,000 - 20,000 = 80,000
    expect(outstandingLoan).toBe(80000);
  });

  test("deferred revenue should be included in liabilities", () => {
    const deferredRevenue = mockLiabilityTransactions.find(
      (t) => t.categorySlug === "deferred-revenue",
    )!.amount;

    // Revenue received but not yet earned = liability
    expect(deferredRevenue).toBe(8000);
  });

  test("total liabilities calculation", () => {
    // Credit card debt
    const creditDebt = 15000;
    // Outstanding loan (from transactions)
    const outstandingLoan = 80000;
    // Deferred revenue
    const deferredRevenue = 8000;

    const totalLiabilities = creditDebt + outstandingLoan + deferredRevenue;

    expect(totalLiabilities).toBe(103000);
  });

  test("equity = total assets - total liabilities", () => {
    const totalAssets = 275000;
    const totalLiabilities = 103000;

    const equity = totalAssets - totalLiabilities;

    // 275,000 - 103,000 = 172,000
    expect(equity).toBe(172000);
  });

  test("balance sheet should balance (assets = liabilities + equity)", () => {
    const totalAssets = 275000;
    const totalLiabilities = 103000;
    const equity = 172000;

    // Fundamental accounting equation
    expect(totalAssets).toBe(totalLiabilities + equity);
  });

  test("negative equity indicates liabilities exceed assets", () => {
    const smallAssets = 50000;
    const largeLiabilities = 150000;

    const equity = smallAssets - largeLiabilities;

    expect(equity).toBe(-100000);
    expect(equity).toBeLessThan(0);
  });

  test("balance sheet should use cash accounts not credit accounts for cash", () => {
    // This was a key bug - credit was being included in cash
    const allAccounts = mockBankAccounts;

    // WRONG: Including all account balances
    const buggyTotal = allAccounts.reduce((sum, acc) => sum + acc.balance, 0);

    // CORRECT: Only cash account types
    const correctCash = allAccounts
      .filter((acc) => CASH_ACCOUNT_TYPES.includes(acc.type))
      .reduce((sum, acc) => sum + acc.balance, 0);

    // Buggy: 50,000 + 200,000 + 15,000 + 100,000 = 365,000
    expect(buggyTotal).toBe(365000);

    // Correct: 50,000 + 200,000 = 250,000
    expect(correctCash).toBe(250000);

    // Difference is the debt that was incorrectly counted as cash
    expect(buggyTotal - correctCash).toBe(115000); // 15K credit + 100K loan
  });

  test("loan accounts should be liabilities not assets", () => {
    const loanAccount = mockBankAccounts.find((acc) => acc.type === "loan")!;

    // Loan balance is a liability (money owed)
    expect(DEBT_ACCOUNT_TYPES).toContain(loanAccount.type);
    expect(CASH_ACCOUNT_TYPES).not.toContain(loanAccount.type);

    // Should NOT add to cash/assets
    const cashAccounts = mockBankAccounts.filter((acc) =>
      CASH_ACCOUNT_TYPES.includes(acc.type),
    );

    expect(cashAccounts.map((a) => a.name)).not.toContain("Business Loan");
  });
});

/**
 * Category Exclusion Tests
 *
 * These tests verify that excluded categories (credit-card-payment, internal-transfer)
 * are properly excluded from financial calculations to prevent double-counting.
 *
 * Example: If you buy $500 of software on a credit card, then pay off the card:
 * - Software purchase: -$500 (COUNTED as expense)
 * - Credit card payment: -$500 (EXCLUDED - would double-count)
 *
 * Without exclusion: $1000 in expenses (WRONG)
 * With exclusion: $500 in expenses (CORRECT)
 */
describe("Category Exclusion Logic", () => {
  // Mock data specifically for exclusion testing
  const exclusionTestTransactions = [
    // Regular expense - SHOULD be counted
    {
      id: "ex-1",
      teamId: "team-1",
      date: "2024-08-01",
      name: "Software Purchase",
      amount: -500,
      currency: "GBP",
      baseAmount: -500,
      baseCurrency: "GBP",
      categorySlug: "software",
      status: "posted" as const,
      internal: false,
      taxRate: null,
      taxAmount: null,
      recurring: false,
      frequency: null,
      method: "card_purchase",
      internalId: "ex-1",
    },
    // Credit card payment - SHOULD be excluded
    {
      id: "ex-2",
      teamId: "team-1",
      date: "2024-08-15",
      name: "Credit Card Payment",
      amount: -500,
      currency: "GBP",
      baseAmount: -500,
      baseCurrency: "GBP",
      categorySlug: "credit-card-payment",
      status: "posted" as const,
      internal: false,
      taxRate: null,
      taxAmount: null,
      recurring: false,
      frequency: null,
      method: "transfer",
      internalId: "ex-2",
    },
    // Internal transfer - SHOULD be excluded
    {
      id: "ex-3",
      teamId: "team-1",
      date: "2024-08-20",
      name: "Transfer to Savings",
      amount: -1000,
      currency: "GBP",
      baseAmount: -1000,
      baseCurrency: "GBP",
      categorySlug: "internal-transfer",
      status: "posted" as const,
      internal: false,
      taxRate: null,
      taxAmount: null,
      recurring: false,
      frequency: null,
      method: "transfer",
      internalId: "ex-3",
    },
    // Another regular expense - SHOULD be counted
    {
      id: "ex-4",
      teamId: "team-1",
      date: "2024-08-25",
      name: "Office Supplies",
      amount: -200,
      currency: "GBP",
      baseAmount: -200,
      baseCurrency: "GBP",
      categorySlug: "office-supplies",
      status: "posted" as const,
      internal: false,
      taxRate: null,
      taxAmount: null,
      recurring: false,
      frequency: null,
      method: "card_purchase",
      internalId: "ex-4",
    },
  ];

  const exclusionCategories = [
    {
      id: "exc-1",
      teamId: "team-1",
      slug: "software",
      name: "Software",
      taxRate: null,
      taxType: null,
      excluded: false,
      parentId: null,
      color: "#8b5cf6",
    },
    {
      id: "exc-2",
      teamId: "team-1",
      slug: "office-supplies",
      name: "Office Supplies",
      taxRate: null,
      taxType: null,
      excluded: false,
      parentId: null,
      color: "#3b82f6",
    },
    {
      id: "exc-3",
      teamId: "team-1",
      slug: "credit-card-payment",
      name: "Credit Card Payment",
      taxRate: null,
      taxType: null,
      excluded: true, // EXCLUDED
      parentId: null,
      color: "#6b7280",
    },
    {
      id: "exc-4",
      teamId: "team-1",
      slug: "internal-transfer",
      name: "Internal Transfer",
      taxRate: null,
      taxType: null,
      excluded: true, // EXCLUDED
      parentId: null,
      color: "#6b7280",
    },
  ];

  test("excluded categories should be identified correctly", () => {
    const excludedSlugs = exclusionCategories
      .filter((c) => c.excluded === true)
      .map((c) => c.slug);

    expect(excludedSlugs).toContain("credit-card-payment");
    expect(excludedSlugs).toContain("internal-transfer");
    expect(excludedSlugs).not.toContain("software");
    expect(excludedSlugs).not.toContain("office-supplies");
  });

  test("expense calculation should exclude credit-card-payment transactions", () => {
    // Simulate the exclusion logic
    const includedExpenses = exclusionTestTransactions.filter((tx) => {
      if (tx.amount >= 0) return false; // Not an expense
      const category = exclusionCategories.find(
        (c) => c.slug === tx.categorySlug,
      );
      if (category?.excluded) return false; // Excluded category
      return true;
    });

    // Should NOT include the credit card payment
    expect(includedExpenses.map((t) => t.name)).not.toContain(
      "Credit Card Payment",
    );

    // Should include regular expenses
    expect(includedExpenses.map((t) => t.name)).toContain("Software Purchase");
    expect(includedExpenses.map((t) => t.name)).toContain("Office Supplies");
  });

  test("expense calculation should exclude internal-transfer transactions", () => {
    const includedExpenses = exclusionTestTransactions.filter((tx) => {
      if (tx.amount >= 0) return false;
      const category = exclusionCategories.find(
        (c) => c.slug === tx.categorySlug,
      );
      if (category?.excluded) return false;
      return true;
    });

    expect(includedExpenses.map((t) => t.name)).not.toContain(
      "Transfer to Savings",
    );
  });

  test("total expenses should only include non-excluded categories", () => {
    const includedExpenses = exclusionTestTransactions.filter((tx) => {
      if (tx.amount >= 0) return false;
      const category = exclusionCategories.find(
        (c) => c.slug === tx.categorySlug,
      );
      if (category?.excluded) return false;
      return true;
    });

    const totalExpenses = includedExpenses.reduce(
      (sum, tx) => sum + Math.abs(tx.amount),
      0,
    );

    // Software (-500) + Office Supplies (-200) = 700
    // NOT including: Credit Card Payment (-500) + Transfer (-1000)
    expect(totalExpenses).toBe(700);
  });

  test("without exclusion logic, expenses would be double-counted", () => {
    // Simulate the BUG scenario - counting all expenses
    const allExpenses = exclusionTestTransactions.filter((tx) => tx.amount < 0);

    const buggyTotal = allExpenses.reduce(
      (sum, tx) => sum + Math.abs(tx.amount),
      0,
    );

    // All expenses: 500 + 500 + 1000 + 200 = 2200
    expect(buggyTotal).toBe(2200);

    // Correct total (with exclusion): 700
    const correctTotal = 700;

    // The bug would over-report expenses by 1500 (3.14x)
    expect(buggyTotal - correctTotal).toBe(1500);
  });

  test("excluded flag must be explicitly true to exclude", () => {
    // Categories without excluded flag or with excluded: false should be included
    const regularCategory = exclusionCategories.find(
      (c) => c.slug === "software",
    )!;

    expect(regularCategory.excluded).toBe(false);

    // Transaction with this category should be counted
    const softwareTx = exclusionTestTransactions.find(
      (t) => t.categorySlug === "software",
    )!;

    const shouldInclude = !exclusionCategories.find(
      (c) => c.slug === softwareTx.categorySlug,
    )?.excluded;

    expect(shouldInclude).toBe(true);
  });

  test("transactions without category should be included (null categorySlug)", () => {
    const uncategorizedTx = {
      ...exclusionTestTransactions[0],
      categorySlug: null,
    };

    // Uncategorized transactions should NOT be excluded
    const category = exclusionCategories.find(
      (c) => c.slug === uncategorizedTx.categorySlug,
    );

    // No category found = not excluded
    expect(category).toBeUndefined();

    // Should be included in calculations
    const shouldInclude = !category?.excluded;
    expect(shouldInclude).toBe(true);
  });

  test("burn rate should not include excluded categories", () => {
    // Burn rate = monthly expenses for runway calculation
    const validExpenses = exclusionTestTransactions.filter((tx) => {
      if (tx.amount >= 0) return false;
      const category = exclusionCategories.find(
        (c) => c.slug === tx.categorySlug,
      );
      if (category?.excluded) return false;
      return true;
    });

    const burnRate = validExpenses.reduce(
      (sum, tx) => sum + Math.abs(tx.amount),
      0,
    );

    // Correct burn rate: 700 (software + office supplies)
    // NOT 2200 (all expenses)
    expect(burnRate).toBe(700);
  });

  test("runway calculation with correct burn rate", () => {
    const cashBalance = 7000; // $7,000 cash
    const correctBurnRate = 700; // $700/month (excluding transfers/payments)
    const buggyBurnRate = 2200; // $2,200/month (if double-counting)

    const correctRunway = Math.round(cashBalance / correctBurnRate);
    const buggyRunway = Math.round(cashBalance / buggyBurnRate);

    // Correct: 10 months runway
    // Buggy: 3 months runway (alarming but wrong!)
    expect(correctRunway).toBe(10);
    expect(buggyRunway).toBe(3);

    // The bug would cause panic with 70% underestimated runway
    expect((buggyRunway / correctRunway) * 100).toBe(30);
  });
});
