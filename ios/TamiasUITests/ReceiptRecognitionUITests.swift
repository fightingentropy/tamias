import XCTest

/// Uses the real Photos picker and Vision results from the explicitly seeded SAMPLE image.
final class ReceiptRecognitionUITests: XCTestCase {
    func testReceiptSuggestionsNeedAcceptanceAndDetailsRemainEditable() throws {
        #if !targetEnvironment(simulator)
        throw XCTSkip("Receipt fixture tests only use simulator Photos.")
        #else
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments = ["-ui-testing", "-reset-ui-testing"]
        app.launch()
        XCTAssertTrue(element("screen.overview", app).waitForExistence(timeout: 8))
        app.buttons["action.capture"].tap()
        app.buttons["capture.importPhoto"].tap()
        let photo = app.images.matching(NSPredicate(format: "label BEGINSWITH[c] %@", "Photo,")).firstMatch
        XCTAssertTrue(photo.waitForExistence(timeout: 8), "Seed SAMPLE-receipt.png before running.")
        photo.tap()
        let ready = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == true AND enabled == true"), object: app.buttons["capture.saveReceipt"])
        XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 15), .completed)
        app.swipeUp()
        let suggestions = app.buttons["receipt.useSuggestions"]
        XCTAssertTrue(suggestions.waitForExistence(timeout: 20), "Real Vision recognition should produce reviewable suggestions. \(app.debugDescription)")
        let merchant = app.textFields["capture.merchant"]
        XCTAssertEqual(merchant.value as? String, "Merchant", "OCR must not silently fill user-editable fields.")
        reveal(suggestions, app)
        let evidence = XCTAttachment(screenshot: app.screenshot())
        evidence.name = "On-device OCR suggestions awaiting review"
        evidence.lifetime = .keepAlways
        add(evidence)
        suggestions.tap()
        reveal(merchant, app)
        XCTAssertEqual(merchant.value as? String, "MOONBEAM COFFEE")
        let amount = app.textFields["capture.amount"]
        XCTAssertEqual(amount.value as? String, "18.50")
        XCTAssertEqual(app.switches["receipt.hasDate"].value as? String, "1")
        app.buttons["capture.saveReceipt"].tap()
        XCTAssertTrue(element("capture.savedConfirmation", app).waitForExistence(timeout: 8))
        app.buttons["capture.saveReceipt"].tap()
        app.tabBars.buttons["Inbox"].tap()
        let row = app.staticTexts["MOONBEAM COFFEE"].firstMatch
        reveal(row, app); row.tap()
        let edit = app.buttons["receipt.edit"]
        reveal(edit, app); edit.tap()
        let editorMerchant = app.textFields["receipt.editMerchant"]
        XCTAssertTrue(editorMerchant.waitForExistence(timeout: 5))
        reveal(editorMerchant, app)
        editorMerchant.coordinate(withNormalizedOffset: CGVector(dx: 0.98, dy: 0.5)).tap()
        editorMerchant.typeText(" REVIEWED")
        app.buttons["receipt.saveDetails"].tap()
        XCTAssertTrue(app.staticTexts["MOONBEAM COFFEE REVIEWED"].waitForExistence(timeout: 5))
        app.terminate()
        app.launchArguments = ["-ui-testing"]
        app.launch()
        app.tabBars.buttons["Inbox"].tap()
        XCTAssertTrue(app.staticTexts["MOONBEAM COFFEE REVIEWED"].waitForExistence(timeout: 5))
        #endif
    }

    private func element(_ id: String, _ app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: id).firstMatch
    }
    private func reveal(_ target: XCUIElement, _ app: XCUIApplication) {
        for _ in 0..<8 {
            let footer = app.buttons["capture.saveReceipt"]
            let lowerBound = footer.exists ? footer.frame.minY - 10 : app.frame.maxY - 85
            if target.isHittable && target.frame.maxY < lowerBound && target.frame.minY > 120 { return }
            app.swipeUp()
        }
        XCTAssertTrue(target.isHittable)
    }
}
