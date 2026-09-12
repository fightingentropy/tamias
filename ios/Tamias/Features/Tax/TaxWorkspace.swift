import Foundation
import Observation

@MainActor @Observable
final class TaxWorkspace {
    let store: TamiasStore
    let workspaceID: String
    private(set) var report: SoleTraderReport?
    private(set) var isLoading = false
    private(set) var isSaving = false
    var error: String?
    @ObservationIgnored private var loadID = UUID()
    init(store: TamiasStore) { self.store = store; workspaceID = store.workspaceID }

    func load(year: Int) async {
        guard !isSaving else { return }
        let id = UUID(); loadID = id; isLoading = true; error = nil; report = nil
        defer { if loadID == id { isLoading = false } }
        do {
            let result = try await store.loadTaxReport(year: year)
            guard loadID == id, store.workspaceID == workspaceID else { return }
            report = result
        } catch { if loadID == id { self.error = error.localizedDescription } }
    }
    func save(_ profile: SoleTraderProfile) async throws {
        guard let report, !isSaving, !isLoading else { throw TamiasAPIError.busy }
        isSaving = true; defer { isSaving = false }
        let result = try await store.saveTaxProfile(profile, year: report.taxYear, expectedWorkspaceID: workspaceID)
        guard store.workspaceID == workspaceID else { throw WorkflowError.workspaceChanged }
        self.report = result
    }
    func review(_ reviews: [TaxTransactionReview]) async throws {
        guard let report, !isSaving, !isLoading else { throw TamiasAPIError.busy }
        isSaving = true; defer { isSaving = false }
        let result = try await store.reviewTaxTransactions(reviews, year: report.taxYear, expectedWorkspaceID: workspaceID)
        guard store.workspaceID == workspaceID else { throw WorkflowError.workspaceChanged }
        self.report = result
    }
    func export() async throws -> URL {
        guard let report, !isSaving, !isLoading else { throw TamiasAPIError.busy }
        let result = try await store.exportTaxReport(report, expectedWorkspaceID: workspaceID)
        guard store.workspaceID == workspaceID, result.fingerprint == report.fingerprint else { throw WorkflowError.workspaceChanged }
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent("TamiasTaxExports", isDirectory: true)
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true, attributes: [.protectionKey: FileProtectionType.complete])
        // Construct the name locally: a server response never chooses a file path.
        let file = folder.appendingPathComponent("Tamias-Self-Assessment-\(report.taxYear)-\(report.taxYear + 1).csv")
        try Data(("\u{FEFF}" + result.csv).utf8).write(to: file, options: [.atomic, .completeFileProtection])
        return file
    }
}

extension SoleTraderReport {
    static func demo(year: Int) -> Self {
        let categories = SoleTraderCategory.all
        let fixtures: [(String, Int, String?, Bool)] = [
            ("Studio project", 780000, "turnover", true), ("Website design", 500000, "turnover", true),
            ("Workspace rent", -150000, "premises", true), ("Adobe", -6600, "office", true),
            ("Trainline", -40000, "travel", false), ("Apple", -29900, nil, true),
            ("Phone bill", -4500, nil, false), ("Personal transfer", -20000, "excluded", false)
        ]
        let transactions = fixtures.enumerated().map { index, item in
            TaxTransaction(id: "tax-demo-\(index)", name: item.0, date: "\(year)-09-\(String(format: "%02d", index + 1))",
                amount: Double(item.1) / 100, currency: "GBP", amountPence: item.1, sourceVersion: "demo",
                category: item.2, businessPercent: item.2 == "excluded" ? 0 : 100, note: "", hasReceipt: item.3,
                needsReview: item.2 == nil, changedSinceReview: false, pending: false, blockedCurrency: false,
                included: item.2 != nil && item.2 != "excluded", businessAmountPence: item.2 != nil && item.2 != "excluded" ? item.1 : 0,
                automaticExclusion: false)
        }
        let groups = categories.filter { $0.kind != "excluded" }.map { category in
            SoleTraderGroup(id: category.id, name: category.name, box: category.box, kind: category.kind,
                amountPence: transactions.filter { $0.category == category.id }.reduce(0) { $0 + $1.businessAmountPence } * (category.kind == "income" ? 1 : -1))
        }
        let blockers = ["Review 2 transactions.", "Confirm all business accounts, cash income and expenses are included.", "Review adjustments, allowances and losses.", "Check the other sections needed for your personal return."]
        return Self(taxYear: year, start: "\(year)-04-06", end: "\(year + 1)-04-05", endExclusive: "\(year + 1)-04-06",
            label: "\(year)/\(String(year + 1).suffix(2))", deadline: "\(year + 2)-01-31", generatedAt: .now, currency: "GBP",
            profile: SoleTraderProfile(businessName: "Northstar Studio", businessDescription: "Design services", soleTrader: true, cashBasis: true),
            categories: categories, groups: groups, transactions: transactions, incomePence: 1280000, expensesPence: 196600,
            profitPence: 1083400, needsReview: 2, missingCurrency: 0, pending: 0, missingReceipts: 1, blockers: blockers,
            filingBlockers: blockers + ["Sign in to prepare your own return."], readyToExport: false, fingerprint: String(repeating: "0", count: 64))
    }
}
