import Foundation
import Observation

@MainActor @Observable
final class TamiasStore {
    private(set) var isDemo = true
    private(set) var isLoading = false
    var errorMessage: String?
    private(set) var dataWarnings: [String] = []
    private(set) var user: TamiasUser?
    private(set) var currency = "GBP"
    private(set) var accounts: [BankAccount] = []
    private(set) var transactions: [TamiasTransaction] = []
    private(set) var invoices: [TamiasInvoice] = []
    private(set) var inboxItems: [InboxItem] = []
    private(set) var customers: [Customer] = []
    private(set) var cashflow: [CashflowPoint] = []
    private(set) var localDrafts: [InvoiceDraft] = []
    private(set) var capturedReceipts: [ReceiptCapture] = []
    private(set) var lastRefreshed: Date?
    private(set) var balancesAvailable = false
    private(set) var cashflowAvailable = false
    private(set) var invoiceSummaryAvailable = false
    private(set) var needsReauthentication = false
    var overviewAvailable: Bool { balancesAvailable && cashflowAvailable && invoiceSummaryAvailable }
    private(set) var hasMoreTransactions = false
    private(set) var hasMoreInvoices = false
    private(set) var hasMoreInbox = false
    private(set) var isLoadingMore = false
    private(set) var categories: [TransactionCategory] = []
    private(set) var isPerformingAction = false
    private(set) var snapshotDate: Date?
    private(set) var isUsingOfflineSnapshot = false
    var isSnapshotStale: Bool { !isDemo && (isUsingOfflineSnapshot || !dataWarnings.isEmpty || (lastRefreshed.map { Date.now.timeIntervalSince($0) > 300 } ?? true)) }
    var workspaceID: String { vault?.namespace ?? "unverified" }

    private(set) var transactionFilters = TransactionFilters()
    private(set) var transactionResults: [TamiasTransaction] = []
    private(set) var isSearchingTransactions = false
    private(set) var hasMoreTransactionResults = false
    private(set) var transactionSearchError: String?
    private(set) var transactionResultsAreCached = false
    private(set) var invoiceFilters = InvoiceFilters()
    private(set) var invoiceResults: [TamiasInvoice] = []
    private(set) var isSearchingInvoices = false
    private(set) var hasMoreInvoiceResults = false
    private(set) var invoiceSearchError: String?
    private(set) var invoiceResultsAreCached = false
    private(set) var inboxFilters = InboxFilters()
    private(set) var inboxResults: [InboxItem] = []
    private(set) var isSearchingInbox = false
    private(set) var hasMoreInboxResults = false
    private(set) var inboxSearchError: String?
    private(set) var inboxResultsAreCached = false

    @ObservationIgnored private var api: TamiasAPIClient
    @ObservationIgnored private let credentials: any CredentialStorage
    @ObservationIgnored private let localRoot: URL
    @ObservationIgnored private let uiTesting: Bool
    @ObservationIgnored private var credential: SessionCredential?
    @ObservationIgnored private var generation = UUID()
    @ObservationIgnored private var transactionsCursor: String?
    @ObservationIgnored private var invoicesCursor: String?
    @ObservationIgnored private var inboxCursor: String?
    @ObservationIgnored private var isSavingReceipt = false
    @ObservationIgnored private var transactionSearchGeneration = UUID()
    @ObservationIgnored private var invoiceSearchGeneration = UUID()
    @ObservationIgnored private var inboxSearchGeneration = UUID()
    @ObservationIgnored private var transactionResultCursor: String?
    @ObservationIgnored private var invoiceResultCursor: String?
    @ObservationIgnored private var inboxResultCursor: String?
    @ObservationIgnored private var renewalTask: Task<SessionCredential, Error>?
    private var invoiceSummary: InvoiceSummaryDTO?

    var isAuthenticated: Bool { !isDemo && credential != nil }
    var teamName: String { user?.team?.name ?? (isDemo ? "Northstar Studio" : "Your workspace") }
    var firstName: String { user?.fullName.split(separator: " ").first.map(String.init) ?? "there" }
    var balance: Double {
        accounts.filter { $0.isCashAccount && $0.currency == currency }.reduce(0) { $0 + ($1.balance ?? 0) }
    }
    var monthlyIncome: Double { cashflow.last?.income ?? 0 }
    var monthlyExpenses: Double { cashflow.last?.expense ?? 0 }
    var outstandingAmount: Double { invoiceSummary?.totalAmount ?? 0 }
    var outstandingCount: Int { invoiceSummary?.invoiceCount ?? 0 }
    var incomeChange: Double? {
        guard cashflow.count > 1 else { return nil }
        let previous = cashflow[cashflow.count - 2].income
        guard previous > 0 else { return nil }
        return ((monthlyIncome - previous) / previous) * 100
    }
    var unconvertedAccountCurrencies: [String] {
        Array(Set(accounts.filter { $0.isCashAccount && $0.currency != currency && !$0.currency.isEmpty }.map(\.currency))).sorted()
    }

    init(api: TamiasAPIClient = TamiasAPIClient(), credentials: any CredentialStorage = KeychainCredentialStore(),
         localStorageRoot: URL? = nil, demoMode: Bool? = nil, now: Date = .now) {
        self.api = api
        self.credentials = credentials
        self.uiTesting = ProcessInfo.processInfo.arguments.contains("-ui-testing")
        let applicationSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        self.localRoot = localStorageRoot ?? applicationSupport.appendingPathComponent(uiTesting ? "TamiasUITesting" : "TamiasNative", isDirectory: true)
        if uiTesting && ProcessInfo.processInfo.arguments.contains("-reset-ui-testing") && localStorageRoot == nil {
            try? FileManager.default.removeItem(at: localRoot)
        }
        if !uiTesting && demoMode != true {
            do { credential = try credentials.read() }
            catch { errorMessage = error.localizedDescription }
        }
        isDemo = credential == nil
        user = credential?.profile
        self.api = api.scoped(to: user?.team?.id)
        if isDemo {
            applySampleData(now: now)
        }
        loadLocalData()
        if !isDemo { restoreSnapshot() }
        transactionResults = transactions
        invoiceResults = invoices
        inboxResults = inboxItems
    }

    func signIn(email: String, password: String) async throws {
        guard !isLoading else { throw TamiasAPIError.busy }
        isLoading = true
        defer { isLoading = false }
        let activeGeneration = generation
        let bootstrap = api.scoped(to: nil)
        let tokens = try await bootstrap.signIn(email: email, password: password)
        let profile = try await bootstrap.currentUser(token: tokens.token)
        guard generation == activeGeneration else { throw CancellationError() }
        let verifiedCredential = tokens.withProfile(profile)
        try credentials.save(verifiedCredential)
        generation = UUID()
        clearRemoteData()
        credential = verifiedCredential
        user = profile
        api = api.scoped(to: profile.team?.id)
        isDemo = false
        errorMessage = nil
        loadLocalData()
        restoreSnapshot()
        await refreshConnectedWorkspace()
    }

