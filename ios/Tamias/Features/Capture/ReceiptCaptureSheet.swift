import AVFoundation
import ImageIO
import PDFKit
import PhotosUI
import SwiftUI
import UniformTypeIdentifiers
import VisionKit

enum ReceiptCaptureStart { case scanner, chooser }

struct ReceiptCaptureSheet: View {
    let store: TamiasStore
    let sharedImport: SharedReceiptImport?
    let start: ReceiptCaptureStart
    @State private var expectedWorkspaceID: String

    @Environment(\.dismiss) private var dismiss
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var attachment: ReceiptAttachment?
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var merchant = ""
    @State private var amount = ""
    @State private var currency = "GBP"
    @State private var note = ""
    @State private var isImporting = false
    @State private var isSaving = false
    @State private var showScanner = false
    @State private var showPhotos = false
    @State private var didStart = false
    @State private var scannerCancelled = false
    @State private var scannerUnavailable = false
    @State private var showFiles = false
    @State private var showDiscard = false
    @State private var showSettings = false
    @State private var errorMessage: String?
    @State private var didSave = false
    @State private var importTask: Task<Void, Never>?
    @State private var importID: UUID?
    @State private var receiptDate: Date?
    @State private var recognition: ReceiptRecognition?
    @State private var recognitionTask: Task<Void, Never>?
    @State private var recognitionID: UUID?
    @State private var isRecognizing = false
    @State private var recognitionError: String?

    private var isBusy: Bool { isImporting || isSaving }
    private var currencies: [String] { TamiasCurrencies.choices(preferred: store.currency) }

