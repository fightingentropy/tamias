import Foundation

extension TamiasAPIClient {
    func categories(token: String) async throws -> [TransactionCategory] {
        let result: APIPage<TransactionCategory> = try await request("transaction-categories", token: token)
        return result.data
    }

    func customer(id: String, token: String) async throws -> Customer {
        try await request("customers/\(pathID(id))", token: token)
    }

    func transaction(id: String, token: String) async throws -> TamiasTransaction {
        let result: TransactionDTO = try await request("transactions/\(pathID(id))", token: token)
        return result.model
    }

    func updateTransaction(id: String, categorySlug: String?, note: String?, markReviewed: Bool, token: String) async throws -> TamiasTransaction {
        struct Payload: Encodable {
            let categorySlug: String?
            let note: String?
            let reviewed: Bool
            enum CodingKeys: String, CodingKey { case categorySlug, note, status }
            func encode(to encoder: Encoder) throws {
                var c = encoder.container(keyedBy: CodingKeys.self)
                try c.encode(categorySlug, forKey: .categorySlug)
                try c.encode(note, forKey: .note)
                if reviewed { try c.encode("completed", forKey: .status) }
            }
        }
        let result: TransactionDTO = try await request("transactions/\(pathID(id))", token: token, method: "PATCH",
            body: JSONEncoder().encode(Payload(categorySlug: categorySlug, note: note, reviewed: markReviewed)))
        return result.model
    }

    func submitInvoice(_ pending: PendingInvoiceSubmission, token: String) async throws -> InvoiceSubmissionResult {
        let path: String
        let method: String
        if let id = pending.remoteDraftID {
            path = "invoices/\(try pathID(id))/" + (pending.delivery == .draft ? "draft" : "issue")
            method = pending.delivery == .draft ? "PUT" : "POST"
        } else { path = "invoices"; method = "POST" }
        return try await request(path, token: token, method: method, body: JSONEncoder().encode(pending.payload),
                                 headers: ["Idempotency-Key": pending.idempotencyKey])
    }

    func invoice(id: String, token: String) async throws -> TamiasInvoice {
        let result: InvoiceDTO = try await request("invoices/\(pathID(id))", token: token)
        return result.model
    }

    func createReceiptUpload(fileName: String, contentType: String, size: Int, token: String) async throws -> ReceiptUploadTicket {
        struct Payload: Encodable { let fileName: String; let contentType: String; let size: Int }
        return try await request("inbox/uploads", token: token, method: "POST",
                                 body: JSONEncoder().encode(Payload(fileName: fileName, contentType: contentType, size: size)))
    }

