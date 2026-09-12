import XCTest
import Vision

/// Seed the sample PNG with scripts/seed-receipt-fixture.mjs before running.
/// Exercises the real system picker, image conversion, protected file storage,
/// receipt metadata, native original preview, and persistence across relaunch.
final class ReceiptImportUITests: XCTestCase {
    func testPhotoReceiptOriginalAndMetadataSurviveRelaunch() throws {
        #if !targetEnvironment(simulator)
        throw XCTSkip("Sample photo import runs only on a simulator; never select physical-device photos.")
        #else
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments = ["-ui-testing", "-reset-ui-testing"]
        app.launch()
        XCTAssertTrue(element("screen.overview", in: app).waitForExistence(timeout: 8))
        app.buttons["action.capture"].tap()
        app.buttons["capture.importPhoto"].tap()

        let thumbnail = app.images.matching(NSPredicate(format: "label BEGINSWITH[c] %@", "Photo,")).firstMatch
        XCTAssertTrue(thumbnail.waitForExistence(timeout: 8), "Seed SAMPLE-receipt.png before this test. Picker hierarchy: \(app.debugDescription)")
        thumbnail.tap()

        let save = app.buttons["capture.saveReceipt"]
        let ready = NSPredicate(format: "exists == true AND enabled == true")
        expectation(for: ready, evaluatedWith: save)
        waitForExpectations(timeout: 15)
        XCTAssertTrue(app.images["Selected receipt preview"].exists)

        let merchantName = "Sample Coffee Receipt"
        let receiptNote = "Fixture imported through the native Photos picker."
        let merchant = app.textFields["capture.merchant"]
        reveal(merchant, in: app)
        merchant.tap()
        merchant.typeText(merchantName)
        let amount = app.textFields["capture.amount"]
        amount.tap()
        amount.typeText("18.50")
        let note = element("capture.note", in: app)
        reveal(note, in: app)
        note.tap()
        note.typeText(receiptNote)
        save.tap()
        XCTAssertTrue(element("capture.savedConfirmation", in: app).waitForExistence(timeout: 8))
        screenshot("Receipt saved after real Photos import", app: app)
        app.buttons["capture.saveReceipt"].tap()

        try openSavedReceipt(merchant: merchantName, note: receiptNote, in: app)
        try assertOriginalFixture(in: app, name: "Original imported SAMPLE receipt")

        app.terminate()
        app.launchArguments = ["-ui-testing"]
        app.launch()
        XCTAssertTrue(element("screen.overview", in: app).waitForExistence(timeout: 8))
        try openSavedReceipt(merchant: merchantName, note: receiptNote, in: app)
        try assertOriginalFixture(in: app, name: "Persisted original SAMPLE receipt after relaunch")
        #endif
    }

    private func openSavedReceipt(merchant: String, note: String, in app: XCUIApplication) throws {
        app.tabBars.buttons["Inbox"].tap()
        let row = app.staticTexts[merchant].firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 5))
        reveal(row, in: app)
        row.tap()
        XCTAssertTrue(app.staticTexts["£18.50"].waitForExistence(timeout: 4))
        let storedNote = app.staticTexts[note]
        reveal(storedNote, in: app)
        XCTAssertTrue(storedNote.exists, "Receipt metadata must remain readable after saving.")
        let original = app.buttons["View receipt"]
        reveal(original, in: app)
        original.tap()
        XCTAssertTrue(app.buttons["QLOverlayDoneButtonAccessibilityIdentifier"].waitForExistence(timeout: 5), "The saved image file must open in native QuickLook.")
    }

    private func assertOriginalFixture(in app: XCUIApplication, name: String) throws {
        // Read the pixels of the actual original preview. This prevents a
        // different simulator photo or a metadata-only save from passing.
        // QuickLook exposes its close control before it decodes the image.
        var recognized = ""
        let pixelsVisible = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
            recognized = (try? self.recognizedText(in: app.screenshot())) ?? ""
            return recognized.contains("MOONBEAM") && recognized.contains("NOT A REAL TRANSACTION")
        }, object: app)
        let rendered = XCTWaiter.wait(for: [pixelsVisible], timeout: 10)
        let capture = app.screenshot()
        let attachment = XCTAttachment(screenshot: capture)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
        XCTAssertEqual(rendered, .completed, "The saved original must display the SAMPLE fixture. Actual preview text: \(recognized)")
    }

    private func recognizedText(in screenshot: XCUIScreenshot) throws -> String {
        guard let cgImage = screenshot.image.cgImage else { return "" }
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.recognitionLanguages = ["en-US"]
        request.usesLanguageCorrection = false
        try VNImageRequestHandler(cgImage: cgImage).perform([request])
        return (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: " ").uppercased()
    }

    private func element(_ identifier: String, in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: identifier).firstMatch
    }

    private func reveal(_ element: XCUIElement, in app: XCUIApplication) {
        for _ in 0..<6 {
            let save = app.buttons["capture.saveReceipt"]
            let bottom = save.exists ? save.frame.minY - 18 : app.frame.maxY - 90
            if element.isHittable && element.frame.maxY < bottom && element.frame.minY > 140 { break }
            let identity = element.identifier.isEmpty ? element.label : element.identifier
            app.scrollViews.containing(element.elementType, identifier: identity).firstMatch.swipeUp()
        }
        XCTAssertTrue(element.isHittable, "Expected the control to become visible: \(element)")
    }

    private func screenshot(_ name: String, app: XCUIApplication) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
