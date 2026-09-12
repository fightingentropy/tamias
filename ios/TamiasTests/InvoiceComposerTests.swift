import XCTest
@testable import Tamias

final class InvoiceComposerTests: XCTestCase {
    func testMultipleLineItemsAndVATSurviveDraftRoundTrip() throws {
        var fields = InvoiceDraftFields(draft: nil, workspaceCurrency: "GBP")
        fields.customer = "Fixture studio"
        fields.items = [
            InvoiceLineFields(name: "Design", quantity: "3", unitPrice: "19.99"),
            InvoiceLineFields(name: "Production", quantity: "2", unitPrice: "49.50")
        ]
        fields.vatRate = "20"
        fields.paymentDetails = "Fixture payment instructions"
        fields.fromDetails = "Fixture business"
        XCTAssertTrue(fields.isValid)
        XCTAssertEqual(fields.subtotal, 158.97, accuracy: 0.001)
        XCTAssertEqual(fields.vatAmount, 31.79, accuracy: 0.001)
        XCTAssertEqual(fields.total, 190.76, accuracy: 0.001)
        let draft = fields.makeDraft(id: UUID(), createdAt: .now)
        let decoded = try JSONDecoder().decode(InvoiceDraft.self, from: JSONEncoder().encode(draft))
        XCTAssertEqual(decoded.lineItems.count, 2)
        XCTAssertEqual(decoded.paymentDetails, fields.paymentDetails)
        XCTAssertEqual(decoded.amount, 190.76, accuracy: 0.001)
        let restored = InvoiceDraftFields(draft: decoded, workspaceCurrency: "USD")
        XCTAssertEqual(restored.currency, "GBP")
        XCTAssertEqual(restored.items.map(\.item), fields.items.map(\.item))
        XCTAssertEqual(restored.vatAmount, 31.79, accuracy: 0.001)
    }

    func testRejectsAmbiguousPricesInvalidQuantitiesAndInvalidVAT() {
        var fields = InvoiceDraftFields(draft: nil, workspaceCurrency: "GBP")
        fields.customer = "Fixture"
        fields.description = "Work"
        for price in ["-1", "1.234", "1,000.00", "nan", "inf", "1e3", "0"] {
            fields.amount = price
            XCTAssertFalse(fields.isValid, price)
        }
        fields.amount = "12,50"
        XCTAssertTrue(fields.isValid)
        fields.items[0].quantity = "0"
        XCTAssertFalse(fields.isValid)
        fields.items[0].quantity = "1.5"
        XCTAssertTrue(fields.isValid)
        fields.vatRate = "101"
        XCTAssertFalse(fields.isValid)
        fields.vatRate = "-1"
        XCTAssertFalse(fields.isValid)
        fields.vatRate = "20"
        fields.dueDate = fields.issueDate.addingTimeInterval(-86400)
        XCTAssertFalse(fields.isValid)
    }

    func testCurrencyPrecisionSurvivesEditingAndReview() {
        var fields = InvoiceDraftFields(draft: nil, workspaceCurrency: "KWD")
        fields.customer = "Fixture"
        fields.items = [InvoiceLineFields(name: "Service", quantity: "3", unitPrice: "9.995")]
        XCTAssertTrue(fields.isValid)
        let draft = fields.makeDraft(id: UUID(), createdAt: .now)
        let restored = InvoiceDraftFields(draft: draft, workspaceCurrency: "GBP")
        XCTAssertTrue(restored.isValid)
        XCTAssertEqual(restored.items[0].unitPrice, "9.995")
        XCTAssertEqual(restored.total, 29.985, accuracy: 0.0001)
        XCTAssertTrue(TamiasTheme.money(restored.total, currency: "KWD").contains("29.985"))

        fields.currency = "JPY"
        fields.items[0].unitPrice = "1000.1"
        XCTAssertFalse(fields.isValid)
        fields.items[0].unitPrice = "1000"
        XCTAssertTrue(fields.isValid)
        let yenDraft = fields.makeDraft(id: UUID(), createdAt: .now)
        let yenRestored = InvoiceDraftFields(draft: yenDraft, workspaceCurrency: "GBP")
        XCTAssertTrue(yenRestored.isValid)
        XCTAssertEqual(yenRestored.items[0].unitPrice, "1000")
        XCTAssertEqual(yenRestored.total, 3000)
    }
}
