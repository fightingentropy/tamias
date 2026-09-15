import XCTest

/// The app's real views, API encoding/decoding, workspace checks and system share sheet,
/// backed by an in-process fictional service. These are not HMRC recognition tests.
final class TaxFilingUITests: XCTestCase {
    private var app: XCUIApplication!
    private let filingID = "11111111-1111-4111-a111-111111111111"

    override func setUpWithError() throws { continueAfterFailure = false }

    func testPrepareDeclareAcceptAndExportReceipt() throws {
        try launch(scenario: "accepted")
        prepareReturn()
        let submit = app.buttons["tax.filing.submit"]
        reveal(submit)
        XCTAssertFalse(submit.isEnabled, "A separate declaration is required after preparation.")
        turnOn("tax.filing.declaration")
        submit.tap()
        confirmSubmission()
        assertStatus("Received · awaiting acceptance")
        poll()
        assertStatus("Test accepted")
        XCTAssertFalse(app.buttons["tax.filing.submit"].exists)
        record("Synthetic UI test - accepted return")
        let export = app.buttons["tax.filing.saveEvidence"]
        reveal(export); export.tap()
        let shareFile = app.otherElements.containing(NSPredicate(format: "label CONTAINS %@", "Tamias-Self-Assessment-2025-receipt")).firstMatch
        XCTAssertTrue(shareFile.waitForExistence(timeout: 5), app.debugDescription)
        record("Synthetic UI test - receipt export")
    }

    func testPollingFailureCanBeRetriedWithoutResubmitting() throws {
        try launch(scenario: "retry")
        prepareReturn(); submitReturn()
        poll()
        XCTAssertTrue(app.staticTexts["tax.filing.error"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["tax.filing.submit"].exists)
        poll()
        assertStatus("Test accepted")
    }

    func testLostSubmissionResponseIsReconciledFromHistory() throws {
        try launch(scenario: "timeout")
        prepareReturn(); submitReturn()
        XCTAssertTrue(app.staticTexts["tax.filing.error"].waitForExistence(timeout: 5))
        app.navigationBars.buttons.element(boundBy: 0).tap()
        let row = app.buttons["tax.filing.\(filingID)"]
        XCTAssertTrue(row.waitForExistence(timeout: 5))
        reveal(row); row.tap()
        assertStatus("Outcome needs checking")
        XCTAssertFalse(app.buttons["tax.filing.submit"].exists, "An uncertain submission must not offer another send.")
        record("Synthetic UI test - uncertain submission")
        poll()
        assertStatus("Test accepted")
    }

    func testRejectedReturnShowsHMRCErrorWithoutOfferingResubmission() throws {
        try launch(scenario: "rejected")
        prepareReturn(); submitReturn(); poll()
        assertStatus("Rejected by HMRC")
        XCTAssertTrue(app.staticTexts["Review the synthetic taxpayer reference."].exists)
        XCTAssertFalse(app.buttons["tax.filing.submit"].exists)
        record("Synthetic UI test - rejected return")
    }

    func testUnsupportedIncomeBlocksPreparation() throws {
        try launch(scenario: "unsupported")
        XCTAssertTrue(app.staticTexts["Employment income needs another filing route."].exists)
        let prepare = app.buttons["tax.prepareReturn"]
        reveal(prepare)
        XCTAssertFalse(prepare.isEnabled)
    }

    private func launch(scenario: String) throws {
        #if !targetEnvironment(simulator)
        throw XCTSkip("Fictional filing service is compiled only for the Debug simulator app.")
        #endif
        app = XCUIApplication()
        app.launchArguments = ["-ui-testing", "-reset-ui-testing", "-tax-filing-ui-testing", "-tamias.appearance", "Light"]
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "SelfAssessment", withExtension: "json"))
        app.launchEnvironment["TAMIAS_TAX_UI_FIXTURE"] = try String(contentsOf: url, encoding: .utf8)
        app.launchEnvironment["TAMIAS_TAX_UI_SCENARIO"] = scenario
        app.launch()
        XCTAssertTrue(app.staticTexts["Synthetic filing test"].waitForExistence(timeout: 8))
        app.tabBars.buttons["Tax"].tap()
        XCTAssertTrue(app.buttons["tax.preparation"].waitForExistence(timeout: 5))
        app.buttons["tax.preparation"].tap()
        let filing = app.buttons["tax.filing"]
        reveal(filing); filing.tap()
        XCTAssertTrue(app.staticTexts["Test submissions do not file your tax return."].waitForExistence(timeout: 5), app.debugDescription)
    }

    private func prepareReturn() {
        let prepare = app.buttons["tax.prepareReturn"]
        reveal(prepare); prepare.tap()
        let save = app.buttons["tax.identity.prepare"]
        XCTAssertTrue(save.waitForExistence(timeout: 3))
        XCTAssertFalse(save.isEnabled)
        for (id, value) in [("name", "Example Taxpayer"), ("utr", "1234567890"), ("nino", "AB123456C\n")] {
            let field = app.textFields["tax.identity.\(id)"]
            field.tap(); field.typeText(value)
        }
        XCTAssertFalse(save.isEnabled, "Identity alone is insufficient without the scope confirmations.")
        for id in ["onlyIncome", "allowance", "noOtherCharges", "fullYear", "nationalInsurance"] {
            turnOn("tax.identity.\(id)")
        }
        XCTAssertTrue(save.isEnabled, app.debugDescription)
        save.tap()
        XCTAssertTrue(save.waitForNonExistence(timeout: 5))
        let row = app.buttons["tax.filing.\(filingID)"]
        XCTAssertTrue(row.waitForExistence(timeout: 5))
        reveal(row); row.tap()
        assertStatus("Prepared · not sent")
    }

    private func submitReturn() {
        let submit = app.buttons["tax.filing.submit"]
        reveal(submit)
        turnOn("tax.filing.declaration")
        submit.tap(); confirmSubmission()
    }

    private func confirmSubmission() {
        let confirm = app.buttons["tax.filing.confirmSubmit"].firstMatch
        XCTAssertTrue(confirm.waitForExistence(timeout: 3), app.debugDescription); confirm.tap()
    }

    private func turnOn(_ id: String) {
        let row = app.switches[id].firstMatch
        // SwiftUI exposes the labelled row and the actual UISwitch separately.
        // Tap the control, since a tap on the label does not change the value.
        let control = row.switches.firstMatch
        reveal(control); control.tap()
        XCTAssertEqual(row.value as? String, "1", app.debugDescription)
    }

    private func poll() {
        let button = app.buttons["tax.filing.poll"]
        reveal(button)
        let enabled = XCTNSPredicateExpectation(predicate: NSPredicate(format: "enabled == true"), object: button)
        XCTAssertEqual(XCTWaiter.wait(for: [enabled], timeout: 6), .completed)
        button.tap()
    }

    private func assertStatus(_ label: String) {
        let status = app.staticTexts["tax.filing.status"]
        for _ in 0..<8 { if status.isHittable { break }; app.swipeDown() }
        let expected = XCTNSPredicateExpectation(predicate: NSPredicate(format: "label == %@", label), object: status)
        XCTAssertEqual(XCTWaiter.wait(for: [expected], timeout: 5), .completed)
    }

    private func reveal(_ element: XCUIElement) {
        for _ in 0..<10 { if element.exists && element.isHittable { return }; app.swipeUp() }
        XCTAssertTrue(element.exists && element.isHittable)
    }

    private func record(_ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name; attachment.lifetime = .keepAlways
        add(attachment)
    }
}
