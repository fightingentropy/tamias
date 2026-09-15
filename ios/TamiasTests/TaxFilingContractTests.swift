import XCTest
@testable import Tamias

final class TaxFilingContractTests: XCTestCase {
    func testGeneratedBackendFixtureDecodesIntoNativeFilingModels() throws {
        struct Fixture: Decodable {
            let report: SoleTraderReport
            let filing: TaxFiling
            let returnXml: String
            let receiptXml: String
        }
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "SelfAssessment", withExtension: "json"))
        let fixture = try TamiasAPIClient.decoder().decode(Fixture.self, from: Data(contentsOf: url))
        XCTAssertEqual(fixture.report.taxYear, 2025)
        XCTAssertEqual(fixture.report.fingerprint.count, 64)
        XCTAssertEqual(fixture.report.profitPence, 3_965_577)
        XCTAssertTrue(fixture.report.filingBlockers.isEmpty)
        XCTAssertEqual(fixture.filing.fingerprint, fixture.report.fingerprint)
        XCTAssertEqual(fixture.filing.statusLabel, "Prepared · not sent")
        XCTAssertEqual(fixture.filing.calculation.incomePounds, 40_000)
        XCTAssertEqual(fixture.filing.calculation.expensesPounds, 346)
        XCTAssertEqual(fixture.filing.calculation.incomeTaxPence, 541_680)
        XCTAssertEqual(fixture.filing.calculation.class4Pence, 162_504)
        XCTAssertEqual(fixture.filing.calculation.totalTaxPence, 704_184)
        XCTAssertTrue(fixture.filing.isTest)
        XCTAssertNil(fixture.filing.receipt)
        XCTAssertFalse(fixture.returnXml.contains("<SenderID>"))
        XCTAssertFalse(fixture.returnXml.contains("<Authentication>"))
        XCTAssertTrue(fixture.receiptXml.contains("not an HMRC receipt"))
    }
}
