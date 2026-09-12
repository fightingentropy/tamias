import Foundation

// Values use the API's major currency units. Summaries never add unlike currencies.
struct TamiasUser: Codable, Identifiable, Sendable, Equatable {
    let id: String
    let fullName: String
    let email: String
    let team: Team?

    struct Team: Codable, Identifiable, Sendable, Equatable {
        let id: String
        let name: String
    }
}

struct BankAccount: Codable, Identifiable, Sendable, Equatable {
    let id: String
    let name: String
    let currency: String
    let balance: Double?
    let enabled: Bool
    let type: String
    let manual: Bool
    var isCashAccount: Bool { enabled && type == "depository" }
}

struct TamiasTransaction: Codable, Identifiable, Sendable, Equatable {
    let id: String
    let name: String
    let amount: Double
    let currency: String
    let date: Date
    let category: String
    let status: String
    let accountName: String
    let note: String?
    let needsReceipt: Bool
    var accountID: String? = nil
    var categorySlug: String? = nil
    var hasAttachment: Bool = false
    var isFulfilled: Bool? = nil
    var isExported: Bool? = nil
    var hasExportError: Bool? = nil
    var isInReview: Bool {
        status != "excluded" && status != "archived" && isFulfilled == true && isExported == false && hasExportError == false
    }
    var isIncome: Bool { amount > 0 }
    var symbol: String {
        if isIncome { return "arrow.down.left" }
        let text = (category + " " + name).lowercased()
        if text.contains("travel") || text.contains("transport") { return "tram.fill" }
        if text.contains("software") || text.contains("subscription") { return "square.stack.3d.up.fill" }
        if text.contains("food") || text.contains("meal") { return "cup.and.saucer.fill" }
        if text.contains("rent") || text.contains("office") { return "building.2.fill" }
        if text.contains("contractor") || text.contains("payroll") { return "person.2.fill" }
        return "creditcard.fill"
    }
}

struct TamiasInvoice: Codable, Identifiable, Sendable, Equatable {
    let id: String
    let number: String
    let customerName: String
    let amount: Double
    let currency: String
    let status: String
    let dueDate: Date
    let issueDate: Date
    let note: String?
    let pdfURL: URL?
    var isOutstanding: Bool { status == "unpaid" || status == "overdue" }
    var statusLabel: String {
        switch status {
        case "unpaid": return "Awaiting payment"
        case "canceled": return "Cancelled"
        default: return status.capitalized
        }
    }
}

struct InboxItem: Codable, Identifiable, Sendable, Equatable {
    let id: String
    let name: String
    let fileName: String
    let amount: Double?
    let currency: String
    let date: Date
    let status: String
    let note: String?
    var symbol: String { fileName.lowercased().hasSuffix("pdf") ? "doc.text.fill" : "receipt.fill" }
    var statusLabel: String {
        switch status {
        case "done": return "Matched"
        case "suggested_match": return "Review match"
        case "no_match": return "Needs a match"
        case "pending": return "Processing"
        default: return status.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }
}

struct Customer: Codable, Identifiable, Sendable, Equatable {
    let id: String
    let name: String
    let email: String
    var billingEmail: String? = nil
    var billingEmails: [String] {
        (billingEmail ?? "").split(separator: ",").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
    }
}

struct CashflowPoint: Codable, Identifiable, Sendable, Equatable {
    var id: Date { date }
    let date: Date
    let income: Double
    let expense: Double
    var net: Double { income - expense }
}

struct InvoiceDraft: Codable, Identifiable, Sendable, Equatable {
    var id: UUID
    var customerName: String
    var customerEmail: String
    var description: String
    var amount: Double {
        get { InvoiceMoney.total(lineItems: lineItems, vatRate: vatRate, currency: currency) }
        set { lineItems = [InvoiceLineItem(name: description, quantity: 1, unitPrice: newValue)]; vatRate = 0 }
    }
    var currency: String
    var dueDate: Date
    var note: String
    var createdAt: Date
    var customerID: String?
    var lineItems: [InvoiceLineItem]
    var vatRate: Double
    var paymentDetails: String
    var fromDetails: String
    var issueDate: Date
    var remoteDraftID: String?
    var submittedInvoiceID: String?
    var submissionError: String?
    var pendingSubmission: PendingInvoiceSubmission?
    var subtotal: Double { InvoiceMoney.subtotal(lineItems, currency: currency) }
    var vatAmount: Double { InvoiceMoney.vat(lineItems: lineItems, rate: vatRate, currency: currency) }

