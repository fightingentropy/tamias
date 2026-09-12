import Foundation

struct SoleTraderProfile: Codable, Sendable, Equatable {
    var businessName = ""
    var businessDescription = ""
    var soleTrader = false
    var cashBasis = false
    var recordsComplete = false
    var adjustmentsReviewed = false
    var otherIncomeReviewed = false
    var additionalSections: [String] = []

    static let sections: [(id: String, name: String)] = [
        ("employment", "Employment / PAYE"), ("property", "Rental property"),
        ("savings_dividends", "Savings interest or dividends"), ("capital_gains", "Capital gains, including crypto"),
        ("foreign", "Foreign income"), ("partnership", "Partnership"), ("pensions_benefits", "Pensions or taxable benefits"),
        ("student_loans", "Student loan repayments"), ("reliefs", "Pension contributions, Gift Aid or other reliefs"),
        ("multiple_businesses", "More than one business"), ("vat_registered", "VAT registered"),
        ("capital_allowances", "Capital allowances or accounting adjustments"), ("loss_relief", "Loss relief"),
        ("non_resident", "Non-resident or dual resident"), ("mtd", "Enrolled in Making Tax Digital for this year")
    ]
}

struct SoleTraderCategory: Codable, Sendable, Identifiable {
    let id: String
    let name: String
    let box: String
    let kind: String
    static let all: [Self] = [
        .init(id: "turnover", name: "Sales", box: "9", kind: "income"),
        .init(id: "other_income", name: "Other business income", box: "10", kind: "income"),
        .init(id: "goods", name: "Goods and materials", box: "11", kind: "expense"),
        .init(id: "travel", name: "Car and travel", box: "12", kind: "expense"),
        .init(id: "staff", name: "Staff costs", box: "13", kind: "expense"),
        .init(id: "premises", name: "Rent, utilities and insurance", box: "14", kind: "expense"),
        .init(id: "repairs", name: "Repairs and maintenance", box: "15", kind: "expense"),
        .init(id: "professional", name: "Accountancy and legal fees", box: "16", kind: "expense"),
        .init(id: "finance", name: "Interest and bank charges", box: "17", kind: "expense"),
        .init(id: "office", name: "Phone, stationery and office", box: "18", kind: "expense"),
        .init(id: "other_expenses", name: "Other allowable expenses", box: "19", kind: "expense"),
        .init(id: "excluded", name: "Personal, transfer or not allowable", box: "", kind: "excluded")
    ]
}

struct SoleTraderGroup: Codable, Sendable, Identifiable {
    let id: String
    let name: String
    let box: String
    let kind: String
    var amountPence: Int
}

struct TaxTransaction: Codable, Sendable, Identifiable {
    let id: String
    let name: String
    let date: String
    let amount: Double
    let currency: String
    let amountPence: Int?
    let sourceVersion: String
    var category: String?
    var businessPercent: Int
    var note: String
    let hasReceipt: Bool
    var needsReview: Bool
    var changedSinceReview: Bool
    let pending: Bool
    let blockedCurrency: Bool
    var included: Bool
    var businessAmountPence: Int
    let automaticExclusion: Bool
    var statusLabel: String {
        if changedSinceReview { return "Changed · review again" }
        if pending { return "Pending" }
        if blockedCurrency { return "Needs GBP conversion" }
        if needsReview { return "To review" }
        if category == "excluded" { return "Excluded" }
        return businessPercent == 100 ? "Reviewed" : "\(businessPercent)% business"
    }
}

struct TaxTransactionReview: Codable, Sendable {
    let transactionId: String
    let sourceVersion: String
    let category: String
    let businessPercent: Int
    let note: String
}

struct SoleTraderReport: Codable, Sendable {
    let taxYear: Int
    let start: String
    let end: String
    let endExclusive: String
    let label: String
    let deadline: String
    let generatedAt: Date
    let currency: String
    var profile: SoleTraderProfile
    let categories: [SoleTraderCategory]
    var groups: [SoleTraderGroup]
    var transactions: [TaxTransaction]
    var incomePence: Int
    var expensesPence: Int
    var profitPence: Int
    var needsReview: Int
    var missingCurrency: Int
    var pending: Int
    var missingReceipts: Int
    var blockers: [String]
    var filingBlockers: [String]
    var readyToExport: Bool
    var fingerprint: String

    static func lastCompletedYear(now: Date = .now) -> Int {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Europe/London")!
        let year = calendar.component(.year, from: now)
        let boundary = calendar.date(from: DateComponents(year: year, month: 4, day: 6))!
        return now >= boundary ? year - 1 : year - 2
    }
    static func money(_ pence: Int) -> String { TamiasTheme.money(Double(pence) / 100, currency: "GBP") }
}

struct TaxExport: Decodable, Sendable { let fileName: String; let csv: String; let fingerprint: String }

extension TamiasAPIClient {
    func taxReport(year: Int, token: String) async throws -> SoleTraderReport {
        try await request("self-assessment/\(year)", token: token)
    }
    func saveTaxProfile(_ profile: SoleTraderProfile, year: Int, token: String) async throws -> SoleTraderReport {
        try await request("self-assessment/\(year)/profile", token: token, method: "PUT", body: JSONEncoder().encode(profile))
    }
    func reviewTaxTransactions(_ reviews: [TaxTransactionReview], year: Int, token: String) async throws -> SoleTraderReport {
        struct Body: Encodable { let reviews: [TaxTransactionReview] }
        return try await request("self-assessment/\(year)/reviews", token: token, method: "PUT", body: JSONEncoder().encode(Body(reviews: reviews)))
    }
    func exportTaxReport(year: Int, fingerprint: String, token: String) async throws -> TaxExport {
        try await request("self-assessment/\(year)/export", token: token, query: [.init(name: "fingerprint", value: fingerprint)])
    }
}
