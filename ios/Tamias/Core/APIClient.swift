import Foundation

struct SessionCredential: Codable, Sendable, Equatable {
    let token: String
    let refreshToken: String?
    /// Last server-verified identity, held in Keychain to reopen this user's local files offline.
    let profile: TamiasUser?

    init(token: String, refreshToken: String?, profile: TamiasUser? = nil) {
        self.token = token
        self.refreshToken = refreshToken
        self.profile = profile
    }

    func withProfile(_ profile: TamiasUser?) -> SessionCredential {
        SessionCredential(token: token, refreshToken: refreshToken, profile: profile)
    }
}

enum TamiasAPIError: LocalizedError, Equatable {
    case invalidResponse
    case unauthenticated
    case forbidden
    case server(Int)
    case signInFailed
    case invalidCredential
    case invalidData
    case insecureServer
    case busy
    case workflowConflict(WorkflowConflict)
    case uploadTicketExpired
    case invoiceReviewChanged
    case workspaceChanged
    case taxReviewChanged(String)
    case taxFilingUnavailable(String)

    var errorDescription: String? {
        switch self {
        case .invalidResponse: return "Tamias returned an unexpected response. Please try again."
        case .unauthenticated: return "Your session has expired. Sign in again to reconnect."
        case .forbidden: return "This account does not have permission to read this information."
        case .server(let code): return "Tamias is unavailable right now (\(code)). Please try again."
        case .signInFailed: return "We couldn’t sign you in. Check your email and password."
        case .invalidCredential: return "Enter a valid API key to connect your workspace."
        case .invalidData: return "This response could not be read. Refresh to try again."
        case .insecureServer: return "A secure HTTPS connection is required."
        case .busy: return "Please wait for the current refresh to finish, then try again."
        case .workflowConflict(let conflict): return conflict.message
        case .uploadTicketExpired: return "The upload link expired before this receipt was registered. Tap Retry to get a new link."
        case .invoiceReviewChanged: return "Customer details changed before the invoice was saved. Choose the customer again and review the updated invoice."
        case .workspaceChanged: return "Your workspace changed. Refresh the workspace before continuing."
        case .taxReviewChanged(let message): return message
        case .taxFilingUnavailable(let message): return message
        }
    }
}

enum WorkflowConflict: String, Sendable {
    case inProgress = "in_progress", differentRequest = "different_request", reconciliationRequired = "reconciliation_required"
    var message: String {
        switch self {
        case .inProgress: return "Tamias is still processing this request. Wait a moment, then retry the same request."
        case .differentRequest: return "This retry does not match the original request. Your saved request is preserved; refresh the workspace before continuing."
        case .reconciliationRequired: return "Tamias may already have applied this request. Refresh the workspace and check the existing item. Contact support if its status remains unclear; your original request is preserved."
        }
    }
}

/// Authenticated reads and explicit user-triggered writes. Never sends during refresh.
struct TamiasAPIClient: Sendable {
    let baseURL: URL
    let session: URLSession
    let expectedTeamID: String?

    init(baseURL: URL = URL(string: "https://api.tamias.xyz")!, session: URLSession? = nil, expectedTeamID: String? = nil) {
        self.baseURL = baseURL
        self.expectedTeamID = expectedTeamID
        if let session {
            self.session = session
        } else {
            let configuration = URLSessionConfiguration.ephemeral
            configuration.urlCache = nil
            configuration.httpCookieStorage = nil
            configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
            self.session = URLSession(configuration: configuration)
        }
    }

    func scoped(to teamID: String?) -> TamiasAPIClient {
        TamiasAPIClient(baseURL: baseURL, session: session, expectedTeamID: teamID)
    }

    func signIn(email: String, password: String) async throws -> SessionCredential {
        struct Params: Encodable { let email: String; let password: String; let flow = "signIn" }
        struct Args: Encodable { let provider = "password"; let params: Params }
        struct Body: Encodable { let action = "auth:signIn"; let args: Args }
        let body = Body(args: Args(params: Params(email: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password)))
        let result: AuthResponse = try await request("auth", method: "POST", body: JSONEncoder().encode(body))
        guard let tokens = result.tokens else { throw TamiasAPIError.signInFailed }
        return tokens
    }

    func refresh(credential: SessionCredential) async throws -> SessionCredential {
        guard let refreshToken = credential.refreshToken else { throw TamiasAPIError.unauthenticated }
        struct Args: Encodable { let refreshToken: String }
        struct Body: Encodable { let action = "auth:signIn"; let args: Args }
        let result: AuthResponse = try await request("auth", method: "POST", body: JSONEncoder().encode(Body(args: Args(refreshToken: refreshToken))))
        guard let tokens = result.tokens else { throw TamiasAPIError.unauthenticated }
        return tokens
    }

