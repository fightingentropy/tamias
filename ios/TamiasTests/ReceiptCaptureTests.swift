import Foundation
import UIKit
import XCTest
@testable import Tamias

final class ReceiptCaptureTests: XCTestCase {
    func testParserPrefersGrandTotalAndRetainsLocaleAmount() {
        let result = ReceiptTextParser.parse(lines: ["PAPER SHOP", "2026-09-08", "SUBTOTAL EUR 1.000,00", "VAT 200,00", "TOTAL 1.150,00", "GRAND TOTAL EUR 1.200,00", "CHANGE 0,00"], preferredCurrency: "GBP")
        XCTAssertEqual(result.merchant, "PAPER SHOP")
        XCTAssertEqual(result.amount, "1200.00")
        XCTAssertEqual(result.currency, "EUR")
        XCTAssertEqual(result.date, ISO8601DateFormatter().date(from: "2026-09-08T00:00:00Z"))
    }

    func testParserLeavesAmbiguousTotalsDatesAndDollarCurrencyForReview() {
        let result = ReceiptTextParser.parse(lines: ["GROCERY", "08/09/2026", "TOTAL $12.50", "TOTAL $20.50"], preferredCurrency: "GBP")
        XCTAssertNil(result.amount)
        XCTAssertNil(result.currency)
        XCTAssertNil(result.date)
        XCTAssertNil(ReceiptTextParser.money(in: "TOTAL -24.50"))
    }

    func testParserReadsSeparateTotalColumnAndExplicitCurrency() {
        let result = ReceiptTextParser.parse(lines: ["COFFEE SHOP", "8 September 2026", "TOTAL", "GBP 18.50"], preferredCurrency: "EUR")
        XCTAssertEqual(result.amount, "18.50")
        XCTAssertEqual(result.currency, "GBP")
        XCTAssertNotNil(result.date)
    }

    func testVisionReadsActualReceiptPixels() throws {
        let result = try ReceiptRecognizer.recognize(data: sampleImage(), isPDF: false, preferredCurrency: "GBP")
        XCTAssertEqual(result.merchant, "MOONBEAM COFFEE")
        XCTAssertEqual(result.amount, "18.50")
        XCTAssertEqual(result.currency, "GBP")
        XCTAssertNotNil(result.date)
    }

    func testImportPreservesSupportedOriginalImageBytes() throws {
        let original = sampleImage()
        let attachment = try ReceiptAttachmentProcessor.image(data: original, name: "Sample receipt.png")
        XCTAssertEqual(attachment.data, original)
        XCTAssertEqual(attachment.fileExtension, "png")
        XCTAssertNotNil(attachment.preview.cgImage)
    }

    func testPDFRecognitionUsesTextLayerAndLimitsAnalysisToThreePages() throws {
        let renderer = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: 600, height: 800))
        let pdf = renderer.pdfData { context in
            for index in 0..<4 {
                context.beginPage()
                let text = index == 0 ? "MOONBEAM COFFEE\n8 September 2026\nTOTAL GBP 18.50" : (index == 3 ? "UNRELATED RECEIPT\nTOTAL GBP 999.99" : "Terms and conditions for this sample receipt")
                (text as NSString).draw(in: CGRect(x: 40, y: 50, width: 520, height: 600), withAttributes: [.font: UIFont.systemFont(ofSize: 24)])
            }
        }
        let recognition = try ReceiptRecognizer.recognize(data: pdf, isPDF: true, preferredCurrency: "GBP")
        XCTAssertEqual(recognition.merchant, "MOONBEAM COFFEE")
        XCTAssertEqual(recognition.amount, "18.50")
        XCTAssertNotNil(recognition.notice)
    }

    func testShareQueuePublishesOriginalDeduplicatesAndRemoves() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let queue = SharedReceiptQueue(containerURL: root)
        let image = sampleImage()
        let first = try queue.enqueue(data: image, fileName: "../../test.png", contentType: "public.png")
        let duplicate = try queue.enqueue(data: image, fileName: "copy.png", contentType: "public.image")
        XCTAssertEqual(first.id, duplicate.id)
        XCTAssertEqual(first.originalFileName, "test.png")
        XCTAssertEqual(try queue.pendingImports(), [first])
        XCTAssertEqual(try queue.data(for: first), image)
        #if !targetEnvironment(simulator)
        // Simulator files live on macOS and do not expose iOS data-protection attributes.
        let attributes = try FileManager.default.attributesOfItem(atPath: queue.fileURL(for: first).path)
        XCTAssertEqual(attributes[.protectionKey] as? FileProtectionType, .complete)
        #endif
        try queue.remove(id: first.id)
        XCTAssertTrue(try queue.pendingImports().isEmpty)
        XCTAssertThrowsError(try queue.data(for: first))
    }

    func testShareQueueRejectsSpoofedAndChangedFiles() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let queue = SharedReceiptQueue(containerURL: root)
        XCTAssertThrowsError(try queue.enqueue(data: Data("not a PDF".utf8), fileName: "receipt.pdf", contentType: "com.adobe.pdf"))
        XCTAssertThrowsError(try queue.enqueue(data: Data(repeating: 1, count: SharedReceiptQueue.maximumBytes + 1), fileName: "large.png", contentType: "public.png"))
        let item = try queue.enqueue(data: sampleImage(), fileName: "receipt.png", contentType: "public.png")
        try Data("changed".utf8).write(to: queue.fileURL(for: item))
        XCTAssertThrowsError(try queue.data(for: item))
    }

    func testShareQueueCoordinatesConcurrentDuplicateImports() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let image = sampleImage()
        let queue = SharedReceiptQueue(containerURL: root)
        let results = LockedImportResults()
        DispatchQueue.concurrentPerform(iterations: 5) { index in
            do { results.append(.success(try queue.enqueue(data: image, fileName: "\(index).png", contentType: "public.png").id)) }
            catch { results.append(.failure(error)) }
        }
        let ids = try results.values.map { try $0.get() }
        XCTAssertEqual(Set(ids).count, 1)
        XCTAssertEqual(try queue.pendingImports().count, 1)
    }

    private func sampleImage() -> Data {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 900, height: 1_000))
        return renderer.pngData { context in
            UIColor.white.setFill(); context.fill(CGRect(x: 0, y: 0, width: 900, height: 1_000))
            let lines = ["SAMPLE", "MOONBEAM COFFEE", "8 September 2026", "Coffee and pastries 14.00", "Tea 4.50", "TOTAL GBP 18.50", "NOT A REAL TRANSACTION"]
            for (index, text) in lines.enumerated() {
                (text as NSString).draw(at: CGPoint(x: 65, y: 80 + index * 120), withAttributes: [.font: UIFont.systemFont(ofSize: 40, weight: .medium), .foregroundColor: UIColor.black])
            }
        }
    }
}

private final class LockedImportResults: @unchecked Sendable {
    private let lock = NSLock()
    private var storage: [Result<UUID, Error>] = []
    var values: [Result<UUID, Error>] { lock.lock(); defer { lock.unlock() }; return storage }
    func append(_ result: Result<UUID, Error>) { lock.lock(); defer { lock.unlock() }; storage.append(result) }
}
