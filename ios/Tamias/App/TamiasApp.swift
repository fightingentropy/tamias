import SwiftUI

@main
struct TamiasApp: App {
    @State private var store = makeStore()
    @AppStorage("tamias.appearance") private var appearance = "System"

    var body: some Scene {
        WindowGroup {
            TamiasRootView(store: store)
                .tint(TamiasTheme.ink)
                .foregroundStyle(TamiasTheme.ink)
                .preferredColorScheme(appearance == "Light" ? .light : appearance == "Dark" ? .dark : nil)
                .task {
                    #if DEBUG && targetEnvironment(simulator)
                    if TaxFilingUITestSupport.enabled { await TaxFilingUITestSupport.connect(store); return }
                    #endif
                    if store.isAuthenticated { await store.refresh() }
                }
        }
    }

    private static func makeStore() -> TamiasStore {
        #if DEBUG && targetEnvironment(simulator)
        return TaxFilingUITestSupport.makeStore()
        #else
        return TamiasStore()
        #endif
    }
}

enum WorkspaceTab: Hashable { case overview, activity, invoices, inbox, tax }
enum WorkspaceSheet: String, Identifiable {
    case settings, invoice, capture, importReceipt
    var id: String { rawValue }
}

struct TamiasRootView: View {
    @Bindable var store: TamiasStore
    @State private var tab: WorkspaceTab = .overview
    @State private var sheet: WorkspaceSheet?
    @State private var activityFilter = "All"
    @State private var activityThisMonth = false
    @State private var invoiceFilter = "All"

    var body: some View {
        TabView(selection: $tab) {
            Tab("Overview", systemImage: "square.grid.2x2", value: .overview) {
                NavigationStack {
                    OverviewView(store: store, tab: $tab, sheet: $sheet, activityFilter: $activityFilter, activityThisMonth: $activityThisMonth, invoiceFilter: $invoiceFilter)
                }
            }
            Tab("Activity", systemImage: "arrow.down.left.arrow.up.right", value: .activity) {
                NavigationStack { ActivityView(store: store, filter: $activityFilter, thisMonth: $activityThisMonth) }
            }
            Tab("Invoices", systemImage: "doc.text", value: .invoices) {
                NavigationStack { InvoicesView(store: store, sheet: $sheet, filter: $invoiceFilter) }
            }
            Tab("Inbox", systemImage: "tray", value: .inbox) {
                NavigationStack { InboxView(store: store, sheet: $sheet) }
            }
            Tab("Tax", systemImage: "chart.bar.doc.horizontal", value: .tax) {
                NavigationStack { TaxView(store: store).id(store.workspaceID) }
            }
        }
        .sheet(item: $sheet) { selection in
            switch selection {
            case .settings: WorkspaceSettingsView(store: store)
            case .invoice: NewInvoiceView(store: store)
            case .capture: ReceiptCaptureSheet(store: store, start: .scanner)
            case .importReceipt: ReceiptCaptureSheet(store: store)
            }
        }
    }
}
