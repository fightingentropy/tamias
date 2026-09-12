import CryptoKit
import Foundation
import Security

protocol CredentialStorage {
    func read() throws -> SessionCredential?
    func save(_ credential: SessionCredential) throws
    func delete() throws
}

struct KeychainCredentialStore: CredentialStorage {
    private let service = "xyz.tamias.ios.session"
    private let account = "authenticated-workspace"

    func read() throws -> SessionCredential? {
        var query = baseQuery
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = item as? Data else { throw StorageError.keychain(status) }
        return try JSONDecoder().decode(SessionCredential.self, from: data)
    }

    func save(_ credential: SessionCredential) throws {
        let data = try JSONEncoder().encode(credential)
        let attributes: [String: Any] = [kSecValueData as String: data,
                                        kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly]
        var status = SecItemUpdate(baseQuery as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var query = baseQuery
            attributes.forEach { query[$0.key] = $0.value }
            status = SecItemAdd(query as CFDictionary, nil)
        }
        guard status == errSecSuccess else { throw StorageError.keychain(status) }
    }

    func delete() throws {
        let status = SecItemDelete(baseQuery as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw StorageError.keychain(status) }
    }

    private var baseQuery: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: service,
         kSecAttrAccount as String: account]
    }
}

enum StorageError: LocalizedError {
    case keychain(OSStatus)
    case invalidDraft
    case invalidReceipt
    case invalidAmount
    case invalidCurrency
    case saveInProgress

    var errorDescription: String? {
        switch self {
        case .keychain: return "Your secure session could not be saved. Unlock your iPhone and try again."
        case .invalidDraft: return "Add a customer, a description and an amount greater than zero."
        case .invalidReceipt: return "Choose a PDF or image smaller than 30 MB."
        case .invalidAmount: return "Enter a valid receipt amount or leave the amount blank."
        case .invalidCurrency: return "Choose a valid three-letter currency code."
        case .saveInProgress: return "A receipt is already being saved. Please wait a moment."
        }
    }
}

/// Local-only drafts and captured source files are isolated by workspace and from sample mode.
struct LocalVault {
    let rootURL: URL
    let namespace: String
    var directory: URL { rootURL.appendingPathComponent(namespace, isDirectory: true) }

    static func workspaceNamespace(user: TamiasUser) -> String {
        let raw = user.id + ":" + (user.team?.id ?? "personal")
        let digest = SHA256.hash(data: Data(raw.utf8)).map { String(format: "%02x", $0) }.joined()
        return "workspace-" + digest
    }

    func loadDrafts() throws -> [InvoiceDraft] { try load("drafts.json") ?? [] }
    func loadReceipts() throws -> [ReceiptCapture] { try load("receipts.json") ?? [] }
    func saveDrafts(_ drafts: [InvoiceDraft]) throws { try save(drafts, name: "drafts.json") }
    func saveReceipts(_ receipts: [ReceiptCapture]) throws { try save(receipts, name: "receipts.json") }
    func loadSnapshot() throws -> WorkspaceSnapshot? { try load("snapshot.json") }
    func saveSnapshot(_ snapshot: WorkspaceSnapshot) throws { try save(snapshot, name: "snapshot.json") }
    func removeSnapshot() throws {
        let url = directory.appendingPathComponent("snapshot.json")
        if FileManager.default.fileExists(atPath: url.path) { try FileManager.default.removeItem(at: url) }
    }

    func saveReceipt(data: Data, fileExtension: String, merchant: String?, amount: String?, currency: String,
                     note: String?, existing: [ReceiptCapture], now: Date = .now, receiptDate: Date? = nil,
                     sourceImportID: UUID? = nil, persistIndex: Bool = true) throws -> ReceiptCapture {
        let ext = fileExtension.lowercased().trimmingCharacters(in: CharacterSet(charactersIn: "."))
        let contentTypes = ["pdf": "application/pdf", "jpg": "image/jpeg", "jpeg": "image/jpeg",
                            "png": "image/png", "heic": "image/heic", "heif": "image/heif"]
        guard let contentType = contentTypes[ext], !data.isEmpty, data.count <= 30 * 1_024 * 1_024 else {
            throw StorageError.invalidReceipt
        }
        guard Self.validCurrency(currency) else { throw StorageError.invalidCurrency }
        let rawAmount = amount?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let parsedAmount: Double?
        if rawAmount.isEmpty { parsedAmount = nil }
        else {
            // The form uses a decimal keyboard; commas are accepted as decimal separators only.
            let normalized = rawAmount.replacingOccurrences(of: ",", with: ".")
            guard let value = Double(normalized), value.isFinite, value >= 0 else { throw StorageError.invalidAmount }
            parsedAmount = value
        }
        let id = sourceImportID ?? UUID()
        let trimmedName = merchant?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let capture = ReceiptCapture(id: id, name: trimmedName.isEmpty ? "New receipt" : trimmedName,
                                     amount: parsedAmount, currency: currency.uppercased(), createdAt: now,
                                     note: note, fileName: "\(id.uuidString).\(ext)", contentType: contentType,
                                     receiptDate: receiptDate, sourceImportID: sourceImportID)
        try ensureDirectory()
        let fileURL = directory.appendingPathComponent(capture.fileName)
        try writeProtected(data, to: fileURL)
        do { if persistIndex { try save([capture] + existing.filter { $0.id != capture.id }, name: "receipts.json") } }
        catch {
            try? FileManager.default.removeItem(at: fileURL)
            throw error
        }
        return capture
    }

    func receiptURL(_ receipt: ReceiptCapture) -> URL? {
        guard receipt.fileName == (receipt.fileName as NSString).lastPathComponent else { return nil }
        let url = directory.appendingPathComponent(receipt.fileName)
        return FileManager.default.fileExists(atPath: url.path) ? url : nil
    }

    static func validCurrency(_ value: String) -> Bool {
        let uppercase = value.uppercased()
        return uppercase.count == 3 && Locale.commonISOCurrencyCodes.contains(uppercase)
    }

    private func load<T: Decodable>(_ name: String) throws -> T? {
        let url = directory.appendingPathComponent(name)
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        return try JSONDecoder().decode(T.self, from: Data(contentsOf: url))
    }

    private func save<T: Encodable>(_ value: T, name: String) throws {
        try ensureDirectory()
        let data = try JSONEncoder().encode(value)
        try writeProtected(data, to: directory.appendingPathComponent(name))
    }

    private func ensureDirectory() throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true,
                                               attributes: [.protectionKey: FileProtectionType.complete])
    }

    private func writeProtected(_ data: Data, to url: URL) throws {
        try data.write(to: url, options: [.atomic, .completeFileProtection])
    }
}
