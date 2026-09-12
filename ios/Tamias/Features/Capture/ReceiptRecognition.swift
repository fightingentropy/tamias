import Foundation
import ImageIO
import PDFKit
import Vision

struct ReceiptRecognition: Equatable, Sendable {
    var merchant: String?
    var amount: String?
    var currency: String?
    var date: Date?
    var notice: String?
    var hasSuggestions: Bool { merchant != nil || amount != nil || currency != nil || date != nil }
}

enum ReceiptRecognizer {
    /// OCR is bounded and runs on the device. A PDF's text layer is used when present.
    static func recognize(data: Data, isPDF: Bool, preferredCurrency: String) throws -> ReceiptRecognition {
        try Task.checkCancellation()
        var lines: [String] = []
        var notice: String?
        if isPDF {
            guard let pdf = PDFDocument(data: data), !pdf.isLocked else { throw SharedReceiptError.invalid }
            let pages = min(pdf.pageCount, 3)
            if pdf.pageCount > pages { notice = "Suggestions use the first 3 pages. Review the full document before saving." }
            for index in 0..<pages {
                try Task.checkCancellation()
                guard let page = pdf.page(at: index) else { continue }
                if let text = page.string, text.trimmingCharacters(in: .whitespacesAndNewlines).count > 20 {
                    lines += text.components(separatedBy: .newlines)
                } else if let image = page.thumbnail(of: CGSize(width: 1_600, height: 2_200), for: .cropBox).cgImage {
                    lines += try recognizeImage(image)
                }
            }
        } else {
            guard let source = CGImageSourceCreateWithData(data as CFData, nil),
                  let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
                    kCGImageSourceCreateThumbnailFromImageAlways: true,
                    kCGImageSourceCreateThumbnailWithTransform: true,
                    kCGImageSourceThumbnailMaxPixelSize: 2_400,
                    kCGImageSourceShouldCacheImmediately: true
                  ] as CFDictionary) else { throw SharedReceiptError.invalid }
            lines = try recognizeImage(image)
        }
        var result = ReceiptTextParser.parse(lines: lines, preferredCurrency: preferredCurrency)
        result.notice = notice
        return result
    }

    private static func recognizeImage(_ image: CGImage) throws -> [String] {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true
        request.automaticallyDetectsLanguage = true
        request.minimumTextHeight = 0.012
        try VNImageRequestHandler(cgImage: image).perform([request])
        try Task.checkCancellation()
        // Group text on the same visual line so separated TOTAL and amount columns stay together.
        let observations = (request.results ?? []).sorted { $0.boundingBox.midY > $1.boundingBox.midY }
        var rows: [[VNRecognizedTextObservation]] = []
        for observation in observations {
            if let last = rows.last, let anchor = last.first,
               abs(anchor.boundingBox.midY - observation.boundingBox.midY) < min(anchor.boundingBox.height, observation.boundingBox.height) * 0.6 {
                rows[rows.count - 1].append(observation)
            } else { rows.append([observation]) }
        }
        return rows.map { row in
            row.sorted { $0.boundingBox.minX < $1.boundingBox.minX }.compactMap { $0.topCandidates(1).first?.string }.joined(separator: " ")
        }
    }
}

