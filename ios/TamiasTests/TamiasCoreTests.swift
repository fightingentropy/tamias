import Foundation
import XCTest
@testable import Tamias

@MainActor
final class TamiasCoreTests: XCTestCase {
    private func makeAPI(_ handler: @escaping (URLRequest) throws -> (Int, Data)) -> TamiasAPIClient {
        MockURLProtocol.setHandler(handler)
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [MockURLProtocol.self]
        config.urlCache = nil
        return TamiasAPIClient(baseURL: URL(string: "https://tamias-native-tests.invalid")!, session: URLSession(configuration: config))
    }

    private func temporaryRoot() throws -> URL {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent("tamias-core-tests-\(UUID())", isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        addTeardownBlock { try? FileManager.default.removeItem(at: root) }
        return root
    }

    func testPasswordSignInUsesExistingAuthContractAndDoesNotSendPasswordAsBearer() async throws {
        let api = makeAPI { request in
            XCTAssertEqual(request.url?.path, "/auth")
            XCTAssertEqual(request.httpMethod, "POST")
            XCTAssertNil(request.value(forHTTPHeaderField: "Authorization"))
            let body = try XCTUnwrap(try JSONSerialization.jsonObject(with: request.capturedBody()) as? [String: Any])
            XCTAssertEqual(body["action"] as? String, "auth:signIn")
            let args = try XCTUnwrap(body["args"] as? [String: Any])
            let params = try XCTUnwrap(args["params"] as? [String: Any])
            XCTAssertEqual(args["provider"] as? String, "password")
            XCTAssertEqual(params["flow"] as? String, "signIn")
            XCTAssertEqual(params["email"] as? String, "alex@example.test")
            XCTAssertEqual(params["password"] as? String, "sample-password")
            return (200, Data(#"{"tokens":{"token":"test-access","refreshToken":"test-refresh"}}"#.utf8))
        }
        let result = try await api.signIn(email: "  alex@example.test \n", password: "sample-password")
        XCTAssertEqual(result, SessionCredential(token: "test-access", refreshToken: "test-refresh"))
    }

    func testRefreshUsesRotatingRefreshTokenContract() async throws {
        let api = makeAPI { request in
            let body = try XCTUnwrap(try JSONSerialization.jsonObject(with: request.capturedBody()) as? [String: Any])
            let args = try XCTUnwrap(body["args"] as? [String: Any])
            XCTAssertEqual(args["refreshToken"] as? String, "refresh-before")
            XCTAssertNil(args["params"])
            return (200, Data(#"{"tokens":{"token":"access-after","refreshToken":"refresh-after"}}"#.utf8))
        }
        let result = try await api.refresh(credential: .init(token: "old-access", refreshToken: "refresh-before"))
        XCTAssertEqual(result.refreshToken, "refresh-after")
    }

    func testTaxYearUsesUKAprilBoundary() {
        XCTAssertEqual(SoleTraderReport.lastCompletedYear(now: TamiasDates.parse("2026-04-05")!), 2024)
        XCTAssertEqual(SoleTraderReport.lastCompletedYear(now: TamiasDates.parse("2026-04-06")!), 2025)
    }

    func testTaxReviewUsesSourceVersionAndPreservesServerConflictMessage() async throws {
        let api = makeAPI { request in
            XCTAssertEqual(request.url?.path, "/self-assessment/2025/reviews")
            XCTAssertEqual(request.httpMethod, "PUT")
            let body = try XCTUnwrap(try JSONSerialization.jsonObject(with: request.capturedBody()) as? [String: Any])
            let review = try XCTUnwrap((body["reviews"] as? [[String: Any]])?.first)
            XCTAssertEqual(review["sourceVersion"] as? String, "reviewed-version")
            XCTAssertEqual(review["businessPercent"] as? Int, 50)
            return (409, Data(#"{"code":"tax_review_changed","description":"The bank transaction changed. Review it again."}"#.utf8))
        }
        do {
            _ = try await api.reviewTaxTransactions([.init(transactionId: "expense", sourceVersion: "reviewed-version", category: "office", businessPercent: 50, note: "Mixed use")], year: 2025, token: "fixture-token")
            XCTFail("Stale tax reviews must be rejected")
        } catch { XCTAssertEqual(error as? TamiasAPIError, .taxReviewChanged("The bank transaction changed. Review it again.")) }
    }

    func testHMRCSetupErrorIsActionableAndDoesNotRetrySubmission() async throws {
        var calls = 0
        let api = makeAPI { request in
            calls += 1
            XCTAssertEqual(request.url?.path, "/self-assessment/2025/submissions/prepared-id/submit")
            let body = try XCTUnwrap(try JSONSerialization.jsonObject(with: request.capturedBody()) as? [String: Any])
            XCTAssertEqual(body["confirmedIrMark"] as? String, "reviewed-mark")
            XCTAssertEqual(body["declarationAccepted"] as? Bool, true)
            return (400, Data(#"{"code":"tax_filing_unavailable","description":"HMRC test credentials are not configured."}"#.utf8))
        }
        do {
            _ = try await api.submitTaxFiling(year: 2025, id: "prepared-id", body: .init(declarationAccepted: true, confirmedIrMark: "reviewed-mark", senderId: nil, password: nil), token: "fixture-token")
            XCTFail("Missing filing configuration must be surfaced")
        } catch { XCTAssertEqual(error as? TamiasAPIError, .taxFilingUnavailable("HMRC test credentials are not configured.")) }
        XCTAssertEqual(calls, 1)
    }

    func testAPIMapsHTTPFailuresWithoutExposingServerBody() async throws {
        for (status, expected) in [(401, TamiasAPIError.unauthenticated), (403, .forbidden), (503, .server(503))] {
            let api = makeAPI { _ in (status, Data("private-server-details".utf8)) }
            do {
                _ = try await api.currentUser(token: "test-token")
                XCTFail("Expected HTTP \(status) to fail")
            } catch {
                XCTAssertEqual(error as? TamiasAPIError, expected)
                XCTAssertFalse(error.localizedDescription.contains("private-server-details"))
            }
        }
    }

    func testTransactionDecodesNullCategoryAndDateOnly() async throws {
        let api = makeAPI { request in
            XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer test-token")
            return (200, Data(#"{"meta":{"cursor":"next-page","hasNextPage":true},"data":[{"id":"tx-1","name":"Coffee","amount":-4.25,"currency":"gbp","date":"2026-09-07","category":null,"status":"completed","account":{"name":"Business"},"note":null,"isFulfilled":false}]}"#.utf8))
        }
        let page = try await api.transactions(token: "test-token")
        let transaction = try XCTUnwrap(page.data.first)
        XCTAssertEqual(transaction.category, "Uncategorised")
        XCTAssertEqual(transaction.currency, "GBP")
        XCTAssertEqual(transaction.amount, -4.25)
        XCTAssertTrue(transaction.needsReceipt)
        XCTAssertEqual(transaction.date, TamiasDates.parse("2026-09-07"))
        XCTAssertEqual(page.meta?.cursor, "next-page")
    }

    func testInvalidAPIDateIsAnErrorInsteadOfInventingToday() async throws {
        let api = makeAPI { _ in
            (200, Data(#"{"data":[{"id":"tx-1","name":"Coffee","amount":-4.25,"currency":"GBP","date":"not-a-date","category":null,"status":"completed","account":null,"note":null,"isFulfilled":false}]}"#.utf8))
        }
        do {
            _ = try await api.transactions(token: "test-token")
            XCTFail("Invalid dates must not become current dates")
        } catch { XCTAssertEqual(error as? TamiasAPIError, .invalidData) }
    }

    func testOverviewUsesAuthoritativeReportsAndKeepsCurrenciesSeparate() async throws {
        let api = makeAPI(Self.workspaceResponse)
        let store = TamiasStore(api: api, credentials: MemoryCredentials(.init(token: "test-token", refreshToken: nil)),
                                localStorageRoot: try temporaryRoot())
        XCTAssertFalse(store.isDemo)
        XCTAssertTrue(store.transactions.isEmpty, "Sample records must never fill an authenticated workspace")
        await store.refresh()
        XCTAssertTrue(store.overviewAvailable)
        XCTAssertEqual(store.balance, 100)
        XCTAssertEqual(store.unconvertedAccountCurrencies, ["EUR"])
        XCTAssertEqual(store.monthlyIncome, 2_000)
        XCTAssertEqual(store.monthlyExpenses, 700)
        XCTAssertEqual(store.outstandingAmount, 1_200)
        XCTAssertEqual(store.cashflow.count, 12)
        XCTAssertTrue(store.transactions.isEmpty, "No sample records should appear when the API list is empty")
    }

    func testOneDeniedResourceDoesNotHideSuccessfullyLoadedData() async throws {
        let api = makeAPI { request in
            if request.url?.path == "/reports/revenue" { return (403, Data()) }
            return try Self.workspaceResponse(request)
        }
        let store = TamiasStore(api: api, credentials: MemoryCredentials(.init(token: "test-token", refreshToken: nil)),
                                localStorageRoot: try temporaryRoot())
        await store.refresh()
        XCTAssertTrue(store.balancesAvailable)
        XCTAssertTrue(store.invoiceSummaryAvailable)
        XCTAssertFalse(store.cashflowAvailable)
        XCTAssertFalse(store.overviewAvailable)
        XCTAssertEqual(store.balance, 100)
        XCTAssertTrue(store.cashflow.isEmpty)
        XCTAssertFalse(store.dataWarnings.isEmpty)
    }

    func testExpiredSessionRequiresSignInAndDoesNotFallBackToSamples() async throws {
        let api = makeAPI { _ in (401, Data()) }
        let store = TamiasStore(api: api, credentials: MemoryCredentials(.init(token: "expired-test-token", refreshToken: nil)),
                                localStorageRoot: try temporaryRoot())
        await store.refresh()
        XCTAssertTrue(store.needsReauthentication)
        XCTAssertFalse(store.isDemo)
        XCTAssertFalse(store.overviewAvailable)
        XCTAssertTrue(store.transactions.isEmpty)
        XCTAssertNotNil(store.errorMessage)
    }

    func testDraftPersistsAcrossRelaunchAndIsIsolatedFromLiveWorkspace() async throws {
        let root = try temporaryRoot()
        let api = makeAPI(Self.workspaceResponse)
        let credentials = MemoryCredentials(nil)
        let store = TamiasStore(api: api, credentials: credentials, localStorageRoot: root, demoMode: true)
        let draft = InvoiceDraft(customerName: "Sample client", description: "Identity design", amount: 500, dueDate: .now)
        try store.saveDraft(draft)
        let relaunched = TamiasStore(credentials: MemoryCredentials(nil), localStorageRoot: root, demoMode: true)
        XCTAssertEqual(relaunched.localDrafts, [draft])
        try await store.connect(apiKey: "test-key")
        XCTAssertTrue(store.localDrafts.isEmpty, "Demo drafts must not enter an authenticated workspace")
        let liveDraft = InvoiceDraft(customerName: "Live client", description: "Consulting", amount: 900, dueDate: .now)
        try store.saveDraft(liveDraft)
        store.signOut()
        XCTAssertEqual(store.localDrafts, [draft])
        try await store.connect(apiKey: "test-key")
        XCTAssertEqual(store.localDrafts, [liveDraft])
    }

    func testInvalidDraftDoesNotOverwritePreviouslySavedDraft() throws {
        let root = try temporaryRoot()
        let store = TamiasStore(credentials: MemoryCredentials(nil), localStorageRoot: root, demoMode: true)
        let valid = InvoiceDraft(customerName: "Client", description: "Design", amount: 500, dueDate: .now)
        try store.saveDraft(valid)
        XCTAssertThrowsError(try store.saveDraft(InvoiceDraft(customerName: "Client", description: "Design", amount: -.infinity, dueDate: .now)))
        XCTAssertEqual(store.localDrafts, [valid])
    }

    func testConnectedColdLaunchCanReadLocalDraftsWhileOffline() async throws {
        let root = try temporaryRoot()
        let credentials = MemoryCredentials(nil)
        let store = TamiasStore(api: makeAPI(Self.workspaceResponse), credentials: credentials,
                                localStorageRoot: root, demoMode: true)
        try await store.connect(apiKey: "test-key")
        let draft = InvoiceDraft(customerName: "Live client", description: "Identity", amount: 500, dueDate: .now)
        try store.saveDraft(draft)
        let offlineAPI = makeAPI { _ in throw URLError(.notConnectedToInternet) }
        let relaunched = TamiasStore(api: offlineAPI, credentials: credentials, localStorageRoot: root)
        XCTAssertFalse(relaunched.isDemo)
        XCTAssertEqual(relaunched.teamName, "Live Studio")
        XCTAssertEqual(relaunched.localDrafts, [draft])
        XCTAssertTrue(relaunched.overviewAvailable)
        XCTAssertEqual(relaunched.balance, 100, "Only the server-confirmed snapshot is restored")
        XCTAssertTrue(relaunched.isUsingOfflineSnapshot)
        XCTAssertTrue(relaunched.isSnapshotStale)
        await relaunched.refresh()
        XCTAssertEqual(relaunched.localDrafts, [draft])
        XCTAssertNotNil(relaunched.errorMessage)
    }

    func testKeychainSaveFailureDoesNotReplaceDemoWithPartiallyConnectedWorkspace() async throws {
        let store = TamiasStore(api: makeAPI(Self.workspaceResponse), credentials: FailingCredentials(),
                                localStorageRoot: try temporaryRoot(), demoMode: true)
        do {
            try await store.connect(apiKey: "test-key")
            XCTFail("Connecting must fail when the secure session cannot be saved")
        } catch {
            XCTAssertTrue(store.isDemo)
            XCTAssertFalse(store.isAuthenticated)
            XCTAssertEqual(store.teamName, "Northstar Studio")
        }
    }

    func testRefreshAndLoadMoreCannotOverwriteOneAnother() async throws {
        let pageStarted = expectation(description: "Next page requested")
        let allowPage = DispatchSemaphore(value: 0)
        let api = makeAPI { request in
            if request.url?.path == "/transactions" {
                let isNextPage = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)?.queryItems?.contains { $0.name == "cursor" && $0.value == "page-two" } == true
                if isNextPage {
                    pageStarted.fulfill()
                    _ = allowPage.wait(timeout: .now() + 5)
                    return (200, Data(#"{"data":[],"meta":{"cursor":null,"hasNextPage":false}}"#.utf8))
                }
                return (200, Data(#"{"data":[],"meta":{"cursor":"page-two","hasNextPage":true}}"#.utf8))
            }
            return try Self.workspaceResponse(request)
        }
        let store = TamiasStore(api: api, credentials: MemoryCredentials(.init(token: "test-token", refreshToken: nil)),
                                localStorageRoot: try temporaryRoot())
        await store.refresh()
        let paging = Task { await store.loadMoreTransactions() }
        await fulfillment(of: [pageStarted], timeout: 3)
        XCTAssertTrue(store.isLoadingMore)
        await store.refresh()
        XCTAssertFalse(store.isLoading)
        allowPage.signal()
        await paging.value
        XCTAssertFalse(store.hasMoreTransactions, "A simultaneous refresh must not restore a stale pagination cursor")
    }

    func testCapturedReceiptPersistsExactBytesAndRemainsIsolated() async throws {
        let root = try temporaryRoot()
        let store = TamiasStore(credentials: MemoryCredentials(nil), localStorageRoot: root, demoMode: true)
        let bytes = Data("%PDF-1.4\nNative receipt test\n%%EOF".utf8)
        let receipt = try await store.saveLocalReceipt(data: bytes, fileExtension: "pdf", merchant: "Print studio",
                                                       amount: "42.50", currency: "GBP", note: "Local copy")
        let file = try XCTUnwrap(store.receiptFileURL(for: receipt))
        XCTAssertEqual(try Data(contentsOf: file), bytes)
        XCTAssertEqual(receipt.amount, 42.5)
        let relaunched = TamiasStore(credentials: MemoryCredentials(nil), localStorageRoot: root, demoMode: true)
        XCTAssertEqual(relaunched.capturedReceipts, [receipt])
        let otherUser = TamiasUser(id: "another-user", fullName: "Other", email: "other@example.test", team: nil)
        let otherVault = LocalVault(rootURL: root, namespace: LocalVault.workspaceNamespace(user: otherUser))
        XCTAssertTrue(try otherVault.loadReceipts().isEmpty)
        XCTAssertNil(otherVault.receiptURL(receipt))
    }

    func testSampleFinancialFiguresReconcileWithTransactionsAndInvoices() throws {
        let sample = SampleWorkspace(now: try XCTUnwrap(TamiasDates.parse("2026-09-08")))
        let income = sample.transactions.filter { $0.amount > 0 }.reduce(0) { $0 + $1.amount }
        let expenses = sample.transactions.filter { $0.amount < 0 }.reduce(0) { $0 + abs($1.amount) }
        XCTAssertEqual(income, sample.cashflow.last?.income)
        XCTAssertEqual(expenses, sample.cashflow.last?.expense)
        XCTAssertEqual(sample.invoices.filter(\.isOutstanding).reduce(0) { $0 + $1.amount }, 11_250)
        XCTAssertEqual(sample.accounts.reduce(0) { $0 + ($1.balance ?? 0) }, 86_420.5)
    }

    func testInvoiceMoneyUsesDecimalLineArithmeticAndCurrencyPrecision() {
        let lines = [InvoiceLineItem(name: "Work", quantity: 1.25, unitPrice: 19.99)]
        XCTAssertEqual(InvoiceMoney.subtotal(lines), 24.99)
        XCTAssertEqual(InvoiceMoney.vat(lineItems: lines, rate: 20), 5)
        XCTAssertEqual(InvoiceMoney.total(lineItems: lines, vatRate: 20), 29.99)
        XCTAssertEqual(InvoiceMoney.total(lineItems: lines, vatRate: 20, currency: "JPY"), 30)
        XCTAssertEqual(InvoiceMoney.total(lineItems: lines, vatRate: 20, currency: "KWD"), 29.985)
        let halfCent = [InvoiceLineItem(name: "Work", quantity: 0.333, unitPrice: 1)]
        XCTAssertEqual(InvoiceMoney.total(lineItems: halfCent, vatRate: 20), 0.40)
    }

    func testLegacyDraftDecodesWithoutLosingOriginalAmountOrDescription() throws {
        let json = #"{"id":"ED495F08-13E4-4400-A211-2EE6F2DF9202","customerName":"Legacy customer","description":"Original design work","amount":123.45,"currency":"GBP","dueDate":1000,"createdAt":500}"#
        let draft = try JSONDecoder().decode(InvoiceDraft.self, from: Data(json.utf8))
        XCTAssertEqual(draft.lineItems.count, 1)
        XCTAssertEqual(draft.lineItems.first?.name, "Original design work")
        XCTAssertEqual(draft.amount, 123.45)
        XCTAssertEqual(draft.vatRate, 0)
        XCTAssertNil(draft.pendingSubmission)
        XCTAssertEqual(draft, try JSONDecoder().decode(InvoiceDraft.self, from: JSONEncoder().encode(draft)))
    }

    func testServerSearchCarriesFiltersAndCursorBeyondCachedItems() async throws {
        let api = makeAPI { request in
            let items = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)!.queryItems!
            XCTAssertEqual(items.first(where: { $0.name == "q" })?.value, "Archived printer")
            XCTAssertEqual(items.filter { $0.name == "accounts" }.map(\.value), ["account-one", "account-one"])
            XCTAssertEqual(items.filter { $0.name == "categories" }.map(\.value), ["office", "office"])
            XCTAssertEqual(items.first(where: { $0.name == "type" })?.value, "expense")
            XCTAssertEqual(items.first(where: { $0.name == "attachments" })?.value, "exclude")
            XCTAssertEqual(items.first(where: { $0.name == "start" })?.value, "2020-01-01")
            let next = items.contains { $0.name == "cursor" && $0.value == "archived-next" }
            return (200, Data("{\"data\":[{\"id\":\"\(next ? "historic-two" : "historic-one")\",\"name\":\"Archived printer\",\"amount\":-40,\"currency\":\"GBP\",\"date\":\"2020-02-01\",\"status\":\"completed\"}],\"meta\":{\"cursor\":\(next ? "null" : "\"archived-next\""),\"hasNextPage\":\(!next)}}".utf8))
        }
        let profile = TamiasUser(id: "live-user", fullName: "Taylor", email: "taylor@example.test", team: nil)
        let store = TamiasStore(api: api, credentials: MemoryCredentials(.init(token: "test", refreshToken: nil, profile: profile)), localStorageRoot: try temporaryRoot())
        let filters = TransactionFilters(query: " Archived printer ", type: .needsReceipt, fromDate: TamiasDates.parse("2020-01-01"), accountID: "account-one", categorySlug: "office")
        await store.searchTransactions(filters)
        XCTAssertEqual(store.transactionResults.map(\.id), ["historic-one"])
        XCTAssertTrue(store.hasMoreTransactionResults)
        XCTAssertTrue(store.transactions.isEmpty, "Searching history must not replace the Home list")
        await store.loadMoreTransactionResults()
        XCTAssertEqual(store.transactionResults.map(\.id), ["historic-one", "historic-two"])
        XCTAssertFalse(store.hasMoreTransactionResults)
        XCTAssertFalse(store.transactionResultsAreCached)
    }

    func testTransactionPatchExplicitlyClearsCategoryAndNote() async throws {
        let api = makeAPI { request in
            XCTAssertEqual(request.httpMethod, "PATCH")
            let body = try XCTUnwrap(try JSONSerialization.jsonObject(with: request.capturedBody()) as? [String: Any])
            XCTAssertTrue(body["categorySlug"] is NSNull)
            XCTAssertTrue(body["note"] is NSNull)
            XCTAssertEqual(body["status"] as? String, "completed")
            return (200, Data(#"{"id":"tx-one","name":"Printer","amount":-40,"currency":"GBP","date":"2026-09-01","status":"completed","category":null,"note":null}"#.utf8))
        }
        let result = try await api.updateTransaction(id: "tx-one", categorySlug: nil, note: nil, markReviewed: true, token: "test")
        XCTAssertEqual(result.status, "completed")
        XCTAssertNil(result.note)
        XCTAssertNil(result.categorySlug)
    }

    func testDemoWorkflowCannotReachMutationEndpoints() async throws {
        let api = makeAPI { _ in XCTFail("Demo must not make network writes"); throw URLError(.unsupportedURL) }
        let store = TamiasStore(api: api, credentials: MemoryCredentials(nil), localStorageRoot: try temporaryRoot(), demoMode: true)
        do { _ = try await store.updateTransaction(id: "sample", categorySlug: nil, note: nil); XCTFail("Expected demo guard") }
        catch { XCTAssertEqual(error as? WorkflowError, .demoWorkspace) }
        do { _ = try await store.syncReceipt(id: UUID()); XCTFail("Expected demo guard") }
        catch { XCTAssertEqual(error as? WorkflowError, .demoWorkspace) }
    }

    func testSharedReceiptImportDeduplicatesAndRejectsChangedWorkspace() async throws {
        let store = TamiasStore(credentials: MemoryCredentials(nil), localStorageRoot: try temporaryRoot(), demoMode: true)
        let source = UUID(); let bytes = Data("%PDF-1.4 fixture".utf8)
        let first = try await store.saveLocalReceipt(data: bytes, fileExtension: "pdf", merchant: "Shop", amount: "20", currency: "GBP", note: nil, expectedWorkspaceID: "demo", sourceImportID: source)
        let second = try await store.saveLocalReceipt(data: bytes, fileExtension: "pdf", merchant: "Shop", amount: "20", currency: "GBP", note: nil, expectedWorkspaceID: "demo", sourceImportID: source)
        XCTAssertEqual(first.id, second.id)
        XCTAssertEqual(store.capturedReceipts.count, 1)
        do {
            _ = try await store.saveLocalReceipt(data: bytes, fileExtension: "pdf", merchant: nil, amount: nil, currency: "GBP", note: nil, expectedWorkspaceID: "another-workspace")
            XCTFail("Expected changed workspace guard")
        } catch { XCTAssertEqual(error as? WorkflowError, .workspaceChanged) }
        XCTAssertEqual(store.capturedReceipts.count, 1)
    }

    func testInvoiceSubmissionReusesExactRequestAfterUncertainFailureAndRelaunch() async throws {
        let root = try temporaryRoot(); let credentials = MemoryCredentials(nil)
        var requests: [(String?, Data)] = []
        var customerReads = 0
        let invoiceID = "3A98468F-4F67-4E7A-8D5E-CA20E3F4FDAA"
        let api = makeAPI { request in
            if request.url?.path == "/customers" { return (200, Data("{\"data\":[\(Self.workflowCustomerJSON)]}".utf8)) }
            if request.url?.path == "/customers/\(Self.workflowCustomerID)" {
                customerReads += 1
                let json = customerReads == 1 ? Self.workflowCustomerJSON : Self.workflowCustomerJSON.replacingOccurrences(of: "client@example.test", with: "changed-after-request@example.test")
                return (200, Data(json.utf8))
            }
            if request.url?.path == "/invoices" && request.httpMethod == "POST" {
                requests.append((request.value(forHTTPHeaderField: "Idempotency-Key"), try request.capturedBody()))
                if requests.count == 1 { throw URLError(.networkConnectionLost) }
                return (201, Data("{\"id\":\"\(invoiceID)\",\"status\":\"unpaid\",\"createdAt\":\"2026-09-08T12:00:00Z\",\"updatedAt\":\"2026-09-08T12:00:00Z\"}".utf8))
            }
            if request.url?.path == "/invoices/\(invoiceID)" { return (404, Data()) }
            return try Self.workspaceResponse(request)
        }
        let store = TamiasStore(api: api, credentials: credentials, localStorageRoot: root, demoMode: true)
        try await store.connect(apiKey: "fixture")
        let draft = Self.workflowDraft()
        try store.saveDraft(draft)
        let review = try store.prepareInvoiceSubmission(draftID: draft.id, delivery: .createAndSend)
        XCTAssertEqual(review.billingEmails, ["billing@example.test"])
        XCTAssertFalse(review.pending.payload.template.sendCopy)
        do { _ = try await store.submitInvoice(review); XCTFail("Expected lost response") } catch {}
        XCTAssertNotNil(store.localDrafts.first?.pendingSubmission)
        var edited = draft; edited.note = "Changed"
        XCTAssertThrowsError(try store.saveDraft(edited))
        let relaunched = TamiasStore(api: api, credentials: credentials, localStorageRoot: root)
        let retry = try relaunched.prepareInvoiceSubmission(draftID: draft.id, delivery: .createAndSend)
        let result = try await relaunched.submitInvoice(retry)
        XCTAssertEqual(result.id, invoiceID)
        XCTAssertEqual(requests.count, 2)
        XCTAssertEqual(customerReads, 1, "Persisted exact retries reconcile through server replay even if the customer changed afterward")
        XCTAssertEqual(requests[0].0, requests[1].0)
        XCTAssertEqual(try JSONSerialization.jsonObject(with: requests[0].1) as? NSDictionary, try JSONSerialization.jsonObject(with: requests[1].1) as? NSDictionary)
        XCTAssertNil(relaunched.localDrafts.first?.pendingSubmission)
        XCTAssertEqual(relaunched.localDrafts.first?.submittedInvoiceID, invoiceID)
        XCTAssertThrowsError(try relaunched.prepareInvoiceSubmission(draftID: draft.id, delivery: .createAndSend))
    }

    func testInvoiceRefusesChangedRecipientBeforeSending() async throws {
        var postCount = 0
        let api = makeAPI { request in
            if request.url?.path == "/customers" { return (200, Data("{\"data\":[\(Self.workflowCustomerJSON)]}".utf8)) }
            if request.url?.path == "/customers/\(Self.workflowCustomerID)" {
                return (200, Data(Self.workflowCustomerJSON.replacingOccurrences(of: "client@example.test", with: "changed@example.test").utf8))
            }
            if request.httpMethod == "POST" { postCount += 1 }
            return try Self.workspaceResponse(request)
        }
        let store = TamiasStore(api: api, credentials: MemoryCredentials(nil), localStorageRoot: try temporaryRoot(), demoMode: true)
        try await store.connect(apiKey: "fixture")
        let draft = Self.workflowDraft(); try store.saveDraft(draft)
        let review = try store.prepareInvoiceSubmission(draftID: draft.id, delivery: .createAndSend)
        do { _ = try await store.submitInvoice(review); XCTFail("Changed recipient must require a fresh review") }
        catch { XCTAssertEqual(error as? WorkflowError, .reviewChanged) }
        XCTAssertEqual(postCount, 0)
        XCTAssertNil(store.localDrafts.first?.pendingSubmission)
    }

    func testSyncedInvoiceDraftUsesExistingIDWhenIssued() async throws {
        var paths: [String] = []
        let invoiceID = "3A98468F-4F67-4E7A-8D5E-CA20E3F4FDAA"
        let api = makeAPI { request in
            if request.url?.path == "/customers" { return (200, Data("{\"data\":[\(Self.workflowCustomerJSON)]}".utf8)) }
            if request.url?.path == "/customers/\(Self.workflowCustomerID)" { return (200, Data(Self.workflowCustomerJSON.utf8)) }
            if request.httpMethod == "POST" && request.url!.path.hasPrefix("/invoices") {
                paths.append(request.url!.path)
                let status = paths.count == 1 ? "draft" : "unpaid"
                return (201, Data("{\"id\":\"\(invoiceID)\",\"status\":\"\(status)\",\"createdAt\":\"2026-09-08T12:00:00Z\",\"updatedAt\":\"2026-09-08T12:00:00Z\"}".utf8))
            }
            if request.url?.path == "/invoices/\(invoiceID)" { return (404, Data()) }
            return try Self.workspaceResponse(request)
        }
        let store = TamiasStore(api: api, credentials: MemoryCredentials(nil), localStorageRoot: try temporaryRoot(), demoMode: true)
        try await store.connect(apiKey: "fixture")
        let draft = Self.workflowDraft(); try store.saveDraft(draft)
        _ = try await store.syncInvoiceDraft(id: draft.id)
        XCTAssertEqual(store.localDrafts.first?.remoteDraftID, invoiceID)
        _ = try await store.submitInvoice(store.prepareInvoiceSubmission(draftID: draft.id, delivery: .create))
        XCTAssertEqual(paths, ["/invoices", "/invoices/\(invoiceID)/issue"])
    }

    func testReceiptCompletionRetryDoesNotUploadOrRegisterAnotherDocument() async throws {
        let root = try temporaryRoot(); let credentials = MemoryCredentials(nil)
        var uploadCount = 0; var completions: [(String?, Data)] = []
        let api = makeAPI { request in
            switch request.url?.path {
            case "/inbox/uploads":
                return (200, Data(#"{"uploadUrl":"https://tamias-native-tests.invalid/uploads/r2?ticket=fixture","uploadToken":"fixture-ticket","storageId":"storage-fixture","expiresAt":"2099-09-08T12:00:00Z"}"#.utf8))
            case "/uploads/r2":
                uploadCount += 1
                XCTAssertNil(request.value(forHTTPHeaderField: "Authorization"))
                return (200, Data(#"{"storageId":"storage-fixture"}"#.utf8))
            case "/inbox/uploads/complete":
                completions.append((request.value(forHTTPHeaderField: "Idempotency-Key"), try request.capturedBody()))
                if completions.count == 1 { throw URLError(.networkConnectionLost) }
                return (201, Data(#"{"id":"inbox-fixture","status":"pending","filePath":["fixture.pdf"]}"#.utf8))
            case "/inbox/inbox-fixture/process": return (202, Data(#"{"runId":"fixture-run"}"#.utf8))
            case "/inbox/inbox-fixture": return (200, Data(#"{"id":"inbox-fixture","displayName":"Shop","fileName":"fixture.pdf","amount":42.50,"currency":"GBP","date":"2026-09-08","createdAt":"2026-09-08T12:00:00Z","status":"pending"}"#.utf8))
            default: return try Self.workspaceResponse(request)
            }
        }
        let store = TamiasStore(api: api, credentials: credentials, localStorageRoot: root, demoMode: true)
        try await store.connect(apiKey: "fixture")
        let receipt = try await store.saveLocalReceipt(data: Data("%PDF-1.4 fixture".utf8), fileExtension: "pdf", merchant: "Shop", amount: "42.50", currency: "GBP", note: "Reviewed note")
        do { _ = try await store.syncReceipt(id: receipt.id); XCTFail("Expected lost response") } catch {}
        XCTAssertEqual(store.capturedReceipts.first?.syncStatus, .failed)
        XCTAssertNotNil(store.capturedReceipts.first?.pendingUploadCompletion)
        XCTAssertThrowsError(try store.updateReceipt(id: receipt.id, merchant: "Changed", amount: "3", currency: "GBP", receiptDate: nil, note: nil, expectedWorkspaceID: store.workspaceID))
        let relaunched = TamiasStore(api: api, credentials: credentials, localStorageRoot: root)
        let synced = try await relaunched.syncReceipt(id: receipt.id)
        XCTAssertEqual(synced.remoteInboxID, "inbox-fixture")
        XCTAssertEqual(synced.syncStatus, .uploaded)
        XCTAssertEqual(uploadCount, 1)
        XCTAssertEqual(completions.count, 2)
        XCTAssertEqual(completions[0].0, completions[1].0)
        XCTAssertEqual(try JSONSerialization.jsonObject(with: completions[0].1) as? NSDictionary, try JSONSerialization.jsonObject(with: completions[1].1) as? NSDictionary)
        XCTAssertEqual(relaunched.capturedReceipts.count, 1)
    }

    func testForbiddenSearchShowsPermissionFailureInsteadOfClaimingOffline() async throws {
        let profile = TamiasUser(id: "live-user", fullName: "Taylor", email: "taylor@example.test", team: nil)
        let store = TamiasStore(api: makeAPI { _ in (403, Data()) }, credentials: MemoryCredentials(.init(token: "fixture", refreshToken: nil, profile: profile)), localStorageRoot: try temporaryRoot())
        await store.searchTransactions(TransactionFilters(query: "Printer"))
        XCTAssertTrue(store.transactionResultsAreCached)
        XCTAssertTrue(store.transactionSearchError?.contains("permission") == true)
        XCTAssertFalse(store.transactionSearchError?.contains("internet") == true)
    }

    func testKnownMutationConflictCodesKeepActionableRecoveryMessages() async throws {
        for code in [WorkflowConflict.inProgress, .differentRequest, .reconciliationRequired] {
            let api = makeAPI { _ in (409, Data("{\"code\":\"\(code.rawValue)\",\"description\":\"private details\"}".utf8)) }
            do { _ = try await api.currentUser(token: "fixture"); XCTFail("Expected conflict") }
            catch {
                XCTAssertEqual(error as? TamiasAPIError, .workflowConflict(code))
                XCTAssertEqual(error.localizedDescription, code.message)
                XCTAssertFalse(error.localizedDescription.contains("private details"))
            }
        }
    }

    func testExpiredReceiptTicketRenewsOnlyAfterServerProvesItWasNotApplied() async throws {
        var uploads = 0; var completionKeys: [String?] = []
        let api = makeAPI { request in
            switch request.url?.path {
            case "/inbox/uploads":
                return (200, Data("{\"uploadUrl\":\"https://tamias-native-tests.invalid/uploads/r2?ticket=fixture\",\"uploadToken\":\"ticket-\(uploads)\",\"storageId\":\"storage-fixture\",\"expiresAt\":\"2099-09-08T12:00:00Z\"}".utf8))
            case "/uploads/r2":
                uploads += 1
                return (200, Data(#"{"storageId":"storage-fixture"}"#.utf8))
            case "/inbox/uploads/complete":
                completionKeys.append(request.value(forHTTPHeaderField: "Idempotency-Key"))
                if completionKeys.count == 1 { throw URLError(.networkConnectionLost) }
                if completionKeys.count == 2 { return (410, Data(#"{"code":"upload_ticket_expired"}"#.utf8)) }
                return (201, Data(#"{"id":"inbox-renewed","status":"pending","filePath":["renewed.pdf"]}"#.utf8))
            case "/inbox/inbox-renewed/process": return (202, Data(#"{"runId":"run"}"#.utf8))
            case "/inbox/inbox-renewed": return (404, Data())
            default: return try Self.workspaceResponse(request)
            }
        }
        let store = TamiasStore(api: api, credentials: MemoryCredentials(nil), localStorageRoot: try temporaryRoot(), demoMode: true)
        try await store.connect(apiKey: "fixture")
        let receipt = try await store.saveLocalReceipt(data: Data("%PDF-1.4 fixture".utf8), fileExtension: "pdf", merchant: "Shop", amount: "20", currency: "GBP", note: nil)
        do { _ = try await store.syncReceipt(id: receipt.id); XCTFail("Expected uncertain response") } catch {}
        XCTAssertNotNil(store.capturedReceipts.first?.pendingUploadCompletion)
        do { _ = try await store.syncReceipt(id: receipt.id); XCTFail("Expected expired ticket") }
        catch { XCTAssertEqual(error as? TamiasAPIError, .uploadTicketExpired) }
        XCTAssertNil(store.capturedReceipts.first?.pendingUploadCompletion)
        XCTAssertEqual(uploads, 1)
        _ = try await store.syncReceipt(id: receipt.id)
        XCTAssertEqual(uploads, 2)
        XCTAssertEqual(completionKeys.count, 3)
        XCTAssertEqual(completionKeys[0], completionKeys[1], "An uncertain completion must reuse its key")
        XCTAssertNotEqual(completionKeys[1], completionKeys[2], "A server-confirmed unapplied expired request receives a fresh ticket and key")
        XCTAssertEqual(store.capturedReceipts.first?.remoteInboxID, "inbox-renewed")
    }

    func testOfflineSnapshotDropsSignedURLsAndRejectsMismatchedIdentity() async throws {
        let root = try temporaryRoot(); let credentials = MemoryCredentials(nil)
        let api = makeAPI { request in
            if request.url?.path == "/invoices" {
                return (200, Data(#"{"data":[{"id":"invoice-one","invoiceNumber":"INV-1","customerName":"Fixture","amount":20,"currency":"GBP","status":"unpaid","dueDate":"2026-09-09","issueDate":"2026-09-08","pdfUrl":"https://tamias-native-tests.invalid/file?token=fixture-signed-link"}]}"#.utf8))
            }
            return try Self.workspaceResponse(request)
        }
        let store = TamiasStore(api: api, credentials: credentials, localStorageRoot: root, demoMode: true)
        try await store.connect(apiKey: "fixture")
        let snapshotURL = root.appendingPathComponent(store.workspaceID).appendingPathComponent("snapshot.json")
        let savedData = try Data(contentsOf: snapshotURL)
        XCTAssertFalse(String(decoding: savedData, as: UTF8.self).contains("fixture-signed-link"))
        let snapshot = try JSONDecoder().decode(WorkspaceSnapshot.self, from: savedData)
        XCTAssertNil(snapshot.invoices.first?.pdfURL)
        var json = try XCTUnwrap(try JSONSerialization.jsonObject(with: savedData) as? [String: Any])
        json["userID"] = "another-user"
        try JSONSerialization.data(withJSONObject: json).write(to: snapshotURL, options: .atomic)
        let relaunched = TamiasStore(api: api, credentials: credentials, localStorageRoot: root)
        XCTAssertFalse(relaunched.isUsingOfflineSnapshot)
        XCTAssertFalse(relaunched.overviewAvailable)
        XCTAssertTrue(relaunched.invoices.isEmpty, "A snapshot with a mismatched identity must never fill the workspace")
    }

    func testServerConfirmedRecipientChangeAllowsFreshReviewWithoutDiscardingDraft() async throws {
        let api = makeAPI { request in
            if request.url?.path == "/customers" { return (200, Data("{\"data\":[\(Self.workflowCustomerJSON)]}".utf8)) }
            if request.url?.path == "/customers/\(Self.workflowCustomerID)" { return (200, Data(Self.workflowCustomerJSON.utf8)) }
            if request.url?.path == "/invoices" && request.httpMethod == "POST" {
                return (409, Data(#"{"code":"invoice_review_changed"}"#.utf8))
            }
            return try Self.workspaceResponse(request)
        }
        let store = TamiasStore(api: api, credentials: MemoryCredentials(nil), localStorageRoot: try temporaryRoot(), demoMode: true)
        try await store.connect(apiKey: "fixture")
        var draft = Self.workflowDraft(); try store.saveDraft(draft)
        let review = try store.prepareInvoiceSubmission(draftID: draft.id, delivery: .createAndSend)
        do { _ = try await store.submitInvoice(review); XCTFail("Expected server review conflict") }
        catch { XCTAssertEqual(error as? TamiasAPIError, .invoiceReviewChanged) }
        XCTAssertNil(store.localDrafts.first?.pendingSubmission)
        XCTAssertNil(store.localDrafts.first?.submittedInvoiceID)
        draft.note = "Reviewed again"
        try store.saveDraft(draft)
        XCTAssertEqual(store.localDrafts.first?.note, "Reviewed again")
    }

    func testOfflineTransactionFiltersUseAuthoritativeDerivedWorkflowFlags() async throws {
        var offline = false
        let api = makeAPI { request in
            if offline { throw URLError(.notConnectedToInternet) }
            if request.url?.path == "/transactions" {
                let rows = [
                    Self.workflowTransactionJSON(id: "review", status: "completed", fulfilled: true),
                    Self.workflowTransactionJSON(id: "needs", status: "pending", fulfilled: false),
                    Self.workflowTransactionJSON(id: "exported", status: "completed", fulfilled: true, exported: true),
                    Self.workflowTransactionJSON(id: "error", status: "completed", fulfilled: true, exportError: true),
                ]
                return (200, Data("{\"data\":[\(rows.joined(separator: ","))]}".utf8))
            }
            return try Self.workspaceResponse(request)
        }
        let credentials = MemoryCredentials(nil); let root = try temporaryRoot()
        let store = TamiasStore(api: api, credentials: credentials, localStorageRoot: root, demoMode: true)
        try await store.connect(apiKey: "fixture")
        offline = true
        let relaunched = TamiasStore(api: api, credentials: credentials, localStorageRoot: root)
        await relaunched.searchTransactions(TransactionFilters(type: .inReview))
        XCTAssertEqual(relaunched.transactionResults.map(\.id), ["review"])
        XCTAssertTrue(relaunched.transactionResultsAreCached)
        await relaunched.searchTransactions(TransactionFilters(type: .needsReceipt))
        XCTAssertEqual(relaunched.transactionResults.map(\.id), ["needs"], "Completed without an attachment is fulfilled in the server workflow")
    }

    func testTransactionMutationRetainsOrRemovesReviewResultUsingServerFlags() async throws {
        var patches = 0
        let api = makeAPI { request in
            if request.url?.path == "/transactions" {
                return (200, Data("{\"data\":[\(Self.workflowTransactionJSON(id: "review", status: "posted", fulfilled: true))]}".utf8))
            }
            if request.url?.path == "/transactions/review" && request.httpMethod == "PATCH" {
                patches += 1
                return (200, Data(Self.workflowTransactionJSON(id: "review", status: "completed", fulfilled: true, exported: patches > 1).utf8))
            }
            return try Self.workspaceResponse(request)
        }
        let store = TamiasStore(api: api, credentials: MemoryCredentials(nil), localStorageRoot: try temporaryRoot(), demoMode: true)
        try await store.connect(apiKey: "fixture")
        await store.searchTransactions(TransactionFilters(type: .inReview))
        _ = try await store.updateTransaction(id: "review", categorySlug: nil, note: "Checked", markReviewed: true)
        XCTAssertEqual(store.transactionResults.map(\.id), ["review"], "Raw completed status still belongs to in_review until export")
        _ = try await store.updateTransaction(id: "review", categorySlug: nil, note: "Export checked")
        XCTAssertTrue(store.transactionResults.isEmpty, "A synced export no longer belongs to in_review even while raw status remains completed")
        XCTAssertEqual(store.transactions.first?.isExported, true)
    }

    func testScopedRequestsRejectTeamChangesWithoutPollutingCacheOrWriting() async throws {
        var switched = false; var patches = 0; var tickets = 0; var scopedProfileReads = 0
        let api = makeAPI { request in
            let header = request.value(forHTTPHeaderField: "X-Tamias-Team-Id")
            let currentTeam = switched ? "team-two" : "team-one"
            if request.url?.path == "/users/me" {
                if let header {
                    scopedProfileReads += 1
                    if header != currentTeam { return (409, Data(#"{"code":"workspace_changed"}"#.utf8)) }
                }
                return (200, Data("{\"id\":\"live-user\",\"fullName\":\"Taylor Smith\",\"email\":\"taylor@example.test\",\"team\":{\"id\":\"\(currentTeam)\",\"name\":\"\(switched ? "Second Studio" : "Live Studio")\"}}".utf8))
            }
            XCTAssertEqual(header, "team-one", "Loaded workspace requests must remain pinned until deliberate refresh")
            if header != currentTeam { return (409, Data(#"{"code":"workspace_changed"}"#.utf8)) }
            if request.httpMethod == "PATCH" { patches += 1 }
            if request.url?.path == "/inbox/uploads" { tickets += 1 }
            if request.url?.path == "/transactions" {
                return (200, Data("{\"data\":[\(Self.workflowTransactionJSON(id: "team-one-record", status: "pending", fulfilled: false))]}".utf8))
            }
            return try Self.workspaceResponse(request)
        }
        let credentials = MemoryCredentials(nil); let root = try temporaryRoot()
        let store = TamiasStore(api: api, credentials: credentials, localStorageRoot: root, demoMode: true)
        try await store.connect(apiKey: "fixture")
        let originalWorkspace = store.workspaceID
        let receipt = try await store.saveLocalReceipt(data: Data("%PDF-1.4 fixture".utf8), fileExtension: "pdf", merchant: "Team one", amount: "20", currency: "GBP", note: nil)
        switched = true
        await store.searchTransactions(TransactionFilters())
        XCTAssertEqual(store.transactionResults.map(\.id), ["team-one-record"])
        XCTAssertTrue(store.transactionResultsAreCached)
        XCTAssertTrue(store.transactionSearchError?.contains("workspace changed") == true)
        XCTAssertEqual(store.workspaceID, originalWorkspace)
        do { _ = try await store.updateTransaction(id: "team-one-record", categorySlug: nil, note: "Changed"); XCTFail("Team changed") }
        catch { XCTAssertEqual(error as? TamiasAPIError, .workspaceChanged) }
        do { _ = try await store.syncReceipt(id: receipt.id); XCTFail("Team changed") }
        catch { XCTAssertEqual(error as? TamiasAPIError, .workspaceChanged) }
        XCTAssertEqual(patches, 0)
        XCTAssertEqual(tickets, 0)
        XCTAssertEqual(scopedProfileReads, 2)
        let saved = try XCTUnwrap(try LocalVault(rootURL: root, namespace: originalWorkspace).loadSnapshot())
        XCTAssertEqual(saved.teamID, "team-one")
        XCTAssertEqual(saved.transactions.map(\.id), ["team-one-record"])
    }

    func testDeliberateRefreshResolvesNewTeamThenPinsEveryResourceToIt() async throws {
        var switched = false; var profileHeaders: [String?] = []
        let api = makeAPI { request in
            let team = switched ? "team-two" : "team-one"
            let header = request.value(forHTTPHeaderField: "X-Tamias-Team-Id")
            if request.url?.path == "/users/me" {
                profileHeaders.append(header)
                return (200, Data("{\"id\":\"live-user\",\"fullName\":\"Taylor\",\"email\":\"taylor@example.test\",\"team\":{\"id\":\"\(team)\",\"name\":\"\(team)\"}}".utf8))
            }
            XCTAssertEqual(header, team)
            if request.url?.path == "/transactions" {
                return (200, Data("{\"data\":[\(Self.workflowTransactionJSON(id: team + "-record", status: "pending", fulfilled: false))]}".utf8))
            }
            return try Self.workspaceResponse(request)
        }
        let store = TamiasStore(api: api, credentials: MemoryCredentials(nil), localStorageRoot: try temporaryRoot(), demoMode: true)
        try await store.connect(apiKey: "fixture")
        let original = store.workspaceID
        let draft = InvoiceDraft(customerName: "First-team customer", description: "Work", amount: 20, dueDate: .now)
        try store.saveDraft(draft)
        switched = true
        await store.refresh()
        XCTAssertNotEqual(store.workspaceID, original)
        XCTAssertEqual(store.user?.team?.id, "team-two")
        XCTAssertTrue(store.localDrafts.isEmpty)
        XCTAssertEqual(store.transactions.map(\.id), ["team-two-record"])
        XCTAssertTrue(profileHeaders.allSatisfy { $0 == nil }, "Only deliberate identity resolution is unpinned")
    }

    func testWorkspacePinProtectsWriteWhenTeamChangesAfterSuccessfulPreflight() async throws {
        var serverSwitched = false; var writeRequests = 0; var appliedWrites = 0
        let api = makeAPI { request in
            let pin = request.value(forHTTPHeaderField: "X-Tamias-Team-Id")
            if request.url?.path == "/users/me" && pin == "team-one" {
                let response = try Self.workspaceResponse(request)
                serverSwitched = true
                return response
            }
            if request.url?.path == "/transactions/review" && request.httpMethod == "PATCH" {
                writeRequests += 1
                XCTAssertTrue(serverSwitched)
                XCTAssertEqual(pin, "team-one")
                if pin != "team-two" { return (409, Data(#"{"code":"workspace_changed"}"#.utf8)) }
                appliedWrites += 1
                return (200, Data(Self.workflowTransactionJSON(id: "review", status: "completed", fulfilled: true).utf8))
            }
            return try Self.workspaceResponse(request)
        }
        let store = TamiasStore(api: api, credentials: MemoryCredentials(nil), localStorageRoot: try temporaryRoot(), demoMode: true)
        try await store.connect(apiKey: "fixture")
        do { _ = try await store.updateTransaction(id: "review", categorySlug: nil, note: "Reviewed", markReviewed: true); XCTFail("Expected server workspace guard") }
        catch { XCTAssertEqual(error as? TamiasAPIError, .workspaceChanged) }
        XCTAssertEqual(writeRequests, 1)
        XCTAssertEqual(appliedWrites, 0)
        XCTAssertEqual(store.user?.team?.id, "team-one")
    }

    nonisolated private static func workflowTransactionJSON(id: String, status: String, fulfilled: Bool, exported: Bool = false, exportError: Bool = false) -> String {
        "{\"id\":\"\(id)\",\"name\":\"Printer\",\"amount\":-20,\"currency\":\"GBP\",\"date\":\"2026-09-08\",\"status\":\"\(status)\",\"isFulfilled\":\(fulfilled),\"isExported\":\(exported),\"hasExportError\":\(exportError),\"attachments\":[]}"
    }

    nonisolated private static let workflowCustomerID = "66C374D5-3D17-40B0-9AD3-7023750BD771"
    nonisolated private static var workflowCustomerJSON: String {
        "{\"id\":\"\(workflowCustomerID)\",\"name\":\"Fixture client\",\"email\":\"client@example.test\",\"billingEmail\":\"billing@example.test\"}"
    }
    nonisolated private static func workflowDraft() -> InvoiceDraft {
        InvoiceDraft(customerName: "Fixture client", customerEmail: "client@example.test", description: "Consulting", amount: 120, dueDate: .now.addingTimeInterval(86400), customerID: workflowCustomerID, paymentDetails: "Pay fixture business", fromDetails: "Fixture business, Test address")
    }

    nonisolated private static func workspaceResponse(_ request: URLRequest) throws -> (Int, Data) {
        let month = TamiasDates.apiString(TamiasDates.monthStart(.now))
        let json: String
        switch request.url?.path {
        case "/users/me": json = #"{"id":"live-user","fullName":"Taylor Smith","email":"taylor@example.test","team":{"id":"team-one","name":"Live Studio"}}"#
        case "/bank-accounts": json = #"{"data":[{"id":"gbp","name":"Main","currency":"GBP","balance":100,"enabled":true,"type":"depository","manual":false},{"id":"eur","name":"Euro","currency":"EUR","balance":500,"enabled":true,"type":"depository","manual":false},{"id":"disabled","name":"Disabled","currency":"GBP","balance":999,"enabled":false,"type":"depository","manual":false},{"id":"credit","name":"Business credit","currency":"GBP","balance":4000,"enabled":true,"type":"credit","manual":false},{"id":"loan","name":"Euro loan","currency":"USD","balance":8000,"enabled":true,"type":"loan","manual":false},{"id":"unknown","name":"Unknown account","currency":"GBP","balance":1234,"enabled":true,"type":null,"manual":null}]}"#
        case "/invoices/summary": json = #"{"currency":"GBP","totalAmount":1200,"invoiceCount":1}"#
        case "/reports/revenue": json = "{\"summary\":{\"currency\":\"GBP\"},\"result\":[{\"date\":\"\(month)\",\"current\":{\"value\":2000}}]}"
        case "/reports/expenses": json = "{\"summary\":{\"currency\":\"GBP\"},\"result\":[{\"date\":\"\(month) 00:00:00\",\"total\":-700}]}"
        case "/transactions", "/invoices", "/inbox", "/customers": json = #"{"data":[],"meta":{"cursor":null,"hasNextPage":false}}"#
        default: throw URLError(.unsupportedURL)
        }
        return (200, Data(json.utf8))
    }
}

private final class MemoryCredentials: CredentialStorage {
    var value: SessionCredential?
    init(_ value: SessionCredential?) { self.value = value }
    func read() throws -> SessionCredential? { value }
    func save(_ credential: SessionCredential) throws { value = credential }
    func delete() throws { value = nil }
}

private struct FailingCredentials: CredentialStorage {
    func read() throws -> SessionCredential? { nil }
    func save(_ credential: SessionCredential) throws { throw StorageError.keychain(-1) }
    func delete() throws { throw StorageError.keychain(-1) }
}

private final class MockURLProtocol: URLProtocol {
    private static let lock = NSLock()
    private static var handler: ((URLRequest) throws -> (Int, Data))?

    static func setHandler(_ value: @escaping (URLRequest) throws -> (Int, Data)) {
        lock.lock()
        defer { lock.unlock() }
        handler = value
    }

    override class func canInit(with request: URLRequest) -> Bool { request.url?.host == "tamias-native-tests.invalid" }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        Self.lock.lock()
        let handler = Self.handler
        Self.lock.unlock()
        do {
            guard let handler, let url = request.url else { throw URLError(.badURL) }
            let (status, body) = try handler(request)
            let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: ["Content-Type": "application/json"])!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: body)
            client?.urlProtocolDidFinishLoading(self)
        } catch { client?.urlProtocol(self, didFailWithError: error) }
    }
    override func stopLoading() {}
}

private extension URLRequest {
    func capturedBody() throws -> Data {
        if let httpBody { return httpBody }
        guard let stream = httpBodyStream else { return Data() }
        stream.open()
        defer { stream.close() }
        var result = Data()
        var buffer = [UInt8](repeating: 0, count: 1_024)
        while stream.hasBytesAvailable {
            let length = stream.read(&buffer, maxLength: buffer.count)
            if length < 0 { throw stream.streamError ?? URLError(.cannotDecodeRawData) }
            if length == 0 { break }
            result.append(buffer, count: length)
        }
        return result
    }
}
