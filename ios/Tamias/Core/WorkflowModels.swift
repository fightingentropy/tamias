import CryptoKit
import Foundation

enum TransactionFilterType: String, CaseIterable, Codable, Sendable, Identifiable {
    case all, income, expense, needsReceipt, inReview
    var id: String { rawValue }
    var title: String {
        switch self {
        case .all: return "All"
        case .income: return "Income"
        case .expense: return "Expenses"
        case .needsReceipt: return "Needs receipt"
        case .inReview: return "To review"
        }
    }
}

struct TransactionFilters: Codable, Equatable, Sendable {
    var query: String = ""
    var type: TransactionFilterType = .all
    var fromDate: Date? = nil
    var toDate: Date? = nil
    var accountID: String? = nil
    var categorySlug: String? = nil
    var isEmpty: Bool { query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && type == .all && fromDate == nil && toDate == nil && accountID == nil && categorySlug == nil }
}

struct InvoiceFilters: Codable, Equatable, Sendable {
    var query: String = ""
    var status: String? = nil
    var fromDate: Date? = nil
    var toDate: Date? = nil
    var isEmpty: Bool { query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && status == nil && fromDate == nil && toDate == nil }
}

struct InboxFilters: Codable, Equatable, Sendable {
    var query: String = ""
    var status: String? = nil
    var isEmpty: Bool { query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && status == nil }
}

struct TransactionCategory: Codable, Identifiable, Sendable, Equatable {
    let id: String
    let slug: String
    let name: String
    var color: String? = nil
    var parentId: String? = nil
    var taxRate: Double? = nil
    var taxType: String? = nil
}

struct InvoiceLineItem: Codable, Identifiable, Sendable, Equatable {
    var id: UUID
    var name: String
    var quantity: Double
    var unitPrice: Double
    var total: Double { InvoiceMoney.round(quantity * unitPrice) }
    init(id: UUID = UUID(), name: String = "", quantity: Double = 1, unitPrice: Double = 0) {
        self.id = id; self.name = name; self.quantity = quantity; self.unitPrice = unitPrice
    }
}

enum InvoiceMoney {
    // Kept aligned with packages/invoice/src/utils/currency.ts.
    static func decimalPlaces(_ currency: String) -> Int {
        let code = currency.lowercased()
        if ["bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf"].contains(code) { return 0 }
        return ["bhd", "jod", "kwd", "omr", "tnd"].contains(code) ? 3 : 2
    }
    static func round(_ value: Double, currency: String = "GBP") -> Double {
        guard value.isFinite else { return value }
        return rounded(decimal(value), currency: currency)
    }
    private static func decimal(_ value: Double) -> Decimal { Decimal(string: String(value)) ?? .nan }
    private static func raw(_ items: [InvoiceLineItem]) -> Decimal {
        items.reduce(Decimal.zero) { $0 + decimal($1.quantity) * decimal($1.unitPrice) }
    }
    private static func rounded(_ value: Decimal, currency: String) -> Double {
        var value = value; var result = Decimal()
        NSDecimalRound(&result, &value, decimalPlaces(currency), .plain)
        return Double(NSDecimalNumber(decimal: result).stringValue) ?? .nan
    }
    static func subtotal(_ items: [InvoiceLineItem], currency: String = "GBP") -> Double { rounded(raw(items), currency: currency) }
    static func rawSubtotal(_ items: [InvoiceLineItem]) -> Double { Double(NSDecimalNumber(decimal: raw(items)).stringValue) ?? .nan }
    static func vat(subtotal: Double, rate: Double, currency: String = "GBP") -> Double {
        rounded(decimal(subtotal) * decimal(rate) / 100, currency: currency)
    }
    static func vat(lineItems: [InvoiceLineItem], rate: Double, currency: String = "GBP") -> Double {
        rounded(raw(lineItems) * decimal(rate) / 100, currency: currency)
    }
    static func total(lineItems: [InvoiceLineItem], vatRate: Double, currency: String = "GBP") -> Double {
        let beforeTax = raw(lineItems)
        return rounded(beforeTax + beforeTax * decimal(vatRate) / 100, currency: currency)
    }
}

