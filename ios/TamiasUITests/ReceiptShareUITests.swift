import XCTest

/// Exercises an actual system Share extension invocation, without selecting personal files.
final class ReceiptShareUITests: XCTestCase {
    func testShareExtensionQueuesAnOriginalForExplicitWorkspaceReview() throws {
        #if !targetEnvironment(simulator)
        throw XCTSkip("The shared receipt fixture is restricted to simulator Photos.")
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
        let save = app.buttons["capture.saveReceipt"]
        let ready = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == true AND enabled == true"), object: save)
        XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 15), .completed)
        save.tap()
        XCTAssertTrue(element("capture.savedConfirmation", app).waitForExistence(timeout: 8))
        save.tap()
        app.tabBars.buttons["Inbox"].tap()
        let receipt = app.staticTexts["New receipt"].firstMatch
        reveal(receipt, app); receipt.tap()
        let share = app.buttons["receipt.shareOriginal"]
        XCTAssertTrue(share.waitForExistence(timeout: 5))
        share.tap()
        let tamias = app.cells.matching(NSPredicate(format: "label == 'Tamias'")).firstMatch
        if !tamias.waitForExistence(timeout: 3) {
            let more = app.cells.matching(NSPredicate(format: "label == 'More'")).firstMatch
            XCTAssertTrue(more.waitForExistence(timeout: 5), app.debugDescription)
            more.tap()
        }
        XCTAssertTrue(tamias.waitForExistence(timeout: 5), app.debugDescription)
        record("System share sheet with Tamias", app)
        tamias.tap()
        let queueSave = app.buttons["share.save"]
        XCTAssertTrue(queueSave.waitForExistence(timeout: 10), app.debugDescription)
        let queueReady = XCTNSPredicateExpectation(predicate: NSPredicate(format: "enabled == true"), object: queueSave)
        XCTAssertEqual(XCTWaiter.wait(for: [queueReady], timeout: 15), .completed)
        queueSave.tap()
        XCTAssertTrue(app.staticTexts["Ready to review"].waitForExistence(timeout: 8), app.debugDescription)
        let screenshot = XCTAttachment(screenshot: app.screenshot()); screenshot.name = "Real share extension saved to App Group"; screenshot.lifetime = .keepAlways; add(screenshot)
        app.buttons["Done"].firstMatch.tap()
        app.terminate()
        app.launchArguments = ["-ui-testing"]
        app.launch()
        app.tabBars.buttons["Inbox"].tap()
        XCTAssertTrue(app.staticTexts["Shared with Tamias"].waitForExistence(timeout: 8), "The App Group queue must reach the main app.")
        let pending = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "sharedReceipt.")).firstMatch
        reveal(pending, app); pending.tap()
        let reviewedSave = app.buttons["capture.saveReceipt"]
        XCTAssertTrue(reviewedSave.waitForExistence(timeout: 8))
        XCTAssertEqual(reviewedSave.label, "Save to Demo workspace")
        let reviewReady = XCTNSPredicateExpectation(predicate: NSPredicate(format: "enabled == true"), object: reviewedSave)
        XCTAssertEqual(XCTWaiter.wait(for: [reviewReady], timeout: 10), .completed)
        record("Shared receipt awaiting workspace review", app)
        reviewedSave.tap()
        XCTAssertTrue(element("capture.savedConfirmation", app).waitForExistence(timeout: 8))
        reviewedSave.tap()
        XCTAssertTrue(app.staticTexts["Shared with Tamias"].waitForNonExistence(timeout: 5), "Reviewed imports must leave the pending queue after the sheet dismisses.")
        #endif
    }

    private func element(_ id: String, _ app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: id).firstMatch
    }
    private func record(_ name: String, _ app: XCUIApplication) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
    }
    private func reveal(_ target: XCUIElement, _ app: XCUIApplication) {
        for _ in 0..<6 {
            if target.isHittable && target.frame.minY > 120 && target.frame.maxY < app.frame.maxY - 85 { return }
            app.swipeUp()
        }
        XCTAssertTrue(target.isHittable)
    }
}