    func connect(apiKey: String) async throws {
        guard !isLoading else { throw TamiasAPIError.busy }
        let key = apiKey.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !key.isEmpty, !key.contains(where: \.isWhitespace) else { throw TamiasAPIError.invalidCredential }
        isLoading = true
        defer { isLoading = false }
        let activeGeneration = generation
        let profile = try await api.scoped(to: nil).currentUser(token: key)
        guard generation == activeGeneration else { throw CancellationError() }
        let tokens = SessionCredential(token: key, refreshToken: nil, profile: profile)
        try credentials.save(tokens)
        generation = UUID()
        clearRemoteData()
        credential = tokens
        user = profile
        api = api.scoped(to: profile.team?.id)
        isDemo = false
        errorMessage = nil
        loadLocalData()
        restoreSnapshot()
        await refreshConnectedWorkspace()
    }

    func refresh() async {
        guard !isLoading, !isLoadingMore else { return }
        if isDemo { return }
        isLoading = true
        defer { isLoading = false }
        await refreshConnectedWorkspace()
    }

    /// Removes this device's credential. It does not sign out other devices or change the workspace.
    func signOut() {
        do { if !uiTesting { try credentials.delete() } }
        catch { errorMessage = error.localizedDescription; return }
        try? vault?.removeSnapshot()
        renewalTask?.cancel()
        renewalTask = nil
        generation = UUID()
        credential = nil
        clearRemoteData()
        isDemo = true
        errorMessage = nil
        applySampleData(now: .now)
        loadLocalData()
    }

    func enterDemoMode() { signOut() }

    func saveDraft(_ draft: InvoiceDraft) throws {
        guard !draft.customerName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              draft.amount.isFinite, draft.amount > 0 else { throw StorageError.invalidDraft }
        try validateInvoiceLines(draft)
        guard LocalVault.validCurrency(draft.currency) else { throw StorageError.invalidCurrency }
        if let current = localDrafts.first(where: { $0.id == draft.id }) {
            if current.submittedInvoiceID != nil { throw WorkflowError.alreadySubmitted }
            if current.pendingSubmission != nil && current != draft { throw WorkflowError.pendingSubmission }
            if current.remoteDraftID != draft.remoteDraftID { throw WorkflowError.reviewChanged }
        }
        guard let vault else { throw TamiasAPIError.unauthenticated }
        var newDrafts = localDrafts.filter { $0.id != draft.id }
        newDrafts.insert(draft, at: 0)
        try vault.saveDrafts(newDrafts)
        localDrafts = newDrafts
    }

    func deleteDraft(id: UUID) throws {
        guard let vault else { throw TamiasAPIError.unauthenticated }
        if localDrafts.first(where: { $0.id == id })?.pendingSubmission != nil { throw WorkflowError.pendingSubmission }
        let newDrafts = localDrafts.filter { $0.id != id }
        try vault.saveDrafts(newDrafts)
        localDrafts = newDrafts
    }

    @discardableResult
    func saveLocalReceipt(data: Data, fileExtension: String, merchant: String?, amount: String?, currency: String,
                          note: String?, receiptDate: Date? = nil, expectedWorkspaceID: String? = nil,
                          sourceImportID: UUID? = nil) async throws -> ReceiptCapture {
        if let expectedWorkspaceID, expectedWorkspaceID != workspaceID { throw WorkflowError.workspaceChanged }
        guard !isSavingReceipt else { throw StorageError.saveInProgress }
        guard let vault else { throw TamiasAPIError.unauthenticated }
        isSavingReceipt = true
        defer { isSavingReceipt = false }
        if let sourceImportID, let existing = capturedReceipts.first(where: { $0.sourceImportID == sourceImportID }),
           vault.receiptURL(existing) != nil { return existing }
        let activeGeneration = generation
        let saved = try await Task.detached(priority: .userInitiated) {
            try vault.saveReceipt(data: data, fileExtension: fileExtension, merchant: merchant,
                                  amount: amount, currency: currency, note: note, existing: [], receiptDate: receiptDate,
                                  sourceImportID: sourceImportID, persistIndex: false)
        }.value
        let current = generation == activeGeneration ? capturedReceipts : try vault.loadReceipts()
        let updated = [saved] + current.filter { $0.id != saved.id }
        try vault.saveReceipts(updated)
        if generation == activeGeneration { capturedReceipts = updated }
        else if expectedWorkspaceID != nil { throw WorkflowError.workspaceChanged }
        return saved
    }

    func receiptFileURL(for receipt: ReceiptCapture) -> URL? { vault?.receiptURL(receipt) }

