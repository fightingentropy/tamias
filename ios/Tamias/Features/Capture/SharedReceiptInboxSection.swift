import SwiftUI

struct SharedReceiptInboxSection: View {
    let store: TamiasStore
    @Environment(\.scenePhase) private var scenePhase
    @State private var imports: [SharedReceiptImport] = []
    @State private var selection: SharedReceiptImport?
    @State private var discard: SharedReceiptImport?
    @State private var error: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            if !imports.isEmpty {
                SectionHeading(title: "Shared with Tamias") { Text("\(imports.count)") }
                ForEach(imports) { item in
                    HStack {
                        Button { selection = item } label: {
                            HStack(spacing: 12) {
                                Image(systemName: item.contentType == "com.adobe.pdf" ? "doc.richtext" : "photo").foregroundStyle(TamiasTheme.green)
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(item.originalFileName).font(.subheadline).lineLimit(2)
                                    Text("Waiting for review").font(.caption).foregroundStyle(TamiasTheme.muted)
                                }
                                Spacer()
                                Image(systemName: "chevron.right").font(.caption)
                            }.padding(.vertical, 10)
                        }.buttonStyle(.plain).accessibilityIdentifier("sharedReceipt.\(item.id)")
                        Menu {
                            Button("Discard shared receipt", role: .destructive) { discard = item }
                        } label: { Image(systemName: "ellipsis").frame(width: 40, height: 44) }
                    }
                }
            }
            if let error {
                VStack(alignment: .leading, spacing: 8) {
                    Text(error).font(.footnote).foregroundStyle(TamiasTheme.amber)
                    Button("Reload shared inbox", action: reload).font(.footnote)
                }
            }
        }
        .onAppear(perform: reload)
        .onChange(of: scenePhase) { _, phase in if phase == .active { reload() } }
        .sheet(item: $selection, onDismiss: reload) { SharedReceiptReviewView(store: store, item: $0) }
        .confirmationDialog("Discard this shared receipt?", isPresented: Binding(get: { discard != nil }, set: { if !$0 { discard = nil } }), titleVisibility: .visible) {
            Button("Discard shared receipt", role: .destructive) {
                guard let discard else { return }
                do { try SharedReceiptQueue().remove(id: discard.id); self.discard = nil; reload() }
                catch { self.error = error.localizedDescription }
            }
            Button("Keep receipt", role: .cancel) { discard = nil }
        } message: { Text("This removes its pending copy from Tamias. The file in the app you shared it from is unchanged.") }
    }

    private func reload() {
        do { imports = try SharedReceiptQueue().pendingImports(); error = nil }
        catch { self.error = error.localizedDescription }
    }
}

struct SharedReceiptReviewView: View {
    let store: TamiasStore
    let item: SharedReceiptImport
    var body: some View { ReceiptCaptureSheet(store: store, sharedImport: item) }
}