    func currentUser(token: String) async throws -> TamiasUser {
        try await request("users/me", token: token)
    }

    func bankAccounts(token: String) async throws -> [BankAccount] {
        let page: APIPage<BankAccountDTO> = try await request("bank-accounts", token: token)
        return page.data.map(\.model)
    }

    func transactions(token: String, cursor: String? = nil, filters: TransactionFilters = .init()) async throws -> APIPage<TamiasTransaction> {
        // Match the web feed's page size; larger batches can exceed D1 lookup limits.
        let page: APIPage<TransactionDTO> = try await request("transactions", token: token, query: pageQuery(cursor: cursor, pageSize: 40) + filters.queryItems)
        return APIPage(meta: page.meta, data: page.data.map(\.model))
    }

    func invoices(token: String, cursor: String? = nil, filters: InvoiceFilters = .init()) async throws -> APIPage<TamiasInvoice> {
        let page: APIPage<InvoiceDTO> = try await request("invoices", token: token, query: pageQuery(cursor: cursor, pageSize: 100) + filters.queryItems)
        return APIPage(meta: page.meta, data: page.data.map(\.model))
    }

    func inbox(token: String, cursor: String? = nil, filters: InboxFilters = .init()) async throws -> APIPage<InboxItem> {
        let page: APIPage<InboxDTO> = try await request("inbox", token: token, query: pageQuery(cursor: cursor, pageSize: 100) + filters.queryItems)
        return APIPage(meta: page.meta, data: page.data.map(\.model))
    }

    func customers(token: String, query: String = "", cursor: String? = nil) async throws -> APIPage<Customer> {
        try await request("customers", token: token, query: pageQuery(cursor: cursor, pageSize: 100) + (query.isEmpty ? [] : [URLQueryItem(name: "q", value: query)]))
    }

    func statementAnalytics(token: String, currency: String, now: Date = .now) async throws -> StatementAnalytics {
        let query = [URLQueryItem(name: "to", value: TamiasDates.apiString(now)),
                     URLQueryItem(name: "currency", value: currency)]
        let report: StatementAnalytics = try await request("reports/statement", token: token, query: query)
        guard report.currency.caseInsensitiveCompare(currency) == .orderedSame,
              report.months.allSatisfy({ TamiasDates.parse($0.month + "-01") != nil }) else {
            throw TamiasAPIError.invalidData
        }
        return report
    }

    func invoiceSummary(token: String) async throws -> InvoiceSummaryDTO {
        // Hono's query validator accepts repeated query values as an array.
        try await request("invoices/summary", token: token, query: [
            URLQueryItem(name: "statuses", value: "unpaid"), URLQueryItem(name: "statuses", value: "overdue")
        ])
    }

    private func pageQuery(cursor: String?, pageSize: Int) -> [URLQueryItem] {
        var items = [URLQueryItem(name: "pageSize", value: String(pageSize))]
        if let cursor { items.append(URLQueryItem(name: "cursor", value: cursor)) }
        return items
    }