    func loadMoreTransactions() async {
        guard !isDemo, !isLoading, !isLoadingMore, hasMoreTransactions, let cursor = transactionsCursor else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }
        let activeGeneration = generation
        do {
            let page = try await withToken { try await api.transactions(token: $0, cursor: cursor) }
            guard activeGeneration == generation else { return }
            let existing = Set(transactions.map(\.id))
            transactions.append(contentsOf: page.data.filter { !existing.contains($0.id) })
            transactionsCursor = page.meta?.cursor
            hasMoreTransactions = page.meta?.hasNextPage == true && page.meta?.cursor != cursor
            persistSnapshot()
        } catch { if activeGeneration == generation { errorMessage = error.localizedDescription } }
    }

    func loadMoreInvoices() async {
        guard !isDemo, !isLoading, !isLoadingMore, hasMoreInvoices, let cursor = invoicesCursor else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }
        let activeGeneration = generation
        do {
            let page = try await withToken { try await api.invoices(token: $0, cursor: cursor) }
            guard activeGeneration == generation else { return }
            let existing = Set(invoices.map(\.id))
            invoices.append(contentsOf: page.data.filter { !existing.contains($0.id) })
            invoicesCursor = page.meta?.cursor
            hasMoreInvoices = page.meta?.hasNextPage == true && page.meta?.cursor != cursor
            persistSnapshot()
        } catch { if activeGeneration == generation { errorMessage = error.localizedDescription } }
    }

    func loadMoreInbox() async {
        guard !isDemo, !isLoading, !isLoadingMore, hasMoreInbox, let cursor = inboxCursor else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }
        let activeGeneration = generation
        do {
            let page = try await withToken { try await api.inbox(token: $0, cursor: cursor) }
            guard activeGeneration == generation else { return }
            let existing = Set(inboxItems.map(\.id))
            inboxItems.append(contentsOf: page.data.filter { !existing.contains($0.id) })
            inboxCursor = page.meta?.cursor
            hasMoreInbox = page.meta?.hasNextPage == true && page.meta?.cursor != cursor
            persistSnapshot()
        } catch { if activeGeneration == generation { errorMessage = error.localizedDescription } }
    }

    private var vault: LocalVault? {
        if isDemo { return LocalVault(rootURL: localRoot, namespace: "demo") }
        guard let user else { return nil }
        return LocalVault(rootURL: localRoot, namespace: LocalVault.workspaceNamespace(user: user))
    }

    private func loadLocalData() {
        localDrafts = []
        capturedReceipts = []
        guard let vault else { return }
        do {
            localDrafts = try vault.loadDrafts()
            capturedReceipts = try vault.loadReceipts()
        } catch { errorMessage = "Your local files could not be read. \(error.localizedDescription)" }
    }

    private func refreshConnectedWorkspace() async {
        guard var activeCredential = credential else { return }
        var activeGeneration = generation
        errorMessage = nil
        dataWarnings = []
        do {
            // An explicit refresh re-resolves the selected workspace; all data requests below are pinned.
            let profile = try await withToken { try await api.scoped(to: nil).currentUser(token: $0) }
            guard let refreshedCredential = credential else { throw TamiasAPIError.unauthenticated }
            activeCredential = refreshedCredential
            guard activeGeneration == generation else { return }
            if activeCredential.profile != profile {
                activeCredential = activeCredential.withProfile(profile)
                try credentials.save(activeCredential)
                credential = activeCredential
            }
            needsReauthentication = false
            let previousNamespace = user.map(LocalVault.workspaceNamespace)
            if previousNamespace != LocalVault.workspaceNamespace(user: profile) {
                generation = UUID()
                activeGeneration = generation
                clearRemoteData()
                user = profile
                loadLocalData()
            } else { user = profile }
            api = api.scoped(to: profile.team?.id)

            let token = activeCredential.token
            async let accountResult = Self.result { try await self.api.bankAccounts(token: token) }
            async let summaryResult = Self.result { try await self.api.invoiceSummary(token: token) }
            async let transactionResult = Self.result { try await self.api.transactions(token: token) }
            async let invoiceResult = Self.result { try await self.api.invoices(token: token) }
            async let inboxResult = Self.result { try await self.api.inbox(token: token) }
            async let customerResult = Self.result { try await self.api.customers(token: token) }
            let (bankData, summaryData, transactionData, invoiceData, inboxData, customerData) = await
                (accountResult, summaryResult, transactionResult, invoiceResult, inboxResult, customerResult)
            guard activeGeneration == generation else { return }

            var warnings: [String] = []
            let accountsLoaded = apply(bankData, label: "Bank accounts", warnings: &warnings) { accounts = $0 }
            let summaryLoaded = apply(summaryData, label: "Invoice total", warnings: &warnings) { invoiceSummary = $0 }
            let nextCurrency = invoiceSummary?.currency.uppercased() ?? accounts.first(where: { $0.enabled && !$0.currency.isEmpty })?.currency ?? currency
            if nextCurrency != currency { cashflow = []; cashflowAvailable = false }
            currency = nextCurrency
            if accountsLoaded {
                balancesAvailable = !accounts.contains { $0.isCashAccount && ($0.currency.isEmpty || ($0.currency == currency && $0.balance == nil)) }
                if !balancesAvailable { warnings.append("Bank accounts: one or more balances or currencies are unavailable.") }
            }
            if summaryLoaded { invoiceSummaryAvailable = true }
            _ = apply(transactionData, label: "Transactions", warnings: &warnings) {
                transactions = $0.data
                transactionsCursor = $0.meta?.cursor
                hasMoreTransactions = $0.meta?.hasNextPage == true && $0.meta?.cursor != nil
            }
            _ = apply(invoiceData, label: "Invoices", warnings: &warnings) {
                invoices = $0.data
                invoicesCursor = $0.meta?.cursor
                hasMoreInvoices = $0.meta?.hasNextPage == true && $0.meta?.cursor != nil
            }
            _ = apply(inboxData, label: "Inbox", warnings: &warnings) {
                inboxItems = $0.data
                inboxCursor = $0.meta?.cursor
                hasMoreInbox = $0.meta?.hasNextPage == true && $0.meta?.cursor != nil
            }
            _ = apply(customerData, label: "Customers", warnings: &warnings) { page in
                let selectedIDs = Set(localDrafts.compactMap(\.customerID))
                let currentIDs = Set(page.data.map(\.id))
                customers = page.data + customers.filter { selectedIDs.contains($0.id) && !currentIDs.contains($0.id) }
            }
            let flowResult = await Self.result { try await self.api.cashflow(token: token, currency: self.currency) }
            guard activeGeneration == generation else { return }
            let flowLoaded = apply(flowResult, label: "Cash flow", warnings: &warnings) { cashflow = $0 }
            if flowLoaded { cashflowAvailable = true }
            dataWarnings = warnings
            if warnings.isEmpty { lastRefreshed = .now }
            else { errorMessage = "Some information could not be refreshed. Pull down to try again." }
            isUsingOfflineSnapshot = !warnings.isEmpty && snapshotDate != nil
            if warnings.isEmpty { persistSnapshot() }
            if transactionFilters.isEmpty { transactionResults = transactions; transactionResultsAreCached = isUsingOfflineSnapshot }
            if invoiceFilters.isEmpty { invoiceResults = invoices; invoiceResultsAreCached = isUsingOfflineSnapshot }
            if inboxFilters.isEmpty { inboxResults = inboxItems; inboxResultsAreCached = isUsingOfflineSnapshot }
        } catch {
            guard activeGeneration == generation else { return }
            errorMessage = error.localizedDescription
            needsReauthentication = (error as? TamiasAPIError) == .unauthenticated || (error as? TamiasAPIError) == .signInFailed
            isUsingOfflineSnapshot = snapshotDate != nil
        }
    }

    private func apply<T>(_ result: Result<T, Error>, label: String, warnings: inout [String], update: (T) -> Void) -> Bool {
        switch result {
        case .success(let value): update(value); return true
        case .failure(let error): warnings.append("\(label): \(error.localizedDescription)"); return false
        }
    }

    nonisolated private static func result<T>(_ action: () async throws -> T) async -> Result<T, Error> {
        do { return .success(try await action()) }
        catch { return .failure(error) }
    }

    private func clearRemoteData() {
        api = api.scoped(to: nil)
        user = nil
        accounts = []
        transactions = []
        invoices = []
        inboxItems = []
        customers = []
        cashflow = []
        localDrafts = []
        capturedReceipts = []
        invoiceSummary = nil
        lastRefreshed = nil
        balancesAvailable = false
        cashflowAvailable = false
        invoiceSummaryAvailable = false
        needsReauthentication = false
        hasMoreTransactions = false
        hasMoreInvoices = false
        hasMoreInbox = false
        transactionsCursor = nil
        invoicesCursor = nil
        inboxCursor = nil
        dataWarnings = []
        categories = []
        snapshotDate = nil
        isUsingOfflineSnapshot = false
        transactionSearchGeneration = UUID(); invoiceSearchGeneration = UUID(); inboxSearchGeneration = UUID()
        transactionResults = []; invoiceResults = []; inboxResults = []
        transactionFilters = .init(); invoiceFilters = .init(); inboxFilters = .init()
        transactionSearchError = nil; invoiceSearchError = nil; inboxSearchError = nil
        hasMoreTransactionResults = false; hasMoreInvoiceResults = false; hasMoreInboxResults = false
        transactionResultCursor = nil; invoiceResultCursor = nil; inboxResultCursor = nil
        transactionResultsAreCached = false; invoiceResultsAreCached = false; inboxResultsAreCached = false
        isSearchingTransactions = false; isSearchingInvoices = false; isSearchingInbox = false
    }

    private func applySampleData(now: Date) {
        let sample = SampleWorkspace(now: now)
        user = sample.user
        currency = "GBP"
        accounts = sample.accounts
        transactions = sample.transactions
        invoices = sample.invoices
        inboxItems = sample.inbox
        customers = sample.customers
        cashflow = sample.cashflow
        invoiceSummary = InvoiceSummaryDTO(currency: "GBP", totalAmount: 11_250, invoiceCount: 3)
        balancesAvailable = true
        cashflowAvailable = true
        invoiceSummaryAvailable = true
        categories = [
            TransactionCategory(id: "sample-software", slug: "software", name: "Software", color: "#65766b"),
            TransactionCategory(id: "sample-travel", slug: "travel", name: "Travel", color: "#b29977"),
            TransactionCategory(id: "sample-office", slug: "office-supplies", name: "Office supplies", color: "#a17e65"),
            TransactionCategory(id: "sample-meals", slug: "meals", name: "Meals & drinks", color: "#b29977"),
            TransactionCategory(id: "sample-income", slug: "income", name: "Client payment", color: "#65766b")
        ]
        transactionResults = transactions; invoiceResults = invoices; inboxResults = inboxItems
    }
}

