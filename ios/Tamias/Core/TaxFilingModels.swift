import Foundation

struct TaxFilingIdentity: Codable, Sendable {
    var fullName = ""
    var utr = ""
    var nino = ""
    var dateOfBirth = "1990-01-01"
    var taxpayerStatus = "U"
    var onlyThisBusinessIncome = false
    var standardPersonalAllowance = false
    var noOtherChargesOrReliefs = false
    var businessOperatedFullYear = false
    var standardNationalInsurance = false
    var class2Choice = "not_needed"
}
struct TaxFilingCalculation: Codable, Sendable {
    struct Group: Codable, Sendable, Identifiable { let id: String; let name: String; let wholePounds: Int }
    let groups: [Group]
    let incomePounds: Int
    let expensesPounds: Int
    let profitPounds: Int
    let incomeTaxPence: Int
    let class4Pence: Int
    let class2Pence: Int
    let totalTaxPence: Int
}
struct TaxFilingReceipt: Codable, Sendable {
    struct Issue: Codable, Sendable { let number: String?; let text: String }
    let summary: String
    let errors: [Issue]
}
struct TaxFiling: Codable, Sendable, Identifiable {
    let id: String
    let environment: String
    let status: String
    let fingerprint: String
    let irMark: String
    let correlationId: String?
    let createdAt: Date
    let updatedAt: Date
    let nextPollAt: Date?
    let identity: TaxFilingIdentity
    let calculation: TaxFilingCalculation
    let receipt: TaxFilingReceipt?
    var isTest: Bool { environment == "test" }
    var statusLabel: String {
        switch status {
        case "prepared": "Prepared · not sent"
        case "pending": "Sending · acceptance unconfirmed"
        case "acknowledged": "Received · awaiting acceptance"
        case "accepted": isTest ? "Test accepted" : "Accepted by HMRC"
        case "rejected": "Rejected by HMRC"
        default: "Outcome needs checking"
        }
    }
}
struct TaxFilingConnection: Decodable, Sendable { let environment: String; let ready: Bool; let blockers: [String] }
struct TaxFilings: Decodable, Sendable { let connection: TaxFilingConnection; let data: [TaxFiling] }
struct TaxFilingEvidence: Codable, Sendable { let submission: TaxFiling; let returnXml: String; let receiptXml: String? }
struct TaxFilingSubmission: Encodable, Sendable {
    let declarationAccepted: Bool
    let confirmedIrMark: String
    let senderId: String?
    let password: String?
}
extension TamiasAPIClient {
    func taxFilings(year: Int, token: String) async throws -> TaxFilings {
        try await request("self-assessment/\(year)/submissions", token: token)
    }
    func prepareTaxFiling(year: Int, fingerprint: String, identity: TaxFilingIdentity, token: String) async throws -> TaxFiling {
        struct Body: Encodable { let fingerprint: String; let identity: TaxFilingIdentity }
        return try await request("self-assessment/\(year)/prepare", token: token, method: "POST", body: JSONEncoder().encode(Body(fingerprint: fingerprint, identity: identity)))
    }
    func submitTaxFiling(year: Int, id: String, body: TaxFilingSubmission, token: String) async throws -> TaxFiling {
        try await request("self-assessment/\(year)/submissions/\(id)/submit", token: token, method: "POST", body: JSONEncoder().encode(body))
    }
    func pollTaxFiling(year: Int, id: String, token: String) async throws -> TaxFiling {
        try await request("self-assessment/\(year)/submissions/\(id)/poll", token: token, method: "POST")
    }
    func taxFilingEvidence(year: Int, id: String, token: String) async throws -> TaxFilingEvidence {
        try await request("self-assessment/\(year)/submissions/\(id)/evidence", token: token)
    }
}