    init(id: UUID = UUID(), customerName: String, customerEmail: String = "", description: String,
         amount: Double, currency: String = "GBP", dueDate: Date, note: String = "", createdAt: Date = .now,
         customerID: String? = nil, lineItems: [InvoiceLineItem]? = nil, vatRate: Double = 0,
         paymentDetails: String = "", fromDetails: String = "", issueDate: Date = .now,
         remoteDraftID: String? = nil, submittedInvoiceID: String? = nil) {
        self.id = id
        self.customerName = customerName
        self.customerEmail = customerEmail
        self.description = description
        self.currency = currency
        self.dueDate = dueDate
        self.note = note
        self.createdAt = createdAt
        self.customerID = customerID
        self.lineItems = lineItems ?? [InvoiceLineItem(name: description, quantity: 1, unitPrice: amount)]
        self.vatRate = vatRate
        self.paymentDetails = paymentDetails
        self.fromDetails = fromDetails
        self.issueDate = issueDate
        self.remoteDraftID = remoteDraftID
        self.submittedInvoiceID = submittedInvoiceID
        self.submissionError = nil
        self.pendingSubmission = nil
    }

    enum CodingKeys: String, CodingKey {
        case id, customerName, customerEmail, description, amount, currency, dueDate, note, createdAt
        case customerID, lineItems, vatRate, paymentDetails, fromDetails, issueDate, remoteDraftID, submittedInvoiceID, submissionError, pendingSubmission
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(UUID.self, forKey: .id)
        customerName = try c.decode(String.self, forKey: .customerName)
        customerEmail = try c.decodeIfPresent(String.self, forKey: .customerEmail) ?? ""
        description = try c.decode(String.self, forKey: .description)
        currency = try c.decode(String.self, forKey: .currency)
        dueDate = try c.decode(Date.self, forKey: .dueDate)
        note = try c.decodeIfPresent(String.self, forKey: .note) ?? ""
        createdAt = try c.decode(Date.self, forKey: .createdAt)
        customerID = try c.decodeIfPresent(String.self, forKey: .customerID)
        lineItems = try c.decodeIfPresent([InvoiceLineItem].self, forKey: .lineItems)
            ?? [InvoiceLineItem(id: id, name: description, quantity: 1, unitPrice: c.decodeIfPresent(Double.self, forKey: .amount) ?? 0)]
        vatRate = try c.decodeIfPresent(Double.self, forKey: .vatRate) ?? 0
        paymentDetails = try c.decodeIfPresent(String.self, forKey: .paymentDetails) ?? ""
        fromDetails = try c.decodeIfPresent(String.self, forKey: .fromDetails) ?? ""
        issueDate = try c.decodeIfPresent(Date.self, forKey: .issueDate) ?? createdAt
        remoteDraftID = try c.decodeIfPresent(String.self, forKey: .remoteDraftID)
        submittedInvoiceID = try c.decodeIfPresent(String.self, forKey: .submittedInvoiceID)
        submissionError = try c.decodeIfPresent(String.self, forKey: .submissionError)
        pendingSubmission = try c.decodeIfPresent(PendingInvoiceSubmission.self, forKey: .pendingSubmission)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id); try c.encode(customerName, forKey: .customerName)
        try c.encode(customerEmail, forKey: .customerEmail); try c.encode(description, forKey: .description)
        try c.encode(amount, forKey: .amount); try c.encode(currency, forKey: .currency)
        try c.encode(dueDate, forKey: .dueDate); try c.encode(note, forKey: .note); try c.encode(createdAt, forKey: .createdAt)
        try c.encodeIfPresent(customerID, forKey: .customerID); try c.encode(lineItems, forKey: .lineItems)
        try c.encode(vatRate, forKey: .vatRate); try c.encode(paymentDetails, forKey: .paymentDetails)
        try c.encode(fromDetails, forKey: .fromDetails); try c.encode(issueDate, forKey: .issueDate)
        try c.encodeIfPresent(remoteDraftID, forKey: .remoteDraftID); try c.encodeIfPresent(submittedInvoiceID, forKey: .submittedInvoiceID)
        try c.encodeIfPresent(submissionError, forKey: .submissionError); try c.encodeIfPresent(pendingSubmission, forKey: .pendingSubmission)
    }
}