// All user-triggered workflows keep their reviewed request and workspace identity through retries.
extension TamiasStore {
    private func restoreSnapshot() {
        guard let profile = credential?.profile, profile == user, let vault else { return }
        do {
            guard let saved = try vault.loadSnapshot(), saved.belongs(to: profile) else { return }
            currency = saved.currency; accounts = saved.accounts; transactions = saved.transactions
            invoices = saved.invoices; inboxItems = saved.inbox; customers = saved.customers; categories = saved.categories
            cashflow = saved.cashflow; invoiceSummary = saved.invoiceSummary
            balancesAvailable = saved.balancesAvailable; cashflowAvailable = saved.cashflowAvailable
            invoiceSummaryAvailable = saved.invoiceSummaryAvailable
            transactionsCursor = saved.transactionsCursor; invoicesCursor = saved.invoicesCursor; inboxCursor = saved.inboxCursor
            hasMoreTransactions = saved.hasMoreTransactions; hasMoreInvoices = saved.hasMoreInvoices; hasMoreInbox = saved.hasMoreInbox
            lastRefreshed = saved.fetchedAt; snapshotDate = saved.fetchedAt; isUsingOfflineSnapshot = true
            transactionResultsAreCached = true; invoiceResultsAreCached = true; inboxResultsAreCached = true
        } catch { errorMessage = "Saved workspace information could not be read. Connect to refresh it." }
    }

    private func persistSnapshot() {
        guard !isDemo, let user, let date = lastRefreshed, credential?.profile == user, let vault else { return }
        let saved = WorkspaceSnapshot(version: 1, userID: user.id, teamID: user.team?.id, fetchedAt: date,
            currency: currency, accounts: accounts, transactions: transactions, invoices: invoices.map {
                TamiasInvoice(id: $0.id, number: $0.number, customerName: $0.customerName, amount: $0.amount,
                    currency: $0.currency, status: $0.status, dueDate: $0.dueDate, issueDate: $0.issueDate,
                    note: $0.note, pdfURL: nil)
            }, inbox: inboxItems,
            customers: customers, categories: categories, cashflow: cashflow, invoiceSummary: invoiceSummary,
            balancesAvailable: balancesAvailable, cashflowAvailable: cashflowAvailable, invoiceSummaryAvailable: invoiceSummaryAvailable,
            transactionsCursor: transactionsCursor, invoicesCursor: invoicesCursor, inboxCursor: inboxCursor,
            hasMoreTransactions: hasMoreTransactions, hasMoreInvoices: hasMoreInvoices, hasMoreInbox: hasMoreInbox)
        do { try vault.saveSnapshot(saved); snapshotDate = date }
        catch { errorMessage = "The workspace refreshed, but its offline copy could not be saved." }
    }

    private func withToken<T>(_ operation: (String) async throws -> T) async throws -> T {
        guard !isDemo else { throw WorkflowError.demoWorkspace }
        guard let initial = credential else { throw TamiasAPIError.unauthenticated }
        let active = generation
        do {
            let value = try await operation(initial.token)
            guard generation == active else { throw WorkflowError.workspaceChanged }
            return value
        } catch TamiasAPIError.workspaceChanged {
            if generation == active {
                errorMessage = TamiasAPIError.workspaceChanged.localizedDescription
                isUsingOfflineSnapshot = snapshotDate != nil
            }
            throw TamiasAPIError.workspaceChanged
        } catch TamiasAPIError.unauthenticated {
            guard generation == active else { throw WorkflowError.workspaceChanged }
            if credential?.token == initial.token {
                let task: Task<SessionCredential, Error>
                if let existing = renewalTask { task = existing }
                else {
                    task = Task { try await api.refresh(credential: initial).withProfile(initial.profile) }
                    renewalTask = task
                }
                do {
                    let updated = try await task.value
                    guard generation == active else { throw WorkflowError.workspaceChanged }
                    if credential?.token == initial.token { try credentials.save(updated); credential = updated }
                    renewalTask = nil
                } catch {
                    if generation == active { renewalTask = nil; needsReauthentication = true }
                    throw error
                }
            }
            guard let token = credential?.token else { throw TamiasAPIError.unauthenticated }
            let value = try await operation(token)
            guard generation == active else { throw WorkflowError.workspaceChanged }
            needsReauthentication = false
            return value
        }
    }

    private func verifiedMutationToken(expectedWorkspaceID: String) async throws -> String {
        guard !isDemo else { throw WorkflowError.demoWorkspace }
        guard workspaceID == expectedWorkspaceID else { throw WorkflowError.workspaceChanged }
        let profile = try await withToken { try await api.currentUser(token: $0) }
        guard workspaceID == expectedWorkspaceID, LocalVault.workspaceNamespace(user: profile) == expectedWorkspaceID else {
            throw WorkflowError.workspaceChanged
        }
        guard let token = credential?.token else { throw TamiasAPIError.unauthenticated }
        return token
    }

    private func validateInvoiceLines(_ draft: InvoiceDraft) throws {
        guard !draft.lineItems.isEmpty, draft.lineItems.count <= 100,
              draft.lineItems.allSatisfy({ !$0.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && $0.quantity.isFinite && $0.quantity > 0 && $0.unitPrice.isFinite && $0.unitPrice >= 0 }),
              draft.amount.isFinite, draft.amount > 0 else { throw WorkflowError.invalidLines }
        guard draft.vatRate.isFinite, (0...100).contains(draft.vatRate) else { throw WorkflowError.invalidVAT }
    }

    func loadCategories() async {
        guard !isDemo else { return }
        do { categories = try await withToken { try await api.categories(token: $0) }; persistSnapshot() }
        catch { errorMessage = error.localizedDescription }
    }

    func loadTaxReport(year: Int) async throws -> SoleTraderReport {
        if isDemo { return SoleTraderReport.demo(year: year) }
        return try await withToken { try await api.taxReport(year: year, token: $0) }
    }

