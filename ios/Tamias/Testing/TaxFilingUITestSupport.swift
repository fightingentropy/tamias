#if DEBUG && targetEnvironment(simulator)
import Foundation

/// Exercises the normal API client and workspace guards without using Keychain or a network.
/// Only the simulator Debug app accepts this explicit UI-test launch configuration.
@MainActor enum TaxFilingUITestSupport {
    static var enabled: Bool {
        let arguments = ProcessInfo.processInfo.arguments
        return arguments.contains("-ui-testing") && arguments.contains("-tax-filing-ui-testing")
    }

    static func makeStore() -> TamiasStore {
        guard enabled else { return TamiasStore() }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [TaxFilingFixtureProtocol.self]
        configuration.urlCache = nil
        configuration.httpCookieStorage = nil
        let api = TamiasAPIClient(baseURL: URL(string: "https://tax-filing-ui.invalid")!,
                                  session: URLSession(configuration: configuration))
        return TamiasStore(api: api, credentials: TaxFilingFixtureCredentials())
    }

    static func connect(_ store: TamiasStore) async {
        guard enabled, !store.isAuthenticated else { return }
        do { try await store.connect(apiKey: "synthetic-ui-token") }
        catch { store.errorMessage = error.localizedDescription }
    }
}

private final class TaxFilingFixtureCredentials: CredentialStorage {
    private var value: SessionCredential?
    func read() throws -> SessionCredential? { value }
    func save(_ credential: SessionCredential) throws { value = credential }
    func delete() throws { value = nil }
}

private final class TaxFilingFixtureProtocol: URLProtocol {
    private static let lock = NSLock()
    private static var filing: [String: Any]?
    private static var pollCalls = 0
    private static var submitCalls = 0

    // Intercept every request in this dedicated session, then reject any unexpected origin.
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func stopLoading() {}
    override func startLoading() {
        do {
            let (status, body) = try Self.respond(request)
            let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: "HTTP/1.1",
                                           headerFields: ["Content-Type": "application/json"])!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: try JSONSerialization.data(withJSONObject: body))
            client?.urlProtocolDidFinishLoading(self)
        } catch { client?.urlProtocol(self, didFailWithError: error) }
    }

    private static func respond(_ request: URLRequest) throws -> (Int, Any) {
        lock.lock(); defer { lock.unlock() }
        guard request.url?.scheme == "https", request.url?.host == "tax-filing-ui.invalid",
              request.value(forHTTPHeaderField: "Authorization") == "Bearer synthetic-ui-token" else {
            throw URLError(.unsupportedURL)
        }
        let path = request.url!.path
        if path == "/users/me" {
            return (200, ["id": "tax-ui-user", "fullName": "Example Taxpayer", "email": "example@example.test",
                          "team": ["id": "tax-ui-team", "name": "Synthetic filing test"]])
        }
        guard request.value(forHTTPHeaderField: "X-Tamias-Team-Id") == "tax-ui-team" else { return (403, [:]) }
        let emptyPage: [String: Any] = ["data": [], "meta": ["hasNextPage": false]]
        switch path {
        case "/bank-accounts", "/transactions", "/invoices", "/inbox", "/customers", "/transaction-categories": return (200, emptyPage)
        case "/invoices/summary": return (200, ["currency": "GBP", "totalAmount": 0, "invoiceCount": 0])
        case "/reports/revenue", "/reports/expenses": return (200, ["summary": ["currency": "GBP"], "result": []])
        default: break
        }
        guard let json = ProcessInfo.processInfo.environment["TAMIAS_TAX_UI_FIXTURE"],
              let fixture = try JSONSerialization.jsonObject(with: Data(json.utf8)) as? [String: Any],
              var report = fixture["report"] as? [String: Any],
              let prepared = fixture["filing"] as? [String: Any] else { throw URLError(.cannotDecodeRawData) }
        let scenario = ProcessInfo.processInfo.environment["TAMIAS_TAX_UI_SCENARIO"] ?? "accepted"
        let base = "/self-assessment/2025"
        if path == base {
            if scenario == "unsupported" { report["filingBlockers"] = ["Employment income needs another filing route."] }
            return (200, report)
        }
        if path == base + "/submissions" {
            return (200, ["connection": ["environment": "test", "ready": true, "blockers": []],
                          "data": filing.map { [$0] } ?? []])
        }
        if path == base + "/prepare", request.httpMethod == "POST" {
            let body = try request.fixtureBody()
            guard body["fingerprint"] as? String == report["fingerprint"] as? String,
                  let identity = body["identity"] as? [String: Any],
                  identity["fullName"] as? String == "Example Taxpayer",
                  identity["utr"] as? String == "1234567890",
                  identity["nino"] as? String == "AB123456C",
                  ["onlyThisBusinessIncome", "standardPersonalAllowance", "noOtherChargesOrReliefs",
                   "businessOperatedFullYear", "standardNationalInsurance"].allSatisfy({ identity[$0] as? Bool == true }) else {
                return (400, ["code": "tax_filing_unavailable", "description": "The synthetic return details did not match."])
            }
            filing = prepared
            return (200, prepared)
        }
        guard var current = filing, let id = current["id"] as? String else { return (404, [:]) }
        if path == base + "/submissions/\(id)/submit", request.httpMethod == "POST" {
            submitCalls += 1
            let body = try request.fixtureBody()
            guard submitCalls == 1, body["declarationAccepted"] as? Bool == true,
                  body["confirmedIrMark"] as? String == current["irMark"] as? String,
                  body["password"] == nil, body["senderId"] == nil else { return (409, [:]) }
            current["status"] = scenario == "timeout" ? "unknown" : "acknowledged"
            current["correlationId"] = "SYNTHETIC-UI-CORRELATION"
            current["nextPollAt"] = ISO8601DateFormatter().string(from: Date().addingTimeInterval(2))
            current["receipt"] = ["summary": "Received by the test service; acceptance is unconfirmed.", "errors": []]
            filing = current
            if scenario == "timeout" { throw URLError(.timedOut) }
            return (200, current)
        }
        if path == base + "/submissions/\(id)/poll", request.httpMethod == "POST" {
            pollCalls += 1
            if scenario == "retry", pollCalls == 1 { return (503, [:]) }
            let rejected = scenario == "rejected"
            current["status"] = rejected ? "rejected" : "accepted"
            current["receipt"] = ["summary": rejected ? "The synthetic return was rejected." : "The synthetic test return was accepted.",
                                  "errors": rejected ? [["number": "3001", "text": "Review the synthetic taxpayer reference."]] : []]
            filing = current
            return (200, current)
        }
        if path == base + "/submissions/\(id)/evidence" {
            return (200, ["submission": current, "returnXml": fixture["returnXml"]!,
                          "receiptXml": current["status"] as? String == "prepared" ? NSNull() : fixture["receiptXml"]!])
        }
        return (404, [:])
    }
}

private extension URLRequest {
    func fixtureBody() throws -> [String: Any] {
        var bytes = httpBody ?? Data()
        if let stream = httpBodyStream, bytes.isEmpty {
            stream.open(); defer { stream.close() }
            var buffer = [UInt8](repeating: 0, count: 1024)
            while stream.hasBytesAvailable {
                let count = stream.read(&buffer, maxLength: buffer.count)
                if count < 0 { throw stream.streamError ?? URLError(.cannotDecodeRawData) }
                if count == 0 { break }
                bytes.append(buffer, count: count)
            }
        }
        return try JSONSerialization.jsonObject(with: bytes) as? [String: Any] ?? [:]
    }
}
#endif
