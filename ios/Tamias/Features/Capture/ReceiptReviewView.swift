import QuickLook
import SwiftUI

struct ReceiptReviewView: View {
    @Bindable var store: TamiasStore
    let receiptID: UUID
    @State private var previewURL: URL?
    @State private var showEdit = false
    @State private var showSync = false
    @State private var showMatches = false
    @State private var isSyncing = false
    @State private var error: String?
    @State private var reviewedWorkspace = ""
    private var receipt: ReceiptCapture? { store.capturedReceipts.first { $0.id == receiptID } }

    var body: some View {
        ScrollView {
            if let receipt {
                VStack(alignment: .leading, spacing: 24) {
                    MerchantIcon(name: receipt.name, symbol: "doc.viewfinder").padding(.top, 12)
                    Text(receipt.name).font(.system(size: 32, design: .default))
                    StatusPill(text: receipt.status, tone: receipt.syncStatus == .failed ? TamiasTheme.amber : TamiasTheme.green)
                    if let amount = receipt.amount { Text(TamiasTheme.money(amount, currency: receipt.currency)).font(.system(size: 40, design: .rounded)) }
                    VStack(spacing: 0) {
                        DetailLine(title: "Receipt date", value: receipt.receiptDate?.formatted(TamiasTheme.ledgerShort) ?? "Not set")
                        DetailLine(title: "Saved", value: receipt.createdAt.formatted(TamiasTheme.ledgerShort))
                        DetailLine(title: "Currency", value: receipt.currency, divider: false)
                    }.tamiasCard()
                    if let note = receipt.note, !note.isEmpty { Text(note).font(.subheadline).foregroundStyle(TamiasTheme.muted) }
                    Button { previewURL = store.receiptFileURL(for: receipt) } label: {
                        Label("View receipt", systemImage: "doc.richtext")
                    }.buttonStyle(PrimaryButtonStyle()).disabled(store.receiptFileURL(for: receipt) == nil)
                    if receipt.remoteInboxID == nil && receipt.uploadTicket == nil {
                        Button { showEdit = true } label: { Label("Edit details", systemImage: "pencil") }
                            .accessibilityIdentifier("receipt.edit")
                    }
                    if let syncError = receipt.syncError { Text(syncError).font(.footnote).foregroundStyle(TamiasTheme.amber) }
                    if let error { Text(error).font(.footnote).foregroundStyle(.red) }
                    if receipt.remoteInboxID == nil {
                        Button {
                            reviewedWorkspace = store.workspaceID
                            showSync = true
                        } label: {
                            Label(isSyncing ? "Uploading…" : (receipt.syncStatus == .failed ? "Retry upload" : "Upload receipt"), systemImage: "icloud.and.arrow.up")
                        }.buttonStyle(PrimaryButtonStyle()).disabled(isSyncing || store.isDemo)
                            .accessibilityIdentifier("receipt.sync")
                    } else if receipt.matchedTransactionID == nil {
                        Button { showMatches = true } label: { Label("Match to a transaction", systemImage: "link") }
                            .buttonStyle(PrimaryButtonStyle()).accessibilityIdentifier("receipt.findMatch")
                    } else {
                        Label("Matched to a transaction", systemImage: "checkmark.circle").foregroundStyle(TamiasTheme.green)
                    }
                    if store.isDemo { Text("Sign in to upload and match receipts.").font(.footnote).foregroundStyle(TamiasTheme.muted) }
                }.padding(24).frame(maxWidth: 680).frame(maxWidth: .infinity, alignment: .leading)
            } else { EmptyWorkspace(symbol: "doc", title: "Receipt unavailable", message: "Return to your inbox to see this workspace’s receipts.").padding(24) }
        }
        .background(TamiasTheme.paper).navigationTitle("Receipt").navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let receipt, let url = store.receiptFileURL(for: receipt) {
                ToolbarItem(placement: .topBarTrailing) {
                    ShareLink(item: url) { Label("Share original receipt", systemImage: "square.and.arrow.up") }
                        .accessibilityIdentifier("receipt.shareOriginal")
                }
            }
        }
        .quickLookPreview($previewURL)
        .sheet(isPresented: $showEdit) { if let receipt { ReceiptMetadataEditor(store: store, receipt: receipt) } }
        .sheet(isPresented: $showMatches) { ReceiptMatchReview(store: store, receiptID: receiptID) }
        .confirmationDialog("Upload receipt?", isPresented: $showSync, titleVisibility: .visible) {
            Button("Upload to \(store.teamName)") { sync() }
            Button("Cancel", role: .cancel) {}
        } message: {
            if let receipt { Text("Upload \(receipt.name)\(receipt.amount.map { " — " + TamiasTheme.money($0, currency: receipt.currency) } ?? "") and its details to \(store.teamName)?") }
        }
        .accessibilityIdentifier("screen.receipt")
    }

    private func sync() {
        guard store.workspaceID == reviewedWorkspace else { error = WorkflowError.workspaceChanged.localizedDescription; return }
        isSyncing = true; error = nil
        Task { @MainActor in
            defer { isSyncing = false }
            do { _ = try await store.syncReceipt(id: receiptID) }
            catch { self.error = error.localizedDescription }
        }
    }
}