    func saveTaxProfile(_ profile: SoleTraderProfile, year: Int, expectedWorkspaceID: String) async throws -> SoleTraderReport {
        let token = try await verifiedMutationToken(expectedWorkspaceID: expectedWorkspaceID)
        let result = try await api.saveTaxProfile(profile, year: year, token: token)
        guard workspaceID == expectedWorkspaceID else { throw WorkflowError.workspaceChanged }
        return result
    }

    func reviewTaxTransactions(_ reviews: [TaxTransactionReview], year: Int, expectedWorkspaceID: String) async throws -> SoleTraderReport {
        let token = try await verifiedMutationToken(expectedWorkspaceID: expectedWorkspaceID)
        let result = try await api.reviewTaxTransactions(reviews, year: year, token: token)
        guard workspaceID == expectedWorkspaceID else { throw WorkflowError.workspaceChanged }
        return result
    }

    func exportTaxReport(_ report: SoleTraderReport, expectedWorkspaceID: String) async throws -> TaxExport {
        guard workspaceID == expectedWorkspaceID else { throw WorkflowError.workspaceChanged }
        return try await withToken { try await api.exportTaxReport(year: report.taxYear, fingerprint: report.fingerprint, token: $0) }
    }

    func loadTaxFilings(year: Int, expectedWorkspaceID: String) async throws -> TaxFilings {
        guard !isDemo else { throw WorkflowError.demoWorkspace }
        guard workspaceID == expectedWorkspaceID else { throw WorkflowError.workspaceChanged }
        return try await withToken { try await api.taxFilings(year: year, token: $0) }
    }

    func prepareTaxFiling(report: SoleTraderReport, identity: TaxFilingIdentity, expectedWorkspaceID: String) async throws -> TaxFiling {
        let token = try await verifiedMutationToken(expectedWorkspaceID: expectedWorkspaceID)
        let result = try await api.prepareTaxFiling(year: report.taxYear, fingerprint: report.fingerprint, identity: identity, token: token)
        guard workspaceID == expectedWorkspaceID else { throw WorkflowError.workspaceChanged }
        return result
    }

    func submitTaxFiling(year: Int, filing: TaxFiling, body: TaxFilingSubmission, expectedWorkspaceID: String) async throws -> TaxFiling {
        let token = try await verifiedMutationToken(expectedWorkspaceID: expectedWorkspaceID)
        let result = try await api.submitTaxFiling(year: year, id: filing.id, body: body, token: token)
        guard workspaceID == expectedWorkspaceID else { throw WorkflowError.workspaceChanged }
        return result
    }

    func pollTaxFiling(year: Int, id: String, expectedWorkspaceID: String) async throws -> TaxFiling {
        let token = try await verifiedMutationToken(expectedWorkspaceID: expectedWorkspaceID)
        let result = try await api.pollTaxFiling(year: year, id: id, token: token)
        guard workspaceID == expectedWorkspaceID else { throw WorkflowError.workspaceChanged }
        return result
    }

    func taxFilingEvidence(year: Int, id: String, expectedWorkspaceID: String) async throws -> TaxFilingEvidence {
        guard workspaceID == expectedWorkspaceID else { throw WorkflowError.workspaceChanged }
        return try await withToken { try await api.taxFilingEvidence(year: year, id: id, token: $0) }
    }

    func searchCustomers(query: String) async throws -> [Customer] {
        let term = query.trimmingCharacters(in: .whitespacesAndNewlines)
        if isDemo { return customers.filter { term.isEmpty || $0.name.localizedCaseInsensitiveContains(term) || $0.email.localizedCaseInsensitiveContains(term) } }
        let page = try await withToken { try await api.customers(token: $0, query: term) }
        let ids = Set(page.data.map(\.id))
        customers = customers.filter { !ids.contains($0.id) } + page.data
        persistSnapshot()
        return page.data
    }

    @discardableResult
    func updateTransaction(id: String, categorySlug: String?, note: String?, markReviewed: Bool = false) async throws -> TamiasTransaction {
        guard !isPerformingAction else { throw TamiasAPIError.busy }
        isPerformingAction = true; defer { isPerformingAction = false }
        let expected = workspaceID
        let token = try await verifiedMutationToken(expectedWorkspaceID: expected)
        let result = try await api.updateTransaction(id: id, categorySlug: categorySlug, note: note, markReviewed: markReviewed, token: token)
        guard workspaceID == expected else { throw WorkflowError.workspaceChanged }
        replaceTransaction(result); persistSnapshot()
        return result
    }

    private func replaceTransaction(_ item: TamiasTransaction) {
        if let index = transactions.firstIndex(where: { $0.id == item.id }) { transactions[index] = item }
        if let index = transactionResults.firstIndex(where: { $0.id == item.id }) {
            if transactionFilters.matches(item) { transactionResults[index] = item }
            else { transactionResults.remove(at: index) }
        }
    }

    private func searchFailureMessage(_ error: Error) -> String {
        if let network = error as? URLError,
           [.notConnectedToInternet, .networkConnectionLost, .cannotConnectToHost, .cannotFindHost, .dnsLookupFailed, .timedOut].contains(network.code) {
            return WorkflowError.offlineSearch.localizedDescription
        }
        return error.localizedDescription + " Showing matching saved items only."
    }

    func searchTransactions(_ filters: TransactionFilters) async {
        let search = UUID(); transactionSearchGeneration = search
        transactionFilters = filters; transactionResultCursor = nil; hasMoreTransactionResults = false
        transactionSearchError = nil; isSearchingTransactions = true
        defer { if transactionSearchGeneration == search { isSearchingTransactions = false } }
        if isDemo { transactionResults = transactions.filter(filters.matches); transactionResultsAreCached = false; return }
        do {
            let page = try await withToken { try await api.transactions(token: $0, filters: filters) }
            guard transactionSearchGeneration == search else { return }
            transactionResults = page.data; transactionResultCursor = page.meta?.cursor
            hasMoreTransactionResults = page.meta?.hasNextPage == true && page.meta?.cursor != nil
            transactionResultsAreCached = false
        } catch {
            guard transactionSearchGeneration == search else { return }
            transactionResults = transactions.filter(filters.matches); transactionResultsAreCached = true
            transactionSearchError = searchFailureMessage(error)
        }
    }

    func loadMoreTransactionResults() async {
        guard !isDemo, !isSearchingTransactions, hasMoreTransactionResults, let cursor = transactionResultCursor else { return }
        let search = transactionSearchGeneration; let filters = transactionFilters
        isSearchingTransactions = true; defer { if transactionSearchGeneration == search { isSearchingTransactions = false } }
        do {
            let page = try await withToken { try await api.transactions(token: $0, cursor: cursor, filters: filters) }
            guard transactionSearchGeneration == search else { return }
            let ids = Set(transactionResults.map(\.id)); transactionResults += page.data.filter { !ids.contains($0.id) }
            transactionResultCursor = page.meta?.cursor
            hasMoreTransactionResults = page.meta?.hasNextPage == true && page.meta?.cursor != nil && page.meta?.cursor != cursor
            transactionSearchError = nil
        } catch { if transactionSearchGeneration == search { transactionSearchError = error.localizedDescription } }
    }