    init(store: TamiasStore, sharedImport: SharedReceiptImport? = nil, start: ReceiptCaptureStart = .chooser) {
        self.store = store
        self.sharedImport = sharedImport
        self.start = start
        _expectedWorkspaceID = State(initialValue: store.workspaceID)
        _currency = State(initialValue: TamiasCurrencies.choices(preferred: store.currency).first ?? "GBP")
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    if didSave {
                        savedState
                    } else {
                        if let attachment {
                            attachmentPreview(attachment)
                        } else if !isImporting {
                            emptyPreview
                        }
                        if isImporting {
                            HStack(spacing: 10) {
                                ProgressView().tint(TamiasTheme.green)
                                Text("Preparing receipt…")
                                    .font(.subheadline)
                                    .foregroundStyle(TamiasTheme.muted)
                                Spacer()
                                Button("Cancel", action: cancelImport)
                                    .font(.subheadline)
                                    .accessibilityIdentifier("capture.cancelImport")
                            }
                        }
                        if attachment != nil {
                            ReceiptSuggestionsCard(recognition: recognition, isRecognizing: isRecognizing, error: recognitionError) {
                                if let value = recognition?.merchant, merchant.isEmpty { merchant = value }
                                if let value = recognition?.amount, amount.isEmpty { amount = value }
                                if let value = recognition?.currency { currency = value }
                                if receiptDate == nil { receiptDate = recognition?.date }
                            }
                            details
                            Text("Saves on this iPhone.")
                                .font(.caption).foregroundStyle(TamiasTheme.muted)
                        }
                    }
                }
                .padding(20)
                .padding(.bottom, 20)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(TamiasTheme.paper)
            .navigationTitle(didSave ? "Saved" : attachment == nil ? "Add receipt" : "Receipt")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(TamiasTheme.paper, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(didSave ? "Done" : "Close") {
                        cancelImport()
                        if attachment != nil && !didSave {
                            showDiscard = true
                        } else {
                            dismiss()
                        }
                    }
                    .foregroundStyle(TamiasTheme.ink)
                    .disabled(isSaving)
                    .accessibilityIdentifier("capture.cancel")
                }
                if attachment != nil && !didSave && sharedImport == nil {
                    ToolbarItem(placement: .topBarTrailing) {
                        Menu {
                            Button("Scan again", systemImage: "viewfinder", action: openScanner)
                            Button("Photos", systemImage: "photo") { showPhotos = true }
                            Button("Files", systemImage: "folder") { showFiles = true }
                        } label: { Label("Replace receipt", systemImage: "ellipsis") }
                        .disabled(isBusy)
                    }
                }
            }
            .safeAreaInset(edge: .bottom, spacing: 0) {
                bottomAction
            }
            .interactiveDismissDisabled(isSaving || (attachment != nil && !didSave))
            .onDisappear { cancelImport(); cancelRecognition() }
            .task {
                guard !didStart else { return }
                didStart = true
                if let sharedImport {
                    startImport {
                        try await Task.detached(priority: .userInitiated) {
                            let data = try SharedReceiptQueue().data(for: sharedImport)
                            return sharedImport.contentType == UTType.pdf.identifier
                                ? try ReceiptAttachmentProcessor.pdf(data: data, name: sharedImport.originalFileName)
                                : try ReceiptAttachmentProcessor.image(data: data, name: sharedImport.originalFileName)
                        }.value
                    }
                } else if start == .scanner {
                    openScanner()
                }
            }
            .fullScreenCover(isPresented: $showScanner, onDismiss: {
                if scannerCancelled && start == .scanner && attachment == nil { dismiss() }
                scannerCancelled = false
            }) {
                ReceiptDocumentScanner { result in
                    showScanner = false
                    switch result {
                    case .success(let pages):
                        guard let pages else { scannerCancelled = true; return }
                        prepareScan(pages)
                    case .failure(let error):
                        errorMessage = error.localizedDescription
                    }
                }
                .ignoresSafeArea()
            }
            .photosPicker(isPresented: $showPhotos, selection: $selectedPhoto, matching: .images, photoLibrary: .shared())
            .fileImporter(isPresented: $showFiles, allowedContentTypes: [.image, .pdf]) { result in
                switch result {
                case .success(let url): importFile(url)
                case .failure(let error):
                    if (error as NSError).code != NSUserCancelledError {
                        errorMessage = "The file couldn’t be opened. Please try another image or PDF."
                    }
                }
            }
            .onChange(of: selectedPhoto) { _, photo in
                guard let photo else { return }
                importPhoto(photo)
            }
            .alert("Couldn’t add receipt", isPresented: Binding(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
            )) {
                Button("OK", role: .cancel) { errorMessage = nil }
            } message: {
                Text(errorMessage ?? "Please try again.")
            }
            .alert("Allow camera access", isPresented: $showSettings) {
                Button("Open Settings") {
                    guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
                    UIApplication.shared.open(url)
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("To scan a receipt, allow Tamias to use your camera in Settings. You can also choose a photo or file.")
            }
            .confirmationDialog("Discard this receipt?", isPresented: $showDiscard, titleVisibility: .visible) {
                Button("Discard receipt", role: .destructive) { dismiss() }
                Button("Keep editing", role: .cancel) {}
            } message: {
                Text("This receipt hasn’t been saved yet.")
            }
        }
        .tint(TamiasTheme.ink)
    }

    private var emptyPreview: some View {
        VStack(alignment: .leading, spacing: 16) {
            if scannerUnavailable {
                Text("Camera unavailable. Choose a photo or file.")
                    .font(.subheadline).foregroundStyle(TamiasTheme.muted)
                    .accessibilityIdentifier("capture.cameraUnavailable")
            }
            if !scannerUnavailable {
                Button(action: openScanner) { Label("Scan receipt", systemImage: "viewfinder") }
                    .buttonStyle(PrimaryButtonStyle())
                    .accessibilityIdentifier("capture.scanReceipt")
            }
            if sharedImport == nil { importOptions }
        }
        .disabled(isBusy)
    }

    private func attachmentPreview(_ attachment: ReceiptAttachment) -> some View {
        VStack(spacing: 0) {
            Image(uiImage: attachment.preview)
                .resizable()
                .scaledToFit()
                .frame(maxWidth: .infinity)
                .frame(height: 210)
                .padding(14)
                .background(TamiasTheme.line.opacity(0.35))
                .accessibilityLabel("Selected receipt preview")
            if attachment.pageCount > 1 {
                Text("\(attachment.pageCount) pages")
                    .font(.caption).foregroundStyle(TamiasTheme.muted).padding(.bottom, 12)
            }
        }
        .background(TamiasTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(TamiasTheme.line, lineWidth: 1))
    }

    private var importOptions: some View {
        Group {
            if dynamicTypeSize.isAccessibilitySize {
                VStack(spacing: 12) { importButtons }
            } else {
                HStack(spacing: 12) { importButtons }
            }
        }
        .buttonStyle(.plain)
        .disabled(isBusy)
    }

    @ViewBuilder private var importButtons: some View {
            Button { showPhotos = true } label: {
                importLabel("Photos", icon: "photo.on.rectangle")
            }
            .accessibilityIdentifier("capture.importPhoto")
            Button { showFiles = true } label: {
                importLabel("Files", icon: "folder")
            }
            .accessibilityIdentifier("capture.importFile")
    }

    private func importLabel(_ title: String, icon: String) -> some View {
        Label(title, systemImage: icon)
            .font(.subheadline.weight(.medium))
            .foregroundStyle(TamiasTheme.ink)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .frame(minHeight: 50)
            .background(TamiasTheme.surface, in: RoundedRectangle(cornerRadius: 15))
            .overlay(RoundedRectangle(cornerRadius: 15).stroke(TamiasTheme.line, lineWidth: 1))
    }

    private var details: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(spacing: 0) {
                TextField("Merchant", text: $merchant)
                    .textContentType(.organizationName)
                    .submitLabel(.next)
                    .padding(16)
                    .accessibilityIdentifier("capture.merchant")
                Divider().overlay(TamiasTheme.line).padding(.leading, 16)
                HStack {
                    TextField("Total", text: $amount)
                        .keyboardType(.decimalPad)
                        .accessibilityIdentifier("capture.amount")
                    Picker("Currency", selection: $currency) {
                        ForEach(currencies, id: \.self) { Text($0).tag($0) }
                    }
                    .pickerStyle(.menu)
                    .labelsHidden()
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                Divider().overlay(TamiasTheme.line).padding(.leading, 16)
                ReceiptDateField(date: $receiptDate).padding(16)
                Divider().overlay(TamiasTheme.line).padding(.leading, 16)
                TextField("Add a note", text: $note, axis: .vertical)
                    .lineLimit(1...4)
                    .padding(16)
                    .accessibilityIdentifier("capture.note")
            }
            .font(.body)
            .background(TamiasTheme.surface, in: RoundedRectangle(cornerRadius: 18))
            .overlay(RoundedRectangle(cornerRadius: 18).stroke(TamiasTheme.line, lineWidth: 1))
        }
        .foregroundStyle(TamiasTheme.ink)
        .disabled(isBusy)
    }

    private var savedState: some View {
        VStack(spacing: 20) {
            Image(systemName: "checkmark")
                .font(.system(size: 34, weight: .medium))
                .foregroundStyle(TamiasTheme.green)
                .frame(width: 84, height: 84)
                .background(TamiasTheme.green.opacity(0.09), in: Circle())
            Text("Saved to your inbox")
                .font(.title2.weight(.semibold))
            Text("On this iPhone")
                .font(.body)
                .foregroundStyle(TamiasTheme.muted)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 32)
        .accessibilityIdentifier("capture.savedConfirmation")
    }

    @ViewBuilder private var bottomAction: some View {
        if attachment != nil || didSave {
        VStack(spacing: 0) {
            Button {
                if didSave { dismiss() } else { saveReceipt() }
            } label: {
                HStack(spacing: 9) {
                    if isSaving { ProgressView().tint(TamiasTheme.paper) }
                    Text(didSave ? "Done" : (isSaving ? "Saving…" : sharedImport == nil ? "Save receipt" : "Save to \(store.isDemo ? "Demo workspace" : store.teamName)"))
                        .font(.headline)
                }
                .foregroundStyle(TamiasTheme.paper)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .frame(minHeight: 56)
                .background(TamiasTheme.ink, in: RoundedRectangle(cornerRadius: 18))
                .opacity(!didSave && (attachment == nil || isBusy) ? 0.4 : 1)
            }
            .buttonStyle(.plain)
            .disabled(!didSave && (attachment == nil || isBusy))
            .accessibilityIdentifier("capture.saveReceipt")
        }
        .padding(.horizontal, 24)
        .padding(.top, 12)
        .padding(.bottom, 12)
        .background(TamiasTheme.paper)
        }
    }

    private func openScanner() {
        #if targetEnvironment(simulator)
        // Some runtimes advertise camera support but cannot capture a document.
        scannerUnavailable = true
        #else
        guard VNDocumentCameraViewController.isSupported, UIImagePickerController.isSourceTypeAvailable(.camera) else {
            scannerUnavailable = true
            return
        }
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            showScanner = true
        case .notDetermined:
            Task { @MainActor in
                if await AVCaptureDevice.requestAccess(for: .video) {
                    showScanner = true
                } else {
                    showSettings = true
                }
            }
        case .denied, .restricted:
            showSettings = true
        @unknown default:
            errorMessage = "The camera isn’t available. Choose a receipt from Photos or Files instead."
        }
        #endif
    }

    private func importPhoto(_ photo: PhotosPickerItem) {
        startImport(failureHint: " If the photo is in iCloud, check your connection and try again.") {
            guard let data = try await photo.loadTransferable(type: Data.self) else {
                throw ReceiptImportError.unreadableImage
            }
            try Task.checkCancellation()
            return try await Task.detached(priority: .userInitiated) {
                try ReceiptAttachmentProcessor.image(data: data, name: "Receipt photo")
            }.value
        }
    }

    private func importFile(_ url: URL) {
        startImport {
            try await Task.detached(priority: .userInitiated) {
                let hasAccess = url.startAccessingSecurityScopedResource()
                defer { if hasAccess { url.stopAccessingSecurityScopedResource() } }
                let values = try url.resourceValues(forKeys: [.fileSizeKey, .contentTypeKey])
                if let size = values.fileSize, size > ReceiptAttachmentProcessor.maximumBytes {
                    throw ReceiptImportError.tooLarge
                }
                let data = try Data(contentsOf: url, options: [.mappedIfSafe])
                if values.contentType?.conforms(to: .pdf) == true || url.pathExtension.lowercased() == "pdf" {
                    return try ReceiptAttachmentProcessor.pdf(data: data, name: url.lastPathComponent)
                }
                return try ReceiptAttachmentProcessor.image(data: data, name: url.lastPathComponent)
            }.value
        }
    }

    private func prepareScan(_ pages: [UIImage]) {
        startImport {
            try await Task.detached(priority: .userInitiated) {
                try ReceiptAttachmentProcessor.scan(pages: pages)
            }.value
        }
    }

    private func startImport(failureHint: String = "", operation: @escaping () async throws -> ReceiptAttachment) {
        cancelImport()
        let id = UUID()
        importID = id
        isImporting = true
        importTask = Task { @MainActor in
            defer {
                if importID == id {
                    isImporting = false
                    importID = nil
                    importTask = nil
                    selectedPhoto = nil
                }
            }
            do {
                let prepared = try await operation()
                try Task.checkCancellation()
                guard importID == id else { return }
                attachment = prepared
                recognize(prepared)
            } catch {
                guard !Task.isCancelled, importID == id else { return }
                errorMessage = error.localizedDescription + failureHint
            }
        }
    }

    private func cancelImport() {
        importTask?.cancel()
        importTask = nil
        importID = nil
        isImporting = false
        selectedPhoto = nil
    }

    private func saveReceipt() {
        guard let attachment, !isBusy else { return }
        let amountText = amount.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: ",", with: ".")
        if !amountText.isEmpty {
            guard amountText.range(of: #"^\d+(\.\d{1,2})?$"#, options: .regularExpression) != nil,
                  let value = Double(amountText), value.isFinite, value >= 0 else {
                errorMessage = "Enter a valid total, such as 24.50, or leave it empty."
                return
            }
        }
        isSaving = true
        Task { @MainActor in
            defer { isSaving = false }
            do {
                _ = try await store.saveLocalReceipt(
                    data: attachment.data,
                    fileExtension: attachment.fileExtension,
                    merchant: merchant.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
                    amount: amountText.nilIfEmpty,
                    currency: currency,
                    note: note.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty,
                    receiptDate: receiptDate,
                    expectedWorkspaceID: expectedWorkspaceID,
                    sourceImportID: sharedImport?.id
                )
                withAnimation(.easeInOut(duration: 0.25)) { didSave = true }
                if let sharedImport {
                    do { try SharedReceiptQueue().remove(id: sharedImport.id) }
                    catch { errorMessage = "Your receipt was saved. Its shared inbox entry couldn’t be cleared; reviewing it again will not create a duplicate." }
                }
                UINotificationFeedbackGenerator().notificationOccurred(.success)
            } catch {
                errorMessage = "Your receipt wasn’t saved. \(error.localizedDescription)"
            }
        }
    }

    private func recognize(_ attachment: ReceiptAttachment) {
        cancelRecognition()
        let id = UUID(); recognitionID = id; isRecognizing = true; recognition = nil; recognitionError = nil
        let preferred = currency
        recognitionTask = Task { @MainActor in
            defer { if recognitionID == id { isRecognizing = false; recognitionTask = nil } }
            let worker = Task.detached(priority: .utility) {
                try ReceiptRecognizer.recognize(data: attachment.data, isPDF: attachment.fileExtension == "pdf", preferredCurrency: preferred)
            }
            do {
                let result = try await withTaskCancellationHandler { try await worker.value } onCancel: { worker.cancel() }
                guard !Task.isCancelled, recognitionID == id else { return }
                recognition = result
            } catch {
                guard !Task.isCancelled, recognitionID == id else { return }
                recognitionError = "Text couldn’t be read. You can enter the details below."
            }
        }
    }

    private func cancelRecognition() {
        recognitionTask?.cancel(); recognitionTask = nil; recognitionID = nil; isRecognizing = false
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}