private struct ReceiptMetadataEditor: View {
    let store: TamiasStore
    let receipt: ReceiptCapture
    @State private var workspaceID: String
    @Environment(\.dismiss) private var dismiss
    @State private var merchant: String
    @State private var amount: String
    @State private var currency: String
    @State private var date: Date?
    @State private var note: String
    @State private var error: String?
    @State private var recognition: ReceiptRecognition?
    @State private var isRecognizing = false
    @State private var recognitionError: String?

    init(store: TamiasStore, receipt: ReceiptCapture) {
        self.store = store; self.receipt = receipt; _workspaceID = State(initialValue: store.workspaceID)
        _merchant = State(initialValue: receipt.name == "New receipt" ? "" : receipt.name)
        _amount = State(initialValue: receipt.amount.map { String(format: "%.2f", $0) } ?? "")
        _currency = State(initialValue: receipt.currency); _date = State(initialValue: receipt.receiptDate)
        _note = State(initialValue: receipt.note ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    ReceiptSuggestionsCard(recognition: recognition, isRecognizing: isRecognizing, error: recognitionError) {
                        if merchant.isEmpty { merchant = recognition?.merchant ?? "" }
                        if amount.isEmpty { amount = recognition?.amount ?? "" }
                        if let value = recognition?.currency { currency = value }
                        if date == nil { date = recognition?.date }
                    }
                }
                Section("Receipt details") {
                    TextField("Merchant", text: $merchant).accessibilityIdentifier("receipt.editMerchant")
                    TextField("Total", text: $amount).keyboardType(.decimalPad).accessibilityIdentifier("receipt.editAmount")
                    Picker("Currency", selection: $currency) { ForEach(TamiasCurrencies.choices(preferred: currency), id: \.self) { Text($0).tag($0) } }
                    ReceiptDateField(date: $date)
                    TextField("Note", text: $note, axis: .vertical).lineLimit(2...5).accessibilityIdentifier("receipt.editNote")
                }
                if let error { Text(error).foregroundStyle(.red) }
            }.scrollContentBackground(.hidden).background(TamiasTheme.paper)
            .navigationTitle("Review details").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save", action: save).accessibilityIdentifier("receipt.saveDetails") }
            }
            .task {
                guard let url = store.receiptFileURL(for: receipt) else { return }
                isRecognizing = true
                defer { isRecognizing = false }
                let worker = Task.detached(priority: .utility) { try ReceiptRecognizer.recognize(data: Data(contentsOf: url), isPDF: receipt.contentType == "application/pdf", preferredCurrency: receipt.currency) }
                do {
                    let result = try await withTaskCancellationHandler { try await worker.value } onCancel: { worker.cancel() }
                    if !Task.isCancelled { recognition = result }
                } catch { if !Task.isCancelled { recognitionError = "Suggestions are unavailable. You can edit the details manually." } }
            }
        }
    }

    private func save() {
        do {
            try store.updateReceipt(id: receipt.id, merchant: merchant, amount: amount, currency: currency,
                                    receiptDate: date, note: note, expectedWorkspaceID: workspaceID)
            dismiss()
        } catch { self.error = error.localizedDescription }
    }
}