enum InvoiceDelivery: String, Codable, CaseIterable, Sendable {
    case create, createAndSend = "create_and_send", draft
    var title: String {
        switch self { case .create: return "Create invoice"; case .createAndSend: return "Create and send"; case .draft: return "Sync draft" }
    }
}

struct RichTextDocument: Codable, Sendable, Equatable {
    struct Paragraph: Codable, Sendable, Equatable {
        struct TextNode: Codable, Sendable, Equatable { let type: String; let text: String }
        let type: String
        let content: [TextNode]
    }
    let type: String
    let content: [Paragraph]
    init(_ text: String) {
        type = "doc"
        content = text.components(separatedBy: .newlines).map {
            Paragraph(type: "paragraph", content: $0.isEmpty ? [] : [.init(type: "text", text: $0)])
        }
    }
}

struct InvoiceCreatePayload: Codable, Sendable, Equatable {
    struct Template: Codable, Sendable, Equatable {
        let title: String
        let currency: String
        let includeVat: Bool
        let includeTax: Bool
        let includeDecimals: Bool
        let includePdf: Bool
        let sendCopy: Bool
        let vatRate: Double
        let timezone: String
        let locale: String
        let size: String
        let fromDetails: RichTextDocument
        let paymentDetails: RichTextDocument
        let noteDetails: RichTextDocument
    }
    struct Line: Codable, Sendable, Equatable {
        let name: RichTextDocument
        let quantity: Double
        let price: Double
    }
    let customerId: String
    let template: Template
    let fromDetails: RichTextDocument
    let paymentDetails: RichTextDocument
    let noteDetails: RichTextDocument
    let issueDate: String
    let dueDate: String
    let amount: Double
    let vat: Double
    let lineItems: [Line]
    let deliveryType: InvoiceDelivery
    let expectedCustomerEmail: String?
    let expectedBillingEmails: [String]?

    init(draft: InvoiceDraft, delivery: InvoiceDelivery, billingEmails: [String] = []) throws {
        guard let customerID = draft.customerID, UUID(uuidString: customerID) != nil else { throw WorkflowError.customerRequired }
        customerId = customerID
        template = Template(title: "Invoice", currency: draft.currency.uppercased(), includeVat: draft.vatRate > 0,
                            includeTax: false, includeDecimals: true, includePdf: true, sendCopy: false, vatRate: draft.vatRate,
                            timezone: "UTC", locale: "en-GB", size: "a4", fromDetails: RichTextDocument(draft.fromDetails),
                            paymentDetails: RichTextDocument(draft.paymentDetails), noteDetails: RichTextDocument(draft.note))
        fromDetails = RichTextDocument(draft.fromDetails)
        paymentDetails = RichTextDocument(draft.paymentDetails)
        noteDetails = RichTextDocument(draft.note)
        let formatter = ISO8601DateFormatter()
        issueDate = formatter.string(from: draft.issueDate)
        dueDate = formatter.string(from: draft.dueDate)
        amount = draft.amount; vat = draft.vatAmount
        lineItems = draft.lineItems.map { Line(name: RichTextDocument($0.name), quantity: $0.quantity, price: $0.unitPrice) }
        deliveryType = delivery
        expectedCustomerEmail = delivery == .createAndSend ? draft.customerEmail : nil
        expectedBillingEmails = delivery == .createAndSend ? billingEmails : nil
    }

    var fingerprint: String {
        let encoder = JSONEncoder(); encoder.outputFormatting = .sortedKeys
        guard let data = try? encoder.encode(self) else { return "invalid" }
        return SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }
}