struct ReceiptAttachment: @unchecked Sendable {
    let data: Data
    let fileExtension: String
    let name: String
    let pageCount: Int
    let preview: UIImage
}

private enum ReceiptImportError: LocalizedError {
    case unreadableImage, unreadablePDF, tooLarge, tooManyPages, encryptedPDF, invalidScan

    var errorDescription: String? {
        switch self {
        case .unreadableImage: return "This image couldn’t be read. Choose a JPEG, PNG, or HEIC image."
        case .unreadablePDF: return "This PDF couldn’t be read. Try exporting a new copy."
        case .tooLarge: return "Choose a file smaller than 20 MB."
        case .tooManyPages: return "Choose a PDF with 30 pages or fewer."
        case .encryptedPDF: return "This PDF is locked. Choose a copy without a password."
        case .invalidScan: return "Scan between 1 and 10 pages at a time."
        }
    }
}

enum ReceiptAttachmentProcessor {
    static let maximumBytes = 20 * 1_024 * 1_024

    static func image(data: Data, name: String) throws -> ReceiptAttachment {
        guard data.count <= maximumBytes else { throw ReceiptImportError.tooLarge }
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
              let thumbnail = CGImageSourceCreateThumbnailAtIndex(source, 0, [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceCreateThumbnailWithTransform: true,
                kCGImageSourceThumbnailMaxPixelSize: 2_400,
                kCGImageSourceShouldCacheImmediately: true
              ] as CFDictionary) else { throw ReceiptImportError.unreadableImage }
        let preview = UIImage(cgImage: thumbnail)
        if let identifier = CGImageSourceGetType(source), let type = UTType(identifier as String),
           let ext = type.preferredFilenameExtension, ["jpg", "jpeg", "png", "heic", "heif"].contains(ext) {
            return ReceiptAttachment(data: data, fileExtension: ext, name: name, pageCount: 1, preview: preview)
        }
        guard let compressed = preview.jpegData(compressionQuality: 0.82) else {
            throw ReceiptImportError.unreadableImage
        }
        guard compressed.count <= maximumBytes else { throw ReceiptImportError.tooLarge }
        return ReceiptAttachment(data: compressed, fileExtension: "jpg", name: name, pageCount: 1, preview: preview)
    }