struct ReceiptCapture: Codable, Identifiable, Sendable, Equatable {
    let id: UUID
    var name: String
    var amount: Double?
    var currency: String
    let createdAt: Date
    var note: String?
    let fileName: String
    let contentType: String
    var receiptDate: Date?
    var sourceImportID: UUID?
    var syncStatus: ReceiptSyncStatus
    var remoteInboxID: String?
    var matchedTransactionID: String?
    var syncError: String?
    var uploadTicket: ReceiptUploadTicket?
    var pendingUploadCompletion: ReceiptUploadCompletion?
    var uploadCompletionKey: String?
    var date: Date { receiptDate ?? createdAt }
    var status: String { syncStatus.title }

    init(id: UUID, name: String, amount: Double?, currency: String, createdAt: Date, note: String?, fileName: String,
         contentType: String, receiptDate: Date? = nil, sourceImportID: UUID? = nil,
         syncStatus: ReceiptSyncStatus = .pending, remoteInboxID: String? = nil, matchedTransactionID: String? = nil,
         syncError: String? = nil, uploadTicket: ReceiptUploadTicket? = nil, pendingUploadCompletion: ReceiptUploadCompletion? = nil, uploadCompletionKey: String? = nil) {
        self.id = id; self.name = name; self.amount = amount; self.currency = currency; self.createdAt = createdAt
        self.note = note; self.fileName = fileName; self.contentType = contentType; self.receiptDate = receiptDate
        self.sourceImportID = sourceImportID; self.syncStatus = syncStatus; self.remoteInboxID = remoteInboxID
        self.matchedTransactionID = matchedTransactionID; self.syncError = syncError; self.uploadTicket = uploadTicket
        self.pendingUploadCompletion = pendingUploadCompletion
        self.uploadCompletionKey = uploadCompletionKey
    }

    enum CodingKeys: String, CodingKey {
        case id, name, amount, currency, createdAt, note, fileName, contentType, receiptDate, sourceImportID
        case syncStatus, remoteInboxID, matchedTransactionID, syncError, uploadTicket, pendingUploadCompletion, uploadCompletionKey
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(UUID.self, forKey: .id); name = try c.decode(String.self, forKey: .name)
        amount = try c.decodeIfPresent(Double.self, forKey: .amount); currency = try c.decode(String.self, forKey: .currency)
        createdAt = try c.decode(Date.self, forKey: .createdAt); note = try c.decodeIfPresent(String.self, forKey: .note)
        fileName = try c.decode(String.self, forKey: .fileName); contentType = try c.decode(String.self, forKey: .contentType)
        receiptDate = try c.decodeIfPresent(Date.self, forKey: .receiptDate)
        sourceImportID = try c.decodeIfPresent(UUID.self, forKey: .sourceImportID)
        syncStatus = try c.decodeIfPresent(ReceiptSyncStatus.self, forKey: .syncStatus) ?? .pending
        remoteInboxID = try c.decodeIfPresent(String.self, forKey: .remoteInboxID)
        matchedTransactionID = try c.decodeIfPresent(String.self, forKey: .matchedTransactionID)
        syncError = try c.decodeIfPresent(String.self, forKey: .syncError)
        uploadTicket = try c.decodeIfPresent(ReceiptUploadTicket.self, forKey: .uploadTicket)
        pendingUploadCompletion = try c.decodeIfPresent(ReceiptUploadCompletion.self, forKey: .pendingUploadCompletion)
        uploadCompletionKey = try c.decodeIfPresent(String.self, forKey: .uploadCompletionKey)
        // A terminated upload is retryable, never presented as still running after relaunch.
        if syncStatus == .uploading { syncStatus = .failed; syncError = "Upload interrupted. Tap Retry to continue." }
    }
}

struct PageMetadata: Codable, Sendable, Equatable {
    let cursor: String?
    let hasNextPage: Bool
}

struct APIPage<Item: Codable & Sendable>: Codable, Sendable {
    let meta: PageMetadata?
    let data: [Item]
}

enum TamiasDates {
    static func parse(_ value: String) -> Date? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: value) { return date }
        let standard = ISO8601DateFormatter()
        if let date = standard.date(from: value) { return date }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.isLenient = false
        for format in ["yyyy-MM-dd", "yyyy-MM-dd HH:mm:ss"] {
            formatter.dateFormat = format
            if let date = formatter.date(from: value) { return date }
        }
        return nil
    }

    static func apiString(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    static var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        return calendar
    }

    static func monthStart(_ date: Date) -> Date {
        calendar.date(from: calendar.dateComponents([.year, .month], from: date))!
    }
}
