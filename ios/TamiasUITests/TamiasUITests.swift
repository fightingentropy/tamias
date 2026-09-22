import XCTest

final class TamiasUITests: XCTestCase {
    private var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["-ui-testing", "-reset-ui-testing", "-tamias.appearance", "Light"]
        app.launch()
    }

    func testMainTabsAndSettings() {
        XCTAssertTrue(element("screen.overview").waitForExistence(timeout: 8))
        for (tab, screen) in [("Activity", "screen.activity"), ("Invoices", "screen.invoices"), ("Inbox", "screen.inbox"), ("Tax", "screen.tax"), ("Overview", "screen.overview")] {
            app.tabBars.buttons[tab].tap()
            XCTAssertTrue(element(screen).waitForExistence(timeout: 3))
            saveScreenshot(tab)
        }
        app.buttons["workspace.settings"].tap()
        let done = app.buttons["Done"]
        XCTAssertTrue(done.waitForExistence(timeout: 3))
        done.tap()
        XCTAssertTrue(element("screen.overview").waitForExistence(timeout: 3))
    }

    func testSignedOutLaunchRequiresSignInOrExplicitDemo() {
        app.terminate()
        app.launchArguments = ["-ui-testing", "-signed-out-ui-testing", "-reset-ui-testing"]
        app.launch()
        XCTAssertTrue(element("screen.signIn").waitForExistence(timeout: 8))
        XCTAssertFalse(app.staticTexts["Northstar Studio"].exists)
        XCTAssertFalse(app.tabBars.buttons["Activity"].exists)
        XCTAssertTrue(app.textFields["auth.email"].exists)
        XCTAssertFalse(app.buttons["auth.connect"].isEnabled)
        saveScreenshot("Signed out without sample finances")
        app.buttons["auth.exploreDemo"].tap()
        XCTAssertTrue(element("screen.overview").waitForExistence(timeout: 4))
        XCTAssertTrue(app.staticTexts["Northstar Studio"].exists)
        app.buttons["workspace.settings"].tap()
        let leave = app.buttons["Leave sample workspace"]
        reveal(leave)
        leave.tap()
        XCTAssertTrue(element("screen.signIn").waitForExistence(timeout: 4))
        XCTAssertFalse(app.staticTexts["Northstar Studio"].exists)
    }

    func testTaxYearReviewAndFilingReadiness() {
        app.tabBars.buttons["Tax"].tap()
        XCTAssertTrue(element("screen.tax").waitForExistence(timeout: 5))
        XCTAssertEqual(app.staticTexts["tax.profit"].label, "£10,834.00")
        saveScreenshot("Tax year overview")
        app.buttons["tax.transactions"].tap()
        XCTAssertTrue(element("screen.taxTransactions").waitForExistence(timeout: 3))
        app.buttons["tax.select"].tap()
        app.buttons["tax.transaction.tax-demo-5"].tap()
        app.buttons["tax.transaction.tax-demo-6"].tap()
        app.buttons["tax.reviewSelected"].tap()
        XCTAssertTrue(element("screen.taxReview").waitForExistence(timeout: 3))
        XCTAssertTrue(app.staticTexts["Selected transactions"].exists)
        XCTAssertFalse(app.buttons["tax.saveReview"].isEnabled, "Sample tax data cannot be saved as a real review.")
        saveScreenshot("Bulk tax review")
        app.buttons["Cancel"].tap()
        app.navigationBars.buttons.element(boundBy: 0).tap()
        app.buttons["tax.preparation"].tap()
        XCTAssertTrue(element("screen.taxPreparation").waitForExistence(timeout: 3))
        reveal(app.buttons["tax.filing"])
        app.buttons["tax.filing"].tap()
        XCTAssertTrue(element("screen.taxFiling").waitForExistence(timeout: 3))
        let prepare = app.buttons["tax.prepareReturn"]
        reveal(prepare)
        XCTAssertTrue(prepare.exists)
        XCTAssertFalse(prepare.isEnabled)
        saveScreenshot("HMRC filing readiness")
    }

    func testInvoiceValidationAndDraftSurvivesRelaunch() {
        app.buttons["action.newInvoice"].tap()
        let save = app.buttons["draft.save"]
        XCTAssertTrue(save.waitForExistence(timeout: 3))
        XCTAssertFalse(save.isEnabled, "An empty invoice must not be saved.")

        let customer = app.textFields["draft.customer"]
        customer.tap()
        customer.typeText("Studio UI Test")
        let description = element("draft.description")
        description.tap()
        description.typeText("September design work")
        let amount = app.textFields["draft.amount"]
        amount.tap()
        amount.typeText("1250")
        XCTAssertTrue(save.isEnabled)
        reveal(save)
        save.tap()
        XCTAssertTrue(save.waitForNonExistence(timeout: 3))
        XCTAssertTrue(element("screen.overview").waitForExistence(timeout: 3))

        app.terminate()
        app.launchArguments = ["-ui-testing"]
        app.launch()
        app.tabBars.buttons["Invoices"].tap()
        app.buttons["Drafts"].tap()
        XCTAssertTrue(app.staticTexts["Studio UI Test"].waitForExistence(timeout: 4), "A saved draft should remain after relaunch.")
        saveScreenshot("Persistent invoice draft")
        app.staticTexts["Studio UI Test"].tap()
        XCTAssertTrue(element("screen.draft").waitForExistence(timeout: 3))
        app.buttons["draft.edit"].tap()
        let editedAmount = app.textFields["draft.amount"]
        XCTAssertTrue(editedAmount.waitForExistence(timeout: 3))
        // The field is right aligned; a centre tap places the caret before its
        // existing value. Tap at its trailing edge before replacing the text.
        editedAmount.coordinate(withNormalizedOffset: CGVector(dx: 0.98, dy: 0.5)).tap()
        let existingValue = editedAmount.value as? String ?? ""
        editedAmount.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: existingValue.count) + "1500")
        XCTAssertEqual(editedAmount.value as? String, "1500")
        reveal(app.buttons["draft.save"])
        app.buttons["draft.save"].tap()
        XCTAssertTrue(app.buttons["draft.save"].waitForNonExistence(timeout: 3))
        let savedTotal = app.staticTexts["draft.savedTotal"]
        reveal(savedTotal)
        XCTAssertTrue(savedTotal.waitForExistence(timeout: 3))
        XCTAssertEqual(savedTotal.label, "£1,500.00")
        saveScreenshot("Edited invoice draft")
        reveal(app.buttons["draft.export"])
        app.buttons["draft.export"].tap()
        let previewDone = app.buttons["QLOverlayDoneButtonAccessibilityIdentifier"]
        XCTAssertTrue(previewDone.waitForExistence(timeout: 5), "The generated draft should open in the native PDF preview.")
        XCTAssertTrue(app.staticTexts["DRAFT TOTAL"].waitForExistence(timeout: 5))
        saveScreenshot("Draft PDF preview")
        previewDone.tap()
        XCTAssertTrue(previewDone.waitForNonExistence(timeout: 3))
        XCTAssertTrue(element("screen.draft").waitForExistence(timeout: 3))
    }

    func testReceiptCaptureCanBeCancelled() {
        app.buttons["action.capture"].tap()
        #if targetEnvironment(simulator)
        let cancel = app.buttons["capture.cancel"]
        XCTAssertTrue(cancel.waitForExistence(timeout: 3))
        XCTAssertTrue(element("capture.cameraUnavailable").waitForExistence(timeout: 3))
        XCTAssertFalse(app.buttons["capture.saveReceipt"].exists, "Only show Save after choosing a receipt.")
        XCTAssertTrue(app.buttons["capture.importPhoto"].isHittable)
        saveScreenshot("Receipt import fallback")
        cancel.tap()
        XCTAssertTrue(cancel.waitForNonExistence(timeout: 3))
        #else
        // The actual VisionKit camera must open from one tap on Scan receipt.
        if app.alerts.firstMatch.waitForExistence(timeout: 2) {
            let allow = app.alerts.buttons.matching(NSPredicate(format: "label IN %@", ["Allow", "OK"])).firstMatch
            if allow.exists { allow.tap() }
        }
        XCTAssertTrue(element("capture.documentScanner").waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertFalse(app.buttons["capture.scanReceipt"].isHittable, "The chooser must not require a second scan tap.")
        saveScreenshot("Scanner opened directly on iPhone")
        app.buttons["Cancel"].firstMatch.tap()
        XCTAssertTrue(element("capture.documentScanner").waitForNonExistence(timeout: 5))
        #endif
        XCTAssertTrue(element("screen.overview").waitForExistence(timeout: 3))
        XCTAssertTrue(app.buttons["action.capture"].isHittable, "Cancelling the initial scan should return to Home.")
    }

    func testDarkAppearanceAndInboxImport() {
        app.terminate()
        app.launchArguments = ["-ui-testing", "-reset-ui-testing", "-tamias.appearance", "Dark"]
        app.launch()
        XCTAssertTrue(element("screen.overview").waitForExistence(timeout: 8))
        saveScreenshot("Black Home")
        app.tabBars.buttons["Invoices"].tap()
        XCTAssertTrue(element("screen.invoices").waitForExistence(timeout: 3))
        saveScreenshot("Black Invoices")
        app.tabBars.buttons["Inbox"].tap()
        XCTAssertTrue(element("screen.inbox").waitForExistence(timeout: 3))
        saveScreenshot("Black Inbox")
        app.buttons["inbox.addReceipt"].tap()
        app.buttons["Import receipt"].tap()
        XCTAssertTrue(app.buttons["capture.importPhoto"].waitForExistence(timeout: 3))
        XCTAssertFalse(element("capture.documentScanner").exists, "Import must not open the camera.")
        XCTAssertFalse(app.buttons["capture.saveReceipt"].exists)
        saveScreenshot("Black receipt import")
        app.buttons["capture.cancel"].tap()
        XCTAssertTrue(element("screen.inbox").waitForExistence(timeout: 3))
    }

    func testHomeDrilldownsOpenTheRelevantFilters() {
        let outstanding = app.buttons["home.outstanding"]
        reveal(outstanding)
        outstanding.tap()
        XCTAssertTrue(element("screen.invoices").waitForExistence(timeout: 4))
        XCTAssertTrue(app.buttons["Outstanding"].isSelected)
        app.tabBars.buttons["Overview"].tap()
        let income = app.buttons["home.income"]
        if !income.isHittable { app.swipeDown() }
        XCTAssertTrue(income.isHittable)
        income.tap()
        XCTAssertTrue(element("screen.activity").waitForExistence(timeout: 4))
        XCTAssertTrue(app.buttons["Income"].isSelected)
        XCTAssertTrue(app.staticTexts["This month"].exists)
        app.buttons["Clear filters"].tap()
        XCTAssertFalse(app.staticTexts["This month"].exists)
        saveScreenshot("Home income drilldown")
    }

    func testActivitySearchAndTransactionDetail() {
        app.tabBars.buttons["Activity"].tap()
        let search = app.searchFields["Search all transactions"]
        XCTAssertTrue(search.waitForExistence(timeout: 3))
        let rows = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "transaction."))
        XCTAssertTrue(rows.firstMatch.waitForExistence(timeout: 3))
        search.tap()
        search.typeText("no matching transaction 123")
        XCTAssertTrue(rows.firstMatch.waitForNonExistence(timeout: 4))
        search.buttons["Clear text"].tap()
        XCTAssertTrue(rows.firstMatch.waitForExistence(timeout: 3))
        if app.buttons["Cancel"].exists { app.buttons["Cancel"].tap() }
        rows.firstMatch.tap()
        XCTAssertTrue(element("screen.transaction").waitForExistence(timeout: 3))
        saveScreenshot("Transaction detail")
    }

    private func reveal(_ element: XCUIElement) {
        for _ in 0..<8 {
            if element.isHittable { return }
            app.swipeUp()
        }
        XCTAssertTrue(element.isHittable)
    }

    private func element(_ identifier: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: identifier).firstMatch
    }

    private func saveScreenshot(_ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