struct ReceiptMatchReview: View {
    let store: TamiasStore
    let receiptID: UUID?
    let inboxID: String?
    @State private var workspaceID: String
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var suggestions: [ReceiptMatchSuggestion] = []
    @State private var selected: ReceiptMatchSuggestion?
    @State private var isLoading = false
    @State private var isMatching = false
    @State private var error: String?
    init(store: TamiasStore, receiptID: UUID) { self.store = store; self.receiptID = receiptID; inboxID = nil; _workspaceID = State(initialValue: store.workspaceID) }
    init(store: TamiasStore, inboxID: String) { self.store = store; receiptID = nil; self.inboxID = inboxID; _workspaceID = State(initialValue: store.workspaceID) }
    var body: some View {
        NavigationStack {
            List {
                Section { Text("Choose the transaction for this receipt.").font(.subheadline).foregroundStyle(TamiasTheme.muted) }
                if isLoading { ProgressView("Finding transactions…") }
                ForEach(suggestions) { suggestion in
                    Button { selected = suggestion } label: {
                        VStack(alignment: .leading, spacing: 7) {
                            HStack { Text(suggestion.transaction.name); Spacer(); Text(TamiasTheme.money(suggestion.transaction.amount, currency: suggestion.transaction.currency)) }
                            Text("\(suggestion.transaction.date.formatted(TamiasTheme.ledgerShort)) · \(suggestion.transaction.accountName)").font(.caption).foregroundStyle(TamiasTheme.muted)
                            if !suggestion.reasons.isEmpty { Text(suggestion.reasons.joined(separator: " · ")).font(.caption).foregroundStyle(TamiasTheme.green) }
                        }
                    }.disabled(isLoading || isMatching).accessibilityIdentifier("receipt.match.\(suggestion.transaction.id)")
                }
                if !isLoading && suggestions.isEmpty { Text("No matches. Try searching for the merchant.").foregroundStyle(TamiasTheme.muted) }
                if isMatching { ProgressView("Matching receipt…") }
                if let error { Text(error).foregroundStyle(.red) }
            }.scrollContentBackground(.hidden).background(TamiasTheme.paper)
            .searchable(text: $query, prompt: "Search transactions")
            .navigationTitle("Match receipt").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() }.disabled(isMatching) } }
            .task(id: query) {
                isLoading = true; error = nil
                do {
                    try await Task.sleep(for: .milliseconds(250))
                    guard store.workspaceID == workspaceID else { throw WorkflowError.workspaceChanged }
                    let result: [ReceiptMatchSuggestion]
                    if let receiptID { result = try await store.receiptMatchSuggestions(id: receiptID, query: query.isEmpty ? nil : query) }
                    else if let inboxID { result = try await store.inboxMatchSuggestions(id: inboxID, query: query.isEmpty ? nil : query) }
                    else { throw WorkflowError.missingLocalItem }
                    try Task.checkCancellation()
                    suggestions = result; isLoading = false
                } catch is CancellationError {} catch { if !Task.isCancelled { self.error = error.localizedDescription; isLoading = false } }
            }
            .confirmationDialog("Confirm receipt match", isPresented: Binding(get: { selected != nil }, set: { if !$0 { selected = nil } }), titleVisibility: .visible) {
                if let selected { Button("Match receipt") { match(selected) } }
                Button("Cancel", role: .cancel) { selected = nil }
            } message: {
                if let selected { Text("Link this receipt to \(selected.transaction.name), \(TamiasTheme.money(selected.transaction.amount, currency: selected.transaction.currency)), dated \(selected.transaction.date.formatted(TamiasTheme.ledgerShort)), in \(store.teamName)?") }
            }
        }.interactiveDismissDisabled(isMatching)
    }
    private func match(_ selection: ReceiptMatchSuggestion) {
        guard store.workspaceID == workspaceID else { error = WorkflowError.workspaceChanged.localizedDescription; return }
        isMatching = true; error = nil; selected = nil
        Task { @MainActor in
            defer { isMatching = false }
            do {
                if let receiptID { _ = try await store.matchReceipt(localID: receiptID, transactionID: selection.transaction.id) }
                else if let inboxID { try await store.matchInboxItem(inboxID: inboxID, transactionID: selection.transaction.id) }
                dismiss()
            }
            catch { self.error = error.localizedDescription }
        }
    }
}

struct RemoteInboxReviewView: View {
    @Bindable var store: TamiasStore
    let inboxID: String
    @State private var previewURL: URL?
    @State private var previewDirectory: URL?
    @State private var showMatches = false
    @State private var isOpening = false
    @State private var error: String?
    @State private var previewTask: Task<Void, Never>?
    private var item: InboxItem? { store.inboxResults.first { $0.id == inboxID } ?? store.inboxItems.first { $0.id == inboxID } }