enum ReceiptTextParser {
    static func parse(lines rawLines: [String], preferredCurrency: String) -> ReceiptRecognition {
        let lines = rawLines.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
        var result = ReceiptRecognition()
        let joined = lines.joined(separator: " ").uppercased()
        let currencyCodes = ["GBP", "EUR", "USD", "CAD", "AUD", "NZD", "CHF", "JPY", "SEK", "NOK", "DKK", "PLN", "ALL"]
        let explicitCodes = currencyCodes.filter { joined.range(of: "\\b\($0)\\b", options: .regularExpression) != nil }
        if explicitCodes.count == 1 { result.currency = explicitCodes[0] }
        else if explicitCodes.isEmpty {
            if joined.contains("£") { result.currency = "GBP" }
            else if joined.contains("€") { result.currency = "EUR" }
            else if joined.contains("$") && ["USD", "CAD", "AUD", "NZD"].contains(preferredCurrency) { result.currency = preferredCurrency }
        }
        var totals: [(rank: Int, value: String)] = []
        for (index, line) in lines.enumerated() {
            let upper = line.uppercased()
            guard !upper.contains("SUBTOTAL"), !upper.contains("SUB TOTAL"), !upper.contains("VAT"),
                  !upper.contains("TAX"), !upper.contains("CHANGE"), !upper.contains("SAVING"), !upper.contains("TIP") else { continue }
            let rank: Int
            if upper.contains("GRAND TOTAL") || upper.contains("AMOUNT DUE") || upper.contains("TOTAL DUE") { rank = 3 }
            else if upper.range(of: #"\bTOTAL\b"#, options: .regularExpression) != nil { rank = 2 }
            else { continue }
            if let value = money(in: line) { totals.append((rank, value)) }
            else if index + 1 < lines.count, let value = money(in: lines[index + 1]),
                    lines[index + 1].range(of: #"^[\s\d.,'’£€$A-Z-]+$"#, options: .regularExpression) != nil {
                totals.append((rank, value))
            }
        }
        if let bestRank = totals.map(\.rank).max() {
            let candidates = Set(totals.filter { $0.rank == bestRank }.map(\.value))
            // Multiple different totals at the same rank require manual review.
            if candidates.count == 1 { result.amount = candidates.first }
        }
        for line in lines.prefix(15) {
            if result.date == nil { result.date = date(in: line) }
        }
        result.merchant = lines.prefix(6).first { line in
            let upper = line.uppercased()
            let excluded = ["SAMPLE", "RECEIPT", "INVOICE", "WELCOME", "THANK YOU", "CUSTOMER COPY", "MERCHANT COPY", "TEL", "WWW.", "HTTP", "VAT", "DATE", "FICTIONAL"]
            return line.count >= 3 && line.count <= 70 && line.contains(where: \.isLetter)
                && !excluded.contains(where: { upper.contains($0) })
                && line.range(of: #"\d|@"#, options: .regularExpression) == nil && date(in: line) == nil
        }
        return result
    }

    static func money(in text: String) -> String? {
        guard let regex = try? NSRegularExpression(pattern: #"(?<![\d.,])(-?\d{1,3}(?:[., '’]\d{3})+[.,]\d{2}|-?\d+[.,]\d{2})(?!\d)"#),
              let match = regex.matches(in: text, range: NSRange(text.startIndex..., in: text)).last,
              let range = Range(match.range, in: text) else { return nil }
        let raw = String(text[range]).replacingOccurrences(of: " ", with: "").replacingOccurrences(of: "'", with: "").replacingOccurrences(of: "’", with: "")
        guard !raw.hasPrefix("-"), let decimalIndex = raw.lastIndex(where: { $0 == "." || $0 == "," }) else { return nil }
        let whole = raw[..<decimalIndex].filter(\.isNumber)
        let fraction = raw[raw.index(after: decimalIndex)...]
        let normalized = "\(whole).\(fraction)"
        guard let number = Decimal(string: normalized), number >= 0, number <= 100_000_000 else { return nil }
        return normalized
    }

    static func date(in text: String) -> Date? {
        // Numeric day/month dates are intentionally left for the user when both interpretations work.
        let patterns = [
            (#"\b\d{4}-\d{2}-\d{2}\b"#, ["yyyy-MM-dd"]),
            (#"\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b"#, ["d MMMM yyyy", "d MMM yyyy"]),
            (#"\b[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}\b"#, ["MMMM d, yyyy", "MMM d, yyyy", "MMMM d yyyy", "MMM d yyyy"])
        ]
        for (pattern, formats) in patterns {
            guard let range = text.range(of: pattern, options: .regularExpression) else { continue }
            for format in formats {
                let formatter = DateFormatter(); formatter.locale = Locale(identifier: "en_GB")
                formatter.timeZone = TimeZone(secondsFromGMT: 0); formatter.dateFormat = format; formatter.isLenient = false
                if let value = formatter.date(from: String(text[range])) { return value }
            }
        }
        return nil
    }
}
