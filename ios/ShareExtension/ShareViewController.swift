import SwiftUI
import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        let providers = (extensionContext?.inputItems as? [NSExtensionItem] ?? []).flatMap { $0.attachments ?? [] }
        let view = ShareReceiptView(providers: providers) { [weak self] in
            self?.extensionContext?.completeRequest(returningItems: nil)
        }
        let host = UIHostingController(rootView: view)
        addChild(host)
        host.view.translatesAutoresizingMaskIntoConstraints = false
        self.view.addSubview(host.view)
        NSLayoutConstraint.activate([
            host.view.leadingAnchor.constraint(equalTo: self.view.leadingAnchor),
            host.view.trailingAnchor.constraint(equalTo: self.view.trailingAnchor),
            host.view.topAnchor.constraint(equalTo: self.view.topAnchor),
            host.view.bottomAnchor.constraint(equalTo: self.view.bottomAnchor)
        ])
        host.didMove(toParent: self)
    }
}

private struct PreparedShare: Identifiable {
    let id = UUID()
    let fileURL: URL
    let name: String
    let type: String
}

private struct ShareReceiptView: View {
    let providers: [NSItemProvider]
    let finish: () -> Void
    @State private var prepared: [PreparedShare] = []
    @State private var error: String?
    @State private var isLoading = true
    @State private var isSaving = false
    @State private var saved = false
    @State private var savedIDs: Set<UUID> = []
    @State private var temporaryDirectory: URL?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Label(saved ? "Ready to review" : "Add receipts", systemImage: saved ? "checkmark.circle" : "tray.and.arrow.down")
                        .font(.title2.weight(.semibold))
                    Text(saved ? "Open Inbox in Tamias to review them." : "Save to this iPhone, then review in Tamias.")
                        .font(.subheadline).foregroundStyle(.secondary)
                }
                if isLoading { ProgressView("Preparing receipts…") }
                ForEach(prepared) { item in
                    Label(item.name, systemImage: savedIDs.contains(item.id) ? "checkmark.circle.fill" : (item.type == UTType.pdf.identifier ? "doc.richtext" : "photo"))
                }
                if let error { Text(error).foregroundStyle(.red) }
            }
            .navigationTitle("Tamias")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button(saved || !savedIDs.isEmpty ? "Done" : "Cancel", action: finish).disabled(isSaving) }
                ToolbarItem(placement: .confirmationAction) {
                    if !saved {
                        Button(isSaving ? "Saving…" : "Save") { save() }
                            .disabled(isLoading || isSaving || prepared.isEmpty || error != nil)
                            .accessibilityIdentifier("share.save")
                    }
                }
            }
            .tint(.primary)
        }
        .task { await prepare() }
        .onDisappear { if let temporaryDirectory { try? FileManager.default.removeItem(at: temporaryDirectory) } }
    }

    private func prepare() async {
        defer { isLoading = false }
        guard (1...5).contains(providers.count) else { error = "Share between 1 and 5 receipt images or PDFs at a time."; return }
        do {
            let directory = FileManager.default.temporaryDirectory.appendingPathComponent("ReceiptShare-\(UUID().uuidString)", isDirectory: true)
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false, attributes: [.protectionKey: FileProtectionType.complete])
            temporaryDirectory = directory
            for provider in providers {
                try Task.checkCancellation()
                guard let type = provider.registeredTypeIdentifiers.first(where: { UTType($0)?.conforms(to: .pdf) == true })
                    ?? provider.registeredTypeIdentifiers.first(where: { UTType($0)?.conforms(to: .image) == true }) else { throw SharedReceiptError.unsupported }
                let name = provider.suggestedName ?? "Receipt.\(UTType(type)?.preferredFilenameExtension ?? "pdf")"
                let copy = directory.appendingPathComponent(UUID().uuidString)
                let fileURL: URL = try await withCheckedThrowingContinuation { continuation in
                    provider.loadFileRepresentation(forTypeIdentifier: type) { url, error in
                        do {
                            if let error { throw error }
                            guard let url else { throw SharedReceiptError.invalid }
                            let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
                            guard size <= SharedReceiptQueue.maximumBytes else { throw SharedReceiptError.tooLarge }
                            // Copy while the provider's temporary file is valid. The batch stays on disk.
                            try FileManager.default.copyItem(at: url, to: copy)
                            try FileManager.default.setAttributes([.protectionKey: FileProtectionType.complete], ofItemAtPath: copy.path)
                            continuation.resume(returning: copy)
                        } catch { continuation.resume(throwing: error) }
                    }
                }
                try Task.checkCancellation()
                let actualType = try SharedReceiptQueue.validate(data: Data(contentsOf: fileURL, options: [.mappedIfSafe]), contentType: type)
                prepared.append(PreparedShare(fileURL: fileURL, name: name, type: actualType.identifier))
            }
        } catch is CancellationError {} catch { self.error = error.localizedDescription }
    }

    private func save() {
        guard !isSaving, !prepared.isEmpty else { return }
        isSaving = true
        Task { @MainActor in
            defer { isSaving = false }
            do {
                for item in prepared where !savedIDs.contains(item.id) {
                    _ = try await Task.detached(priority: .userInitiated) {
                        try SharedReceiptQueue().enqueue(data: Data(contentsOf: item.fileURL), fileName: item.name, contentType: item.type)
                    }.value
                    savedIDs.insert(item.id)
                }
                saved = true
            } catch {
                self.error = savedIDs.isEmpty ? error.localizedDescription : "\(savedIDs.count) receipt(s) saved. \(error.localizedDescription) Open Tamias to review saved receipts."
            }
        }
    }
}
