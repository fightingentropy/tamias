import CryptoKit
import Darwin
import Foundation
import ImageIO
import PDFKit
import UniformTypeIdentifiers

struct SharedReceiptImport: Codable, Identifiable, Equatable, Sendable {
    let id: UUID
    let originalFileName: String
    let contentType: String
    let createdAt: Date
    let byteCount: Int
    let sha256: String

    var fileExtension: String { UTType(contentType)?.preferredFilenameExtension ?? "dat" }
}

enum SharedReceiptError: LocalizedError {
    case unavailable, tooLarge, unsupported, invalid, tooManyPages, full, changed
    var errorDescription: String? {
        switch self {
        case .unavailable: return "Shared receipts are unavailable. Open Tamias once after installing this update, then try again."
        case .tooLarge: return "Choose receipt files no larger than 20 MB each."
        case .unsupported: return "Share an image or PDF with Tamias."
        case .invalid: return "This receipt file couldn’t be read. Try another image or PDF."
        case .tooManyPages: return "Choose a PDF with 30 pages or fewer."
        case .full: return "Your shared inbox is full. Review some receipts in Tamias before sharing more."
        case .changed: return "This shared receipt has changed or is no longer available."
        }
    }
}

/// The extension stages files without knowing which workspace will receive them.
/// A process lock covers deduplication, publication, reading and removal.
struct SharedReceiptQueue: Sendable {
    static let groupIdentifier = "group.com.erlinhoxha.tamias"
    static let maximumBytes = 20 * 1_024 * 1_024
    private let container: URL?

    init() { container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: Self.groupIdentifier) }
    init(containerURL: URL) { container = containerURL }

    func pendingImports() throws -> [SharedReceiptImport] {
        try locked { root in try readPending(root) }
    }

    func fileURL(for item: SharedReceiptImport) throws -> URL {
        try locked { root in
            let url = root.appendingPathComponent(item.id.uuidString).appendingPathComponent("original.\(item.fileExtension)")
            guard FileManager.default.fileExists(atPath: url.path) else { throw SharedReceiptError.changed }
            return url
        }
    }

    func data(for item: SharedReceiptImport) throws -> Data {
        try locked { root in
            let url = root.appendingPathComponent(item.id.uuidString).appendingPathComponent("original.\(item.fileExtension)")
            guard let bytes = try? Data(contentsOf: url), bytes.count == item.byteCount,
                  Self.hash(bytes) == item.sha256 else { throw SharedReceiptError.changed }
            return bytes
        }
    }

    @discardableResult func enqueue(data: Data, fileName: String, contentType: String) throws -> SharedReceiptImport {
        let type = try Self.validate(data: data, contentType: contentType)
        return try locked { root in
            let pending = try readPending(root)
            let digest = Self.hash(data)
            if let duplicate = pending.first(where: { $0.sha256 == digest }) { return duplicate }
            guard pending.count < 50 else { throw SharedReceiptError.full }
            let item = SharedReceiptImport(id: UUID(), originalFileName: String(URL(fileURLWithPath: fileName).lastPathComponent.prefix(200)),
                                           contentType: type.identifier, createdAt: .now, byteCount: data.count, sha256: digest)
            let staging = root.appendingPathComponent(".\(item.id.uuidString).staging", isDirectory: true)
            let destination = root.appendingPathComponent(item.id.uuidString, isDirectory: true)
            try FileManager.default.createDirectory(at: staging, withIntermediateDirectories: false,
                                                    attributes: [.protectionKey: FileProtectionType.complete])
            defer { try? FileManager.default.removeItem(at: staging) }
            try data.write(to: staging.appendingPathComponent("original.\(item.fileExtension)"), options: [.atomic, .completeFileProtection])
            try JSONEncoder().encode(item).write(to: staging.appendingPathComponent("envelope.json"), options: [.atomic, .completeFileProtection])
            try FileManager.default.moveItem(at: staging, to: destination)
            return item
        }
    }

    func remove(id: UUID) throws {
        try locked { root in
            let url = root.appendingPathComponent(id.uuidString, isDirectory: true)
            if FileManager.default.fileExists(atPath: url.path) { try FileManager.default.removeItem(at: url) }
        }
    }

    static func validate(data: Data, contentType: String) throws -> UTType {
        guard !data.isEmpty else { throw SharedReceiptError.invalid }
        guard data.count <= maximumBytes else { throw SharedReceiptError.tooLarge }
        guard let type = UTType(contentType) else { throw SharedReceiptError.unsupported }
        if type.conforms(to: .pdf) {
            guard let document = PDFDocument(data: data), !document.isLocked, document.pageCount > 0 else { throw SharedReceiptError.invalid }
            guard document.pageCount <= 30 else { throw SharedReceiptError.tooManyPages }
            return .pdf
        }
        guard type.conforms(to: .image), let source = CGImageSourceCreateWithData(data as CFData, nil),
              CGImageSourceGetCount(source) > 0, let rawType = CGImageSourceGetType(source),
              let detected = UTType(rawType as String), detected.conforms(to: .image) else { throw SharedReceiptError.unsupported }
        return detected
    }

    private static func hash(_ data: Data) -> String { SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }

    private func readPending(_ root: URL) throws -> [SharedReceiptImport] {
        try FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil, options: [.skipsHiddenFiles])
            .filter { UUID(uuidString: $0.lastPathComponent) != nil }
            .map { folder in
                let item = try JSONDecoder().decode(SharedReceiptImport.self, from: Data(contentsOf: folder.appendingPathComponent("envelope.json")))
                guard item.id.uuidString == folder.lastPathComponent, item.byteCount > 0,
                      item.byteCount <= Self.maximumBytes, let type = UTType(item.contentType),
                      type.conforms(to: .image) || type.conforms(to: .pdf) else { throw SharedReceiptError.invalid }
                return item
            }.sorted { $0.createdAt > $1.createdAt }
    }

    private func locked<T>(_ body: (URL) throws -> T) throws -> T {
        guard let container else { throw SharedReceiptError.unavailable }
        let root = container.appendingPathComponent("SharedReceiptImports", isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true,
                                                attributes: [.protectionKey: FileProtectionType.complete])
        let descriptor = open(root.appendingPathComponent(".queue.lock").path, O_CREAT | O_RDWR, S_IRUSR | S_IWUSR)
        guard descriptor >= 0 else { throw SharedReceiptError.unavailable }
        defer { close(descriptor) }
        guard flock(descriptor, LOCK_EX) == 0 else { throw SharedReceiptError.unavailable }
        defer { flock(descriptor, LOCK_UN) }
        // A crashed writer can leave a private staging folder, but never a visible import.
        // No writer can still own it while this exclusive lock is held.
        for item in try FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil)
            where item.lastPathComponent.hasPrefix(".") && item.lastPathComponent.hasSuffix(".staging") {
            try? FileManager.default.removeItem(at: item)
        }
        return try body(root)
    }
}