    func searchInvoices(_ filters: InvoiceFilters) async {
        let search = UUID(); invoiceSearchGeneration = search
        invoiceFilters = filters; invoiceResultCursor = nil; hasMoreInvoiceResults = false
        invoiceSearchError = nil; isSearchingInvoices = true
        defer { if invoiceSearchGeneration == search { isSearchingInvoices = false } }
        if isDemo { invoiceResults = invoices.filter(filters.matches); invoiceResultsAreCached = false; return }
        do {
            let page = try await withToken { try await api.invoices(token: $0, filters: filters) }
            guard invoiceSearchGeneration == search else { return }
            invoiceResults = page.data; invoiceResultCursor = page.meta?.cursor
            hasMoreInvoiceResults = page.meta?.hasNextPage == true && page.meta?.cursor != nil
            invoiceResultsAreCached = false
        } catch {
            guard invoiceSearchGeneration == search else { return }
            invoiceResults = invoices.filter(filters.matches); invoiceResultsAreCached = true
            invoiceSearchError = searchFailureMessage(error)
        }
    }

    func loadMoreInvoiceResults() async {
        guard !isDemo, !isSearchingInvoices, hasMoreInvoiceResults, let cursor = invoiceResultCursor else { return }
        let search = invoiceSearchGeneration; let filters = invoiceFilters
        isSearchingInvoices = true; defer { if invoiceSearchGeneration == search { isSearchingInvoices = false } }
        do {
            let page = try await withToken { try await api.invoices(token: $0, cursor: cursor, filters: filters) }
            guard invoiceSearchGeneration == search else { return }
            let ids = Set(invoiceResults.map(\.id)); invoiceResults += page.data.filter { !ids.contains($0.id) }
            invoiceResultCursor = page.meta?.cursor
            hasMoreInvoiceResults = page.meta?.hasNextPage == true && page.meta?.cursor != nil && page.meta?.cursor != cursor
            invoiceSearchError = nil
        } catch { if invoiceSearchGeneration == search { invoiceSearchError = error.localizedDescription } }
    }

    func searchInbox(_ filters: InboxFilters) async {
        let search = UUID(); inboxSearchGeneration = search
        inboxFilters = filters; inboxResultCursor = nil; hasMoreInboxResults = false
        inboxSearchError = nil; isSearchingInbox = true
        defer { if inboxSearchGeneration == search { isSearchingInbox = false } }
        if isDemo { inboxResults = inboxItems.filter(filters.matches); inboxResultsAreCached = false; return }
        do {
            let page = try await withToken { try await api.inbox(token: $0, filters: filters) }
            guard inboxSearchGeneration == search else { return }
            inboxResults = page.data; inboxResultCursor = page.meta?.cursor
            hasMoreInboxResults = page.meta?.hasNextPage == true && page.meta?.cursor != nil
            inboxResultsAreCached = false
        } catch {
            guard inboxSearchGeneration == search else { return }
            inboxResults = inboxItems.filter(filters.matches); inboxResultsAreCached = true
            inboxSearchError = searchFailureMessage(error)
        }
    }

    func loadMoreInboxResults() async {
        guard !isDemo, !isSearchingInbox, hasMoreInboxResults, let cursor = inboxResultCursor else { return }
        let search = inboxSearchGeneration; let filters = inboxFilters
        isSearchingInbox = true; defer { if inboxSearchGeneration == search { isSearchingInbox = false } }
        do {
            let page = try await withToken { try await api.inbox(token: $0, cursor: cursor, filters: filters) }
            guard inboxSearchGeneration == search else { return }
            let ids = Set(inboxResults.map(\.id)); inboxResults += page.data.filter { !ids.contains($0.id) }
            inboxResultCursor = page.meta?.cursor
            hasMoreInboxResults = page.meta?.hasNextPage == true && page.meta?.cursor != nil && page.meta?.cursor != cursor
            inboxSearchError = nil
        } catch { if inboxSearchGeneration == search { inboxSearchError = error.localizedDescription } }
    }