    func uploadReceiptBytes(_ data: Data, ticket: ReceiptUploadTicket, contentType: String) async throws {
        guard ticket.uploadUrl.scheme == "https", ticket.uploadUrl.host == baseURL.host,
              ticket.uploadUrl.port == baseURL.port, ticket.uploadUrl.path == "/uploads/r2" else { throw TamiasAPIError.insecureServer }
        var request = URLRequest(url: ticket.uploadUrl, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 90)
        request.httpMethod = "POST"
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        // Only the server-issued short-lived upload ticket goes to this endpoint, never the account bearer token.
        let (responseData, response) = try await session.upload(for: request, from: data, delegate: ReceiptUploadRedirectGuard())
        guard let http = response as? HTTPURLResponse else { throw TamiasAPIError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else { throw TamiasAPIError.server(http.statusCode) }
        struct Result: Decodable { let storageId: String }
        guard let result = try? JSONDecoder().decode(Result.self, from: responseData), result.storageId == ticket.storageId else {
            throw WorkflowError.invalidResponse
        }
    }

    func completeReceiptUpload(_ payload: ReceiptUploadCompletion, key: String, token: String) async throws -> ReceiptCompletionResult {
        try await request("inbox/uploads/complete", token: token, method: "POST", body: JSONEncoder().encode(payload),
                          headers: ["Idempotency-Key": key])
    }

    func processReceipt(inboxID: String, key: String, token: String) async throws {
        let _: ReceiptProcessResult = try await request("inbox/\(pathID(inboxID))/process", token: token, method: "POST",
                                                        body: Data("{}".utf8), headers: ["Idempotency-Key": key])
    }

    func receiptSuggestions(inboxID: String, token: String) async throws -> [ReceiptMatchSuggestion] {
        let result: APIPage<ReceiptSuggestionDTO> = try await request("inbox/\(pathID(inboxID))/matches", token: token)
        return result.data.compactMap(\.model)
    }

    func matchInboxItem(inboxID: String, transactionID: String, suggestionID: String? = nil, key: String, token: String) async throws -> ReceiptMatchResult {
        struct Payload: Encodable { let transactionId: String; let suggestionId: String? }
        return try await request("inbox/\(pathID(inboxID))/match", token: token, method: "POST",
                                 body: JSONEncoder().encode(Payload(transactionId: transactionID, suggestionId: suggestionID)),
                                 headers: ["Idempotency-Key": key])
    }

    func inboxItem(id: String, token: String) async throws -> InboxItem {
        let result: InboxDTO = try await request("inbox/\(pathID(id))", token: token)
        return result.model
    }

    func inboxFileURL(id: String, token: String) async throws -> URL {
        let result: FileLinkDTO = try await request("inbox/\(pathID(id))/presigned-url", token: token, method: "POST")
        guard result.url.scheme == "https" else { throw TamiasAPIError.insecureServer }
        return result.url
    }

    private func pathID(_ id: String) throws -> String {
        guard !id.isEmpty, id.allSatisfy({ $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" }) else {
            throw TamiasAPIError.invalidData
        }
        return id
    }
}

struct ReceiptCompletionResult: Decodable { let id: String; let status: String; let filePath: [String] }
private struct ReceiptProcessResult: Decodable { let runId: String }
struct ReceiptMatchResult: Decodable { let id: String; let transactionId: String; let status: String }
private struct FileLinkDTO: Decodable { let url: URL }

private struct ReceiptSuggestionDTO: Codable, Sendable {
    struct Transaction: Codable, Sendable { let id: String; let name: String; let date: Date; let amount: Double; let currency: String }
    let id: String
    let transactionId: String
    let confidenceScore: Double?
    let matchType: String?
    let status: String
    let transaction: Transaction?
    var model: ReceiptMatchSuggestion? {
        guard let transaction else { return nil }
        return ReceiptMatchSuggestion(transaction: TamiasTransaction(id: transaction.id, name: transaction.name, amount: transaction.amount,
             currency: transaction.currency.uppercased(), date: transaction.date, category: "", status: "", accountName: "",
             note: nil, needsReceipt: false), score: confidenceScore,
             reasons: matchType.map { [$0.replacingOccurrences(of: "_", with: " ").capitalized] } ?? [], suggestionID: id)
    }
}

extension TransactionFilters {
    var queryItems: [URLQueryItem] {
        var result: [URLQueryItem] = []
        let term = query.trimmingCharacters(in: .whitespacesAndNewlines)
        if !term.isEmpty { result.append(.init(name: "q", value: term)) }
        if let fromDate { result.append(.init(name: "start", value: TamiasDates.apiString(fromDate))) }
        if let toDate { result.append(.init(name: "end", value: TamiasDates.apiString(toDate))) }
        if let accountID { result += APIQuery.array("accounts", values: [accountID]) }
        if let categorySlug { result += APIQuery.array("categories", values: [categorySlug]) }
        switch type {
        case .all: break
        case .income: result.append(.init(name: "type", value: "income"))
        case .expense: result.append(.init(name: "type", value: "expense"))
        case .needsReceipt:
            result.append(.init(name: "type", value: "expense")); result.append(.init(name: "attachments", value: "exclude"))
        case .inReview: result += APIQuery.array("statuses", values: ["in_review"])
        }
        return result
    }
}

extension InvoiceFilters {
    var queryItems: [URLQueryItem] {
        var result: [URLQueryItem] = []
        let term = query.trimmingCharacters(in: .whitespacesAndNewlines)
        if !term.isEmpty { result.append(.init(name: "q", value: term)) }
        if let fromDate { result.append(.init(name: "start", value: TamiasDates.apiString(fromDate))) }
        if let toDate { result.append(.init(name: "end", value: TamiasDates.apiString(toDate))) }
        if let status, !status.isEmpty {
            result += APIQuery.array("statuses", values: status == "outstanding" ? ["unpaid", "overdue"] : [status])
        }
        return result
    }
}

extension InboxFilters {
    var queryItems: [URLQueryItem] {
        var result: [URLQueryItem] = []
        let term = query.trimmingCharacters(in: .whitespacesAndNewlines)
        if !term.isEmpty { result.append(.init(name: "q", value: term)) }
        if let status, !status.isEmpty { result.append(.init(name: "status", value: status)) }
        return result
    }
}

private enum APIQuery {
    static func array(_ name: String, values: [String]) -> [URLQueryItem] {
        // Hono's validator turns a single query value into a String. Repeating one value preserves
        // the existing z.array contract; duplicate IN predicates have exactly the same meaning.
        let values = values.count == 1 ? values + values : values
        return values.map { URLQueryItem(name: name, value: $0) }
    }
}

private final class ReceiptUploadRedirectGuard: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        // Receipt bytes belong only at the verified server-issued endpoint.
        completionHandler(nil)
    }
}