struct PendingInvoiceSubmission: Codable, Sendable, Equatable {
    let payload: InvoiceCreatePayload
    let idempotencyKey: String
    let remoteDraftID: String?
    let expectedWorkspaceID: String
    var reviewedCustomer: Customer? = nil
    var delivery: InvoiceDelivery { payload.deliveryType }
}

struct InvoiceSubmissionReview: Identifiable, Sendable {
    var id: String { pending.idempotencyKey }
    let draftID: UUID
    let customerName: String
    let customerEmail: String
    let billingEmails: [String]
    let currency: String
    let subtotal: Double
    let vatAmount: Double
    let total: Double
    let delivery: InvoiceDelivery
    let pending: PendingInvoiceSubmission
}

struct InvoiceSubmissionResult: Codable, Sendable, Identifiable {
    let id: String
    let status: String
    let createdAt: Date
    let updatedAt: Date
    let pdfUrl: URL?
    let previewUrl: URL?
    var pdfURL: URL? { pdfUrl }
    var previewURL: URL? { previewUrl }
}

enum ReceiptSyncStatus: String, Codable, Sendable {
    case pending, uploading, uploaded, matched, failed
    var title: String {
        switch self {
        case .pending: return "Saved on iPhone"
        case .uploading: return "Uploading"
        case .uploaded: return "Uploaded"
        case .matched: return "Matched"
        case .failed: return "Upload failed"
        }
    }
}

struct ReceiptUploadTicket: Codable, Sendable, Equatable {
    let uploadUrl: URL
    let uploadToken: String
    let storageId: String
    let expiresAt: Date
}

struct ReceiptUploadCompletion: Codable, Sendable, Equatable {
    let uploadToken: String
    let displayName: String
    let amount: Double?
    let currency: String
    let date: String?
    let note: String?
}

struct ReceiptMatchSuggestion: Identifiable, Sendable {
    var id: String { suggestionID ?? transaction.id }
    let transaction: TamiasTransaction
    let score: Double?
    let reasons: [String]
    let suggestionID: String?
}

enum WorkflowError: LocalizedError, Equatable {
    case demoWorkspace, workspaceChanged, missingLocalItem, customerRequired, invalidLines, invalidVAT
    case senderRequired, paymentDetailsRequired, missingCustomerEmail, alreadySubmitted, pendingSubmission
    case reviewChanged, receiptAlreadySynced, uploadExpired, uploadInterrupted, invalidResponse, offlineSearch
    case unavailableFile
    var errorDescription: String? {
        switch self {
        case .demoWorkspace: return "Connect your workspace to sync or send. Demo actions stay on this iPhone."
        case .workspaceChanged: return "Your workspace changed. Review this item again before saving."
        case .missingLocalItem: return "This saved item could not be found."
        case .customerRequired: return "Choose a customer from your Tamias workspace."
        case .invalidLines: return "Add a description, a positive quantity and a valid price to every line item."
        case .invalidVAT: return "VAT must be between 0 and 100 percent."
        case .senderRequired: return "Add your business name and address before creating the invoice."
        case .paymentDetailsRequired: return "Add payment details before creating the invoice."
        case .missingCustomerEmail: return "This customer needs an email address before you can send the invoice."
        case .alreadySubmitted: return "This draft has already been issued. Open its workspace invoice to continue."
        case .pendingSubmission: return "A previous request needs to be resolved. Retry the same reviewed invoice before editing it."
        case .reviewChanged: return "The invoice changed after review. Review the latest details before continuing."
        case .receiptAlreadySynced: return "This receipt is already synced. Edit its details in the workspace."
        case .uploadExpired: return "The upload link expired before completion. Review the upload before retrying."
        case .uploadInterrupted: return "Upload interrupted. Retry to continue with the same receipt."
        case .invalidResponse: return "Tamias returned an unexpected workflow response. Refresh and try again."
        case .offlineSearch: return "Search needs an internet connection. Showing matching saved items only."
        case .unavailableFile: return "The original file could not be found on this iPhone."
        }
    }
}