    func prepareInvoiceSubmission(draftID: UUID, delivery: InvoiceDelivery) throws -> InvoiceSubmissionReview {
        guard !isDemo else { throw WorkflowError.demoWorkspace }
        guard let draft = localDrafts.first(where: { $0.id == draftID }) else { throw WorkflowError.missingLocalItem }
        guard draft.submittedInvoiceID == nil else { throw WorkflowError.alreadySubmitted }
        try validateInvoiceLines(draft)
        guard LocalVault.validCurrency(draft.currency) else { throw StorageError.invalidCurrency }
        guard let customer = draft.pendingSubmission?.reviewedCustomer ?? customers.first(where: { $0.id == draft.customerID }),
              customer.name == draft.customerName, customer.email == draft.customerEmail else { throw WorkflowError.customerRequired }
        if delivery != .draft {
            guard !draft.fromDetails.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw WorkflowError.senderRequired }
            guard !draft.paymentDetails.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw WorkflowError.paymentDetailsRequired }
        }
        if delivery == .createAndSend && !customer.email.contains("@") { throw WorkflowError.missingCustomerEmail }
        let payload = try InvoiceCreatePayload(draft: draft, delivery: delivery, billingEmails: customer.billingEmails)
        let pending: PendingInvoiceSubmission
        if let existing = draft.pendingSubmission {
            guard existing.delivery == delivery, existing.payload == payload, existing.expectedWorkspaceID == workspaceID else { throw WorkflowError.pendingSubmission }
            pending = existing
        } else {
            pending = PendingInvoiceSubmission(payload: payload, idempotencyKey: UUID().uuidString,
                remoteDraftID: draft.remoteDraftID, expectedWorkspaceID: workspaceID, reviewedCustomer: customer)
        }
        return InvoiceSubmissionReview(draftID: draft.id, customerName: customer.name, customerEmail: customer.email,
            billingEmails: customer.billingEmails, currency: draft.currency, subtotal: draft.subtotal, vatAmount: draft.vatAmount,
            total: draft.amount, delivery: delivery, pending: pending)
    }

    @discardableResult
    func submitInvoice(_ review: InvoiceSubmissionReview) async throws -> InvoiceSubmissionResult {
        guard !isPerformingAction else { throw TamiasAPIError.busy }
        isPerformingAction = true; defer { isPerformingAction = false }
        let expected = review.pending.expectedWorkspaceID
        let token = try await verifiedMutationToken(expectedWorkspaceID: expected)
        guard let activeVault = vault, var draft = localDrafts.first(where: { $0.id == review.draftID }) else { throw WorkflowError.missingLocalItem }
        guard draft.submittedInvoiceID == nil else { throw WorkflowError.alreadySubmitted }
        let latest = try prepareInvoiceSubmission(draftID: draft.id, delivery: review.delivery)
        guard latest.pending.payload == review.pending.payload, latest.pending.remoteDraftID == review.pending.remoteDraftID,
              draft.pendingSubmission == nil || draft.pendingSubmission == review.pending else { throw WorkflowError.reviewChanged }
        if draft.pendingSubmission == nil {
            let customer = try await api.customer(id: review.pending.payload.customerId, token: token)
            guard customer.name == review.customerName, customer.email == review.customerEmail,
                  customer.billingEmails == review.billingEmails else { throw WorkflowError.reviewChanged }
        }
        // A persisted request must reach the server with its original key: replay precedes the
        // server recipient guard, so a later customer edit cannot block reconciliation.
        guard workspaceID == expected, localDrafts.first(where: { $0.id == draft.id }) == draft else { throw WorkflowError.reviewChanged }
        draft.pendingSubmission = review.pending; draft.submissionError = nil
        try persistDraft(draft, in: activeVault)
        do {
            let result = try await api.submitInvoice(review.pending, token: token)
            guard UUID(uuidString: result.id) != nil,
                  (review.delivery == .draft ? result.status == "draft" : result.status != "draft"),
                  review.pending.remoteDraftID == nil || review.pending.remoteDraftID == result.id else { throw WorkflowError.invalidResponse }
            if review.delivery == .draft { draft.remoteDraftID = result.id }
            else { draft.submittedInvoiceID = result.id }
            draft.pendingSubmission = nil; draft.submissionError = nil
            try persistDraft(draft, in: activeVault)
            if workspaceID == expected {
                // A follow-up read failure cannot convert an accepted create/send into a failed submission.
                if let item = try? await api.invoice(id: result.id, token: token), workspaceID == expected {
                    invoices.removeAll { $0.id == item.id }; invoices.insert(item, at: 0)
                    invoiceResults.removeAll { $0.id == item.id }
                    if invoiceFilters.matches(item) { invoiceResults.insert(item, at: 0) }
                    persistSnapshot()
                }
            }
            return result
        } catch {
            // Only this explicit response guarantees no invoice was written, issued or queued.
            if (error as? TamiasAPIError) == .invoiceReviewChanged { draft.pendingSubmission = nil }
            draft.submissionError = error.localizedDescription
            try? persistDraft(draft, in: activeVault)
            throw error
        }
    }

    @discardableResult
    func syncInvoiceDraft(id: UUID) async throws -> InvoiceSubmissionResult {
        try await submitInvoice(prepareInvoiceSubmission(draftID: id, delivery: .draft))
    }

    private func persistDraft(_ draft: InvoiceDraft, in activeVault: LocalVault) throws {
        var values = workspaceID == activeVault.namespace ? localDrafts : try activeVault.loadDrafts()
        values.removeAll { $0.id == draft.id }; values.insert(draft, at: 0)
        try activeVault.saveDrafts(values)
        if workspaceID == activeVault.namespace { localDrafts = values }
    }

    func updateReceipt(id: UUID, merchant: String?, amount: String?, currency: String, receiptDate: Date?, note: String?, expectedWorkspaceID: String) throws {
        guard workspaceID == expectedWorkspaceID else { throw WorkflowError.workspaceChanged }
        guard let activeVault = vault, var receipt = capturedReceipts.first(where: { $0.id == id }) else { throw WorkflowError.missingLocalItem }
        guard receipt.remoteInboxID == nil, receipt.pendingUploadCompletion == nil, receipt.syncStatus != .uploading else { throw WorkflowError.receiptAlreadySynced }
        guard LocalVault.validCurrency(currency) else { throw StorageError.invalidCurrency }
        let raw = (amount ?? "").trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: ",", with: ".")
        let value = raw.isEmpty ? nil : Double(raw)
        guard raw.isEmpty || (value != nil && value!.isFinite && value! >= 0) else { throw StorageError.invalidAmount }
        receipt.name = (merchant ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if receipt.name.isEmpty { receipt.name = "New receipt" }
        receipt.amount = value; receipt.currency = currency.uppercased(); receipt.receiptDate = receiptDate; receipt.note = note
        try persistReceipt(receipt, in: activeVault)
    }

    @discardableResult
    func syncReceipt(id: UUID, expectedWorkspaceID: String? = nil) async throws -> ReceiptCapture {
        if let expectedWorkspaceID, expectedWorkspaceID != workspaceID { throw WorkflowError.workspaceChanged }
        guard !isPerformingAction else { throw TamiasAPIError.busy }
        isPerformingAction = true; defer { isPerformingAction = false }
        let expected = workspaceID
        let token = try await verifiedMutationToken(expectedWorkspaceID: expected)
        guard let activeVault = vault, var receipt = capturedReceipts.first(where: { $0.id == id }) else { throw WorkflowError.missingLocalItem }
        if receipt.remoteInboxID != nil { return receipt }
        guard let file = activeVault.receiptURL(receipt) else { throw WorkflowError.unavailableFile }
        receipt.syncStatus = .uploading; receipt.syncError = nil
        try persistReceipt(receipt, in: activeVault)
        do {
            if receipt.pendingUploadCompletion == nil {
                let bytes = try await Task.detached { try Data(contentsOf: file) }.value
                if receipt.uploadTicket == nil || receipt.uploadTicket!.expiresAt <= .now {
                    receipt.uploadTicket = try await api.createReceiptUpload(fileName: receipt.fileName, contentType: receipt.contentType, size: bytes.count, token: token)
                    try persistReceipt(receipt, in: activeVault)
                }
                guard workspaceID == expected, let ticket = receipt.uploadTicket else { throw WorkflowError.workspaceChanged }
                try await api.uploadReceiptBytes(bytes, ticket: ticket, contentType: receipt.contentType)
                receipt.uploadCompletionKey = UUID().uuidString
                receipt.pendingUploadCompletion = ReceiptUploadCompletion(uploadToken: ticket.uploadToken, displayName: receipt.name,
                    amount: receipt.amount, currency: receipt.currency, date: receipt.receiptDate.map(TamiasDates.apiString), note: receipt.note)
                try persistReceipt(receipt, in: activeVault)
            }
            guard workspaceID == expected, let completion = receipt.pendingUploadCompletion else { throw WorkflowError.workspaceChanged }
            let result = try await api.completeReceiptUpload(completion, key: receipt.uploadCompletionKey ?? "receipt-complete-\(receipt.id.uuidString)", token: token)
            receipt.remoteInboxID = result.id; receipt.syncStatus = .uploaded; receipt.syncError = nil
            receipt.uploadTicket = nil; receipt.pendingUploadCompletion = nil; receipt.uploadCompletionKey = nil
            try persistReceipt(receipt, in: activeVault)
            if workspaceID == expected {
                // Processing only proposes matches. Saving or syncing never attaches a receipt automatically.
                do { try await api.processReceipt(inboxID: result.id, key: "receipt-process-\(receipt.id.uuidString)", token: token) }
                catch { receipt.syncError = "Saved to Tamias. Automatic suggestions are unavailable; you can choose a transaction manually."; try? persistReceipt(receipt, in: activeVault) }
                if let item = try? await api.inboxItem(id: result.id, token: token), workspaceID == expected { replaceInboxItem(item); persistSnapshot() }
            }
            return receipt
        } catch {
            // This explicit server code is issued only after proving the original request was not applied.
            // All uncertain failures preserve the exact ticket, completion body and idempotency key.
            if (error as? TamiasAPIError) == .uploadTicketExpired {
                receipt.uploadTicket = nil; receipt.pendingUploadCompletion = nil; receipt.uploadCompletionKey = nil
            }
            receipt.syncStatus = .failed; receipt.syncError = error.localizedDescription
            try? persistReceipt(receipt, in: activeVault)
            throw error
        }
    }

    func receiptMatchSuggestions(id: UUID, query: String? = nil) async throws -> [ReceiptMatchSuggestion] {
        guard let receipt = capturedReceipts.first(where: { $0.id == id }) else { throw WorkflowError.missingLocalItem }
        if let remote = receipt.remoteInboxID { return try await inboxMatchSuggestions(id: remote, query: query) }
        let term = query?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if isDemo { return transactions.filter { $0.amount < 0 && (term.isEmpty || $0.name.localizedCaseInsensitiveContains(term)) }.map { .init(transaction: $0, score: nil, reasons: ["Choose a transaction"], suggestionID: nil) } }
        let page = try await withToken { try await api.transactions(token: $0, filters: TransactionFilters(query: term, type: .expense)) }
        return page.data.map { .init(transaction: $0, score: nil, reasons: ["Choose a transaction"], suggestionID: nil) }
    }

    func inboxMatchSuggestions(id: String, query: String? = nil) async throws -> [ReceiptMatchSuggestion] {
        let term = query?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !term.isEmpty {
            let page = try await withToken { try await api.transactions(token: $0, filters: TransactionFilters(query: term, type: .expense)) }
            return page.data.map { .init(transaction: $0, score: nil, reasons: ["Search result"], suggestionID: nil) }
        }
        return try await withToken { try await api.receiptSuggestions(inboxID: id, token: $0) }
    }

    @discardableResult
    func matchReceipt(localID: UUID, transactionID: String, expectedWorkspaceID: String? = nil) async throws -> ReceiptCapture {
        if let expectedWorkspaceID, expectedWorkspaceID != workspaceID { throw WorkflowError.workspaceChanged }
        guard var receipt = capturedReceipts.first(where: { $0.id == localID }), let activeVault = vault else { throw WorkflowError.missingLocalItem }
        if receipt.matchedTransactionID == transactionID { return receipt }
        guard receipt.matchedTransactionID == nil else { throw WorkflowError.receiptAlreadySynced }
        let expected = workspaceID
        if receipt.remoteInboxID == nil { receipt = try await syncReceipt(id: localID) }
        guard workspaceID == expected, let remote = receipt.remoteInboxID else { throw WorkflowError.workspaceChanged }
        try await matchInboxItem(inboxID: remote, transactionID: transactionID)
        receipt.matchedTransactionID = transactionID; receipt.syncStatus = .matched; receipt.syncError = nil
        try persistReceipt(receipt, in: activeVault)
        return receipt
    }

    func matchInboxItem(inboxID: String, transactionID: String) async throws {
        guard !isPerformingAction else { throw TamiasAPIError.busy }
        isPerformingAction = true; defer { isPerformingAction = false }
        let expected = workspaceID
        let token = try await verifiedMutationToken(expectedWorkspaceID: expected)
        guard let activeVault = vault else { throw TamiasAPIError.unauthenticated }
        let result = try await api.matchInboxItem(inboxID: inboxID, transactionID: transactionID,
            key: "receipt-match-\(inboxID)-\(transactionID)", token: token)
        guard result.id == inboxID, result.transactionId == transactionID, result.status == "done" else { throw WorkflowError.invalidResponse }
        let localCaptures = workspaceID == expected ? capturedReceipts : try activeVault.loadReceipts()
        for var local in localCaptures.filter({ $0.remoteInboxID == inboxID }) {
            local.matchedTransactionID = transactionID; local.syncStatus = .matched; local.syncError = nil
            try persistReceipt(local, in: activeVault)
        }
        if workspaceID == expected {
            if let item = try? await api.inboxItem(id: inboxID, token: token), workspaceID == expected { replaceInboxItem(item) }
            if let transaction = try? await api.transaction(id: transactionID, token: token), workspaceID == expected { replaceTransaction(transaction) }
            persistSnapshot()
        }
    }

    func inboxFileURL(id: String) async throws -> URL {
        try await withToken { try await api.inboxFileURL(id: id, token: $0) }
    }

    private func persistReceipt(_ receipt: ReceiptCapture, in activeVault: LocalVault) throws {
        var values = workspaceID == activeVault.namespace ? capturedReceipts : try activeVault.loadReceipts()
        values.removeAll { $0.id == receipt.id }; values.insert(receipt, at: 0)
        try activeVault.saveReceipts(values)
        if workspaceID == activeVault.namespace { capturedReceipts = values }
    }

    private func replaceInboxItem(_ item: InboxItem) {
        inboxItems.removeAll { $0.id == item.id }; inboxItems.insert(item, at: 0)
        inboxResults.removeAll { $0.id == item.id }
        if inboxFilters.matches(item) { inboxResults.insert(item, at: 0) }
    }
}