    var body: some View {
        ScrollView {
            if let item {
                VStack(alignment: .leading, spacing: 24) {
                    MerchantIcon(name: item.name, symbol: item.symbol).padding(.top, 12)
                    Text(item.name).font(.system(size: 32, design: .default))
                    StatusPill(text: item.statusLabel, tone: item.status == "done" ? TamiasTheme.green : TamiasTheme.amber)
                    if let amount = item.amount { Text(TamiasTheme.money(amount, currency: item.currency)).font(.system(size: 40, design: .rounded)) }
                    VStack(spacing: 0) {
                        DetailLine(title: "File", value: item.fileName)
                        DetailLine(title: "Received", value: item.date.formatted(TamiasTheme.ledgerShort))
                        DetailLine(title: "Currency", value: item.currency, divider: false)
                    }.tamiasCard()
                    if let note = item.note, !note.isEmpty { Text(note).font(.subheadline).foregroundStyle(TamiasTheme.muted) }
                    Button(action: openOriginal) { Label(isOpening ? "Opening original…" : "View original document", systemImage: "doc.richtext") }
                        .buttonStyle(PrimaryButtonStyle()).disabled(isOpening || store.isDemo).accessibilityIdentifier("inbox.viewOriginal")
                    if item.status != "done" {
                        Button { showMatches = true } label: { Label("Match to a transaction", systemImage: "link") }
                            .buttonStyle(PrimaryButtonStyle()).disabled(store.isDemo).accessibilityIdentifier("inbox.findMatch")
                    }
                    if let error { Text(error).font(.footnote).foregroundStyle(.red) }
                    if store.isDemo { Text("Sign in to open and match documents.").font(.footnote).foregroundStyle(TamiasTheme.muted) }
                }.padding(24).frame(maxWidth: 680).frame(maxWidth: .infinity, alignment: .leading)
            } else { EmptyWorkspace(symbol: "doc", title: "Document unavailable", message: "Return to your inbox and refresh this workspace.").padding(24) }
        }.background(TamiasTheme.paper).navigationTitle("Document").navigationBarTitleDisplayMode(.inline)
        .quickLookPreview($previewURL)
        .sheet(isPresented: $showMatches) { ReceiptMatchReview(store: store, inboxID: inboxID) }
        .onChange(of: previewURL) { _, value in if value == nil { removePreview() } }
        .onDisappear { previewTask?.cancel(); previewTask = nil; if previewURL == nil { removePreview() } }
    }

    private func openOriginal() {
        guard let item else { return }
        let expectedWorkspace = store.workspaceID
        isOpening = true; error = nil
        previewTask = Task { @MainActor in
            defer { isOpening = false; previewTask = nil }
            var directory: URL?
            do {
                let signedURL = try await store.inboxFileURL(id: inboxID)
                let session = URLSession(configuration: .ephemeral)
                defer { session.invalidateAndCancel() }
                let (temporaryURL, response) = try await session.download(from: signedURL)
                defer { try? FileManager.default.removeItem(at: temporaryURL) }
                guard let response = response as? HTTPURLResponse, (200...299).contains(response.statusCode) else { throw WorkflowError.unavailableFile }
                let size = try temporaryURL.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
                guard size <= SharedReceiptQueue.maximumBytes else { throw SharedReceiptError.tooLarge }
                try Task.checkCancellation()
                guard expectedWorkspace == store.workspaceID else { throw WorkflowError.workspaceChanged }
                let folder = FileManager.default.temporaryDirectory.appendingPathComponent("TamiasPreview-\(UUID().uuidString)", isDirectory: true)
                directory = folder
                try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false, attributes: [.protectionKey: FileProtectionType.complete])
                let name = URL(fileURLWithPath: item.fileName).lastPathComponent
                let destination = folder.appendingPathComponent(name.isEmpty ? "document.pdf" : name)
                try FileManager.default.copyItem(at: temporaryURL, to: destination)
                try FileManager.default.setAttributes([.protectionKey: FileProtectionType.complete], ofItemAtPath: destination.path)
                removePreview(); previewDirectory = folder; previewURL = destination
            } catch {
                if let directory { try? FileManager.default.removeItem(at: directory) }
                if !Task.isCancelled { self.error = error.localizedDescription }
            }
        }
    }
    private func removePreview() {
        if let previewDirectory { try? FileManager.default.removeItem(at: previewDirectory) }
        previewDirectory = nil
    }
}