    func request<T: Decodable>(_ path: String, token: String? = nil, method: String = "GET", body: Data? = nil,
                               query: [URLQueryItem] = [], headers: [String: String] = [:]) async throws -> T {
        guard baseURL.scheme == "https" else { throw TamiasAPIError.insecureServer }
        guard var components = URLComponents(url: baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false) else {
            throw TamiasAPIError.invalidResponse
        }
        if !query.isEmpty { components.queryItems = query }
        guard let url = components.url else { throw TamiasAPIError.invalidResponse }
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 25)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Tamias-iOS/1.1", forHTTPHeaderField: "User-Agent")
        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            if let expectedTeamID { request.setValue(expectedTeamID, forHTTPHeaderField: "X-Tamias-Team-Id") }
        }
        for (name, value) in headers { request.setValue(value, forHTTPHeaderField: name) }
        if let body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw TamiasAPIError.invalidResponse }
        switch http.statusCode {
        case 200..<300: break
        case 400 where path == "auth": throw TamiasAPIError.signInFailed
        case 400 where path.hasPrefix("self-assessment/"):
            if let response = try? JSONDecoder().decode(ConflictResponse.self, from: data), response.code == "tax_filing_unavailable" {
                throw TamiasAPIError.taxFilingUnavailable(response.description ?? "Review your return details before filing.")
            }
            throw TamiasAPIError.taxFilingUnavailable("Check your name, tax references and return details, then try again.")
        case 401: throw TamiasAPIError.unauthenticated
        case 403: throw TamiasAPIError.forbidden
        case 410:
            if let response = try? JSONDecoder().decode(ConflictResponse.self, from: data), response.code == "upload_ticket_expired" {
                throw TamiasAPIError.uploadTicketExpired
            }
            throw TamiasAPIError.server(410)
        case 409:
            if let response = try? JSONDecoder().decode(ConflictResponse.self, from: data), response.code == "tax_review_changed" {
                throw TamiasAPIError.taxReviewChanged(response.description ?? "Your tax records changed. Refresh and review them again.")
            }
            if let response = try? JSONDecoder().decode(ConflictResponse.self, from: data), response.code == "workspace_changed" {
                throw TamiasAPIError.workspaceChanged
            }
            if let response = try? JSONDecoder().decode(ConflictResponse.self, from: data), response.code == "invoice_review_changed" {
                throw TamiasAPIError.invoiceReviewChanged
            }
            if let response = try? JSONDecoder().decode(ConflictResponse.self, from: data),
               let code = response.code, let conflict = WorkflowConflict(rawValue: code) {
                throw TamiasAPIError.workflowConflict(conflict)
            }
            throw TamiasAPIError.server(409)
        default: throw TamiasAPIError.server(http.statusCode)
        }
        do { return try Self.decoder().decode(T.self, from: data) }
        catch { throw TamiasAPIError.invalidData }
    }

    static func decoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let value = try container.decode(String.self)
            guard let date = TamiasDates.parse(value) else {
                throw DecodingError.dataCorruptedError(in: container, debugDescription: "Expected an ISO date")
            }
            return date
        }
        return decoder
    }
}

private struct ConflictResponse: Decodable { let code: String?; let description: String? }

private struct AuthResponse: Decodable { let tokens: SessionCredential? }

struct BankAccountDTO: Codable, Sendable {
    let id: String
    let name: String?
    let currency: String?
    let balance: Double?
    let enabled: Bool
    let type: String?
    let manual: Bool?
    var model: BankAccount {
        BankAccount(id: id, name: name ?? "Bank account", currency: currency?.uppercased() ?? "",
                    balance: balance, enabled: enabled, type: type ?? "unknown", manual: manual ?? false)
    }
}

struct TransactionDTO: Codable, Sendable {
    struct Category: Codable, Sendable { let name: String; let slug: String? }
    struct Account: Codable, Sendable { let name: String; let id: String? }
    struct Attachment: Codable, Sendable { let id: String }
    let id: String
    let name: String
    let amount: Double
    let currency: String
    let date: Date
    let category: Category?
    let status: String
    let account: Account?
    let note: String?
    let isFulfilled: Bool?
    let isExported: Bool?
    let hasExportError: Bool?
    let attachments: [Attachment]?
    var model: TamiasTransaction {
        TamiasTransaction(id: id, name: name, amount: amount, currency: currency.uppercased(), date: date,
                          category: category?.name ?? "Uncategorised", status: status,
                          accountName: account?.name ?? "Bank account", note: note,
                          needsReceipt: amount < 0 && isFulfilled == false, accountID: account?.id,
                          categorySlug: category?.slug, hasAttachment: !(attachments?.isEmpty ?? true),
                          isFulfilled: isFulfilled, isExported: isExported, hasExportError: hasExportError)
    }
}

struct InvoiceDTO: Codable, Sendable {
    struct CustomerReference: Codable, Sendable { let name: String }
    let id: String
    let invoiceNumber: String?
    let customerName: String?
    let customer: CustomerReference?
    let amount: Double
    let currency: String
    let status: String
    let dueDate: Date
    let issueDate: Date
    let note: String?
    let pdfUrl: URL?
    var model: TamiasInvoice {
        TamiasInvoice(id: id, number: invoiceNumber ?? "Invoice", customerName: customerName ?? customer?.name ?? "Customer",
                      amount: amount, currency: currency.uppercased(), status: status, dueDate: dueDate,
                      issueDate: issueDate, note: note, pdfURL: pdfUrl)
    }
}

struct InboxDTO: Codable, Sendable {
    let id: String
    let displayName: String
    let fileName: String
    let amount: Double?
    let currency: String?
    let date: Date?
    let createdAt: Date
    let status: String
    let description: String?
    var model: InboxItem {
        InboxItem(id: id, name: displayName, fileName: fileName, amount: amount,
                  currency: currency?.uppercased() ?? "", date: date ?? createdAt, status: status, note: description)
    }
}

struct InvoiceSummaryDTO: Codable, Sendable {
    let currency: String
    let totalAmount: Double
    let invoiceCount: Int
}
