import SwiftUI
import QuickLook

struct InboxView: View {
    @Bindable var store: TamiasStore
    @Binding var sheet: WorkspaceSheet?
    @State private var query = ""
    @State private var filter = "All"

    private var request: InboxFilters {
        InboxFilters(query: query, status: filter == "Matched" ? "done" : filter == "To review" ? "suggested_match" : filter == "Needs match" ? "no_match" : nil)
    }
    private var filtered: [InboxItem] { store.inboxResults }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                WorkspaceDataNotice(store: store)
                SharedReceiptInboxSection(store: store)
                if !store.capturedReceipts.isEmpty {
                    VStack(alignment: .leading, spacing: 13) {
                        SectionHeading(title: "On this iPhone") { Text("\(store.capturedReceipts.count)") }
                        ForEach(store.capturedReceipts.filter { query.isEmpty || $0.name.localizedCaseInsensitiveContains(query) }) { receipt in
                            NavigationLink { ReceiptReviewView(store: store, receiptID: receipt.id) } label: {
                                HStack(spacing: 13) {
                                    MerchantIcon(name: receipt.name, symbol: "doc.viewfinder")
                                    VStack(alignment: .leading, spacing: 5) {
                                        Text(receipt.name).font(.subheadline.weight(.medium))
                                        Text(receipt.status).font(.caption).foregroundStyle(TamiasTheme.muted)
                                    }
                                    Spacer()
                                    if let amount = receipt.amount { Text(TamiasTheme.money(amount, currency: receipt.currency)).font(.subheadline.weight(.medium)) }
                                    Image(systemName: "chevron.right").font(.caption2)
                                }.padding(.vertical, 10)
                            }.buttonStyle(.plain)
                        }
                    }
                }
                if !store.capturedReceipts.isEmpty { SectionHeading(title: "Uploaded") { EmptyView() } }
                FilterStrip(options: ["All", "To review", "Needs match", "Matched"], selection: $filter)
                if store.inboxResultsAreCached { Label("Offline · showing saved documents", systemImage: "wifi.slash").font(.caption).foregroundStyle(TamiasTheme.amber) }
                if let error = store.inboxSearchError { Text(error).font(.caption).foregroundStyle(TamiasTheme.amber) }
                if store.isSearchingInbox { ProgressView().frame(maxWidth: .infinity) }
                if filtered.isEmpty && !store.isSearchingInbox {
                    EmptyWorkspace(symbol: "tray", title: "No documents", message: "Add a receipt with the + button.")
                } else {
                    ForEach(filtered) { item in
                        NavigationLink { RemoteInboxReviewView(store: store, inboxID: item.id) } label: {
                            HStack(alignment: .top, spacing: 14) {
                                MerchantIcon(name: item.name, symbol: item.symbol)
                                VStack(alignment: .leading, spacing: 7) {
                                    Text(item.name).font(.system(.subheadline, weight: .medium))
                                    StatusPill(text: item.statusLabel, tone: item.status == "done" ? TamiasTheme.green : TamiasTheme.amber)
                                }
                                Spacer(minLength: 0)
                                VStack(alignment: .trailing, spacing: 8) {
                                    if let amount = item.amount { Text(TamiasTheme.money(amount, currency: item.currency)).font(.subheadline.weight(.medium)) }
                                    Text(item.date.formatted(TamiasTheme.ledgerDay)).font(.caption2).foregroundStyle(TamiasTheme.muted)
                                }
                            }.padding(.vertical, 10)
                        }.buttonStyle(.plain)
                    }
                }
                if store.hasMoreInboxResults { Button("Load more documents") { Task { await store.loadMoreInboxResults() } }.buttonStyle(PrimaryButtonStyle()).disabled(store.isLoading || store.isLoadingMore) }
            }.padding(22).frame(maxWidth: 680).frame(maxWidth: .infinity)
        }.background(TamiasTheme.paper).navigationTitle("Inbox")
        .toolbar {
            ToolbarItem(placement: .topBarLeading) { if store.isDemo { StatusPill(text: "Demo", tone: TamiasTheme.muted) } }
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button("Scan receipt", systemImage: "viewfinder") { sheet = .capture }
                    Button("Import receipt", systemImage: "photo.on.rectangle") { sheet = .importReceipt }
                } label: { Label("Add receipt", systemImage: "plus") }
                .accessibilityIdentifier("inbox.addReceipt")
            }
        }
        .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search documents")
        .task(id: request) {
            do { try await Task.sleep(for: .milliseconds(280)) } catch { return }
            await store.searchInbox(request)
        }
        .refreshable { await store.searchInbox(request) }
        .accessibilityIdentifier("screen.inbox")
    }
}