private extension TransactionFilters {
    func matches(_ item: TamiasTransaction) -> Bool {
        let term = query.trimmingCharacters(in: .whitespacesAndNewlines)
        if !term.isEmpty && ![item.name, item.note ?? "", item.category, item.accountName].contains(where: { $0.localizedCaseInsensitiveContains(term) }) { return false }
        if let accountID, item.accountID != accountID { return false }
        if let categorySlug, item.categorySlug != categorySlug { return false }
        if let fromDate, TamiasDates.calendar.startOfDay(for: item.date) < TamiasDates.calendar.startOfDay(for: fromDate) { return false }
        if let toDate, TamiasDates.calendar.startOfDay(for: item.date) > TamiasDates.calendar.startOfDay(for: toDate) { return false }
        switch type { case .all: return true; case .income: return item.amount > 0; case .expense: return item.amount < 0
        case .needsReceipt: return item.needsReceipt; case .inReview: return item.isInReview }
    }
}
private extension InvoiceFilters {
    func matches(_ item: TamiasInvoice) -> Bool {
        let term = query.trimmingCharacters(in: .whitespacesAndNewlines)
        if !term.isEmpty && ![item.customerName, item.number, item.note ?? ""].contains(where: { $0.localizedCaseInsensitiveContains(term) }) { return false }
        if let status, status == "outstanding" ? !item.isOutstanding : item.status != status { return false }
        if let fromDate, TamiasDates.calendar.startOfDay(for: item.issueDate) < TamiasDates.calendar.startOfDay(for: fromDate) { return false }
        if let toDate, TamiasDates.calendar.startOfDay(for: item.issueDate) > TamiasDates.calendar.startOfDay(for: toDate) { return false }
        return true
    }
}
private extension InboxFilters {
    func matches(_ item: InboxItem) -> Bool {
        let term = query.trimmingCharacters(in: .whitespacesAndNewlines)
        if !term.isEmpty && ![item.name, item.fileName, item.note ?? ""].contains(where: { $0.localizedCaseInsensitiveContains(term) }) { return false }
        return status == nil || status == item.status
    }
}