    static func pdf(data: Data, name: String) throws -> ReceiptAttachment {
        guard data.count <= maximumBytes else { throw ReceiptImportError.tooLarge }
        guard let document = PDFDocument(data: data) else { throw ReceiptImportError.unreadablePDF }
        guard !document.isLocked else { throw ReceiptImportError.encryptedPDF }
        guard document.pageCount > 0, let first = document.page(at: 0) else { throw ReceiptImportError.unreadablePDF }
        guard document.pageCount <= 30 else { throw ReceiptImportError.tooManyPages }
        let preview = first.thumbnail(of: CGSize(width: 600, height: 800), for: .cropBox)
        return ReceiptAttachment(data: data, fileExtension: "pdf", name: name, pageCount: document.pageCount, preview: preview)
    }

    static func scan(pages: [UIImage]) throws -> ReceiptAttachment {
        guard (1...10).contains(pages.count) else { throw ReceiptImportError.invalidScan }
        if pages.count == 1, let data = pages[0].jpegData(compressionQuality: 0.9) {
            return try image(data: data, name: "Scanned receipt")
        }
        let document = PDFDocument()
        for (index, page) in pages.enumerated() {
            guard let original = page.jpegData(compressionQuality: 0.85) else { throw ReceiptImportError.unreadableImage }
            let prepared = try image(data: original, name: "Page \(index + 1)")
            guard let pdfPage = PDFPage(image: prepared.preview) else { throw ReceiptImportError.unreadablePDF }
            document.insert(pdfPage, at: index)
        }
        guard let data = document.dataRepresentation() else { throw ReceiptImportError.unreadablePDF }
        return try pdf(data: data, name: "Scanned receipt.pdf")
    }
}

private struct ReceiptDocumentScanner: UIViewControllerRepresentable {
    let completion: (Result<[UIImage]?, Error>) -> Void

    func makeUIViewController(context: Context) -> VNDocumentCameraViewController {
        let controller = VNDocumentCameraViewController()
        controller.delegate = context.coordinator
        controller.view.accessibilityIdentifier = "capture.documentScanner"
        return controller
    }

    func updateUIViewController(_ uiViewController: VNDocumentCameraViewController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(completion: completion) }

    final class Coordinator: NSObject, VNDocumentCameraViewControllerDelegate {
        let completion: (Result<[UIImage]?, Error>) -> Void

        init(completion: @escaping (Result<[UIImage]?, Error>) -> Void) {
            self.completion = completion
        }

        func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFinishWith scan: VNDocumentCameraScan) {
            guard (1...10).contains(scan.pageCount) else {
                completion(.failure(ReceiptImportError.invalidScan))
                return
            }
            completion(.success((0..<scan.pageCount).map { scan.imageOfPage(at: $0) }))
        }

        func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
            completion(.success(nil))
        }

        func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFailWithError error: Error) {
            completion(.failure(error))
        }
    }
}
