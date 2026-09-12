import SwiftUI

struct ActivityView: View {
    @Bindable var store: TamiasStore
    @Binding var filter: String
    @Binding var thisMonth: Bool
    @State private var query = ""
    @State private var accountID = ""
    @State private var categorySlug = ""
    @State private var showFilters = false

    private var request: TransactionFilters {
        let type: TransactionFilterType = switch filter {
        case "Income": .income
        case "Expenses": .expense
        case "Needs receipt": .needsReceipt
        case "To review": .inReview
        default: .all
        }
        return TransactionFilters(query: query, type: type,
            fromDate: thisMonth ? TamiasDates.monthStart(.now) : nil,
            toDate: thisMonth ? TamiasDates.calendar.startOfDay(for: .now) : nil,
            accountID: accountID.isEmpty ? nil : accountID,
            categorySlug: categorySlug.isEmpty ? nil : categorySlug)
    }
    private var dates: [Date] {
        Array(Set(store.transactionResults.map { TamiasDates.calendar.startOfDay(for: $0.date) })).sorted(by: >)
    }
    private var hasExtraFilters: Bool { thisMonth || !accountID.isEmpty || !categorySlug.isEmpty }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                WorkspaceDataNotice(store: store)
                FilterStrip(options: ["All", "Income", "Expenses", "Needs receipt", "To review"], selection: $filter)
                if hasExtraFilters {
                    HStack {
                        Text(thisMonth ? "This month" : "Filtered activity").font(.caption).foregroundStyle(TamiasTheme.muted)
                        Spacer()
                        Button("Clear filters") { thisMonth = false; accountID = ""; categorySlug = "" }.font(.caption)
                    }
                }
                if store.transactionResultsAreCached {
                    Label("Offline · showing saved transactions", systemImage: "wifi.slash")
                        .font(.caption).foregroundStyle(TamiasTheme.amber)
                }
                if let error = store.transactionSearchError {
                    Text(error).font(.caption).foregroundStyle(TamiasTheme.amber)
                }
                if store.isSearchingTransactions { ProgressView().frame(maxWidth: .infinity) }
                if store.transactionResults.isEmpty && !store.isSearchingTransactions {
                    EmptyWorkspace(symbol: "magnifyingglass", title: query.isEmpty ? "No transactions here" : "No matches", message: "Try another search or filter.")
                } else {
                    ForEach(dates, id: \.self) { day in
                        VStack(alignment: .leading, spacing: 10) {
                            Eyebrow(text: day.formatted(TamiasTheme.ledgerDay))
                            VStack(spacing: 0) {
                                ForEach(store.transactionResults.filter { TamiasDates.calendar.isDate($0.date, inSameDayAs: day) }) { transaction in
                                    NavigationLink { TransactionDetailView(store: store, transaction: transaction) } label: { TransactionRow(transaction: transaction) }
                                        .buttonStyle(.plain).accessibilityIdentifier("transaction.\(transaction.id)")
                                    Divider().padding(.leading, 58)
                                }
                            }
                        }
                    }
                }
                if store.hasMoreTransactionResults {
                    Button("Load more transactions") { Task { await store.loadMoreTransactionResults() } }
                        .buttonStyle(PrimaryButtonStyle()).disabled(store.isSearchingTransactions)
                }
            }.padding(22).frame(maxWidth: 680).frame(maxWidth: .infinity)
        }
        .background(TamiasTheme.paper).navigationTitle("Activity")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showFilters = true } label: { Image(systemName: hasExtraFilters ? "line.3.horizontal.decrease.circle.fill" : "line.3.horizontal.decrease.circle") }
                    .accessibilityLabel("Filter transactions").accessibilityIdentifier("activity.filters")
            }
        }
        .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search all transactions")
        .task(id: request) {
            do { try await Task.sleep(for: .milliseconds(280)) } catch { return }
            await store.searchTransactions(request)
        }
        .refreshable { await store.searchTransactions(request) }
        .sheet(isPresented: $showFilters) { filtersSheet }
        .accessibilityIdentifier("screen.activity")
    }

    private var filtersSheet: some View {
        NavigationStack {
            Form {
                Section("Date") { Toggle("This month", isOn: $thisMonth) }
                Section("Account") {
                    Picker("Account", selection: $accountID) {
                        Text("All accounts").tag("")
                        ForEach(store.accounts) { Text($0.name).tag($0.id) }
                    }
                }
                Section("Category") {
                    Picker("Category", selection: $categorySlug) {
                        Text("All categories").tag("")
                        ForEach(store.categories) { Text($0.name).tag($0.slug) }
                    }
                }
            }.scrollContentBackground(.hidden).background(TamiasTheme.paper)
            .navigationTitle("Filters").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { showFilters = false } } }
            .task { await store.loadCategories() }
        }.presentationDetents([.medium, .large])
    }
}

struct FilterStrip: View {
    let options: [String]
    @Binding var selection: String
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(options, id: \.self) { option in
                    Button { withAnimation(.easeInOut(duration: 0.15)) { selection = option } } label: {
                        Text(option).font(.system(.subheadline, weight: .medium)).padding(.horizontal, 15).padding(.vertical, 10)
                            .background(selection == option ? TamiasTheme.ink : TamiasTheme.surface, in: Capsule())
                            .foregroundStyle(selection == option ? TamiasTheme.paper : TamiasTheme.muted)
                    }.accessibilityAddTraits(selection == option ? .isSelected : [])
                }
            }
        }
    }
}

struct TransactionRow: View {
    let transaction: TamiasTransaction
    var body: some View {
        HStack(spacing: 13) {
            MerchantIcon(name: transaction.name, symbol: transaction.symbol, incoming: transaction.amount > 0)
            VStack(alignment: .leading, spacing: 5) {
                Text(transaction.name).font(.system(.subheadline, weight: .medium)).lineLimit(1)
                Text(transaction.category).font(.caption).foregroundStyle(TamiasTheme.muted).lineLimit(1)
            }
            Spacer(minLength: 6)
            VStack(alignment: .trailing, spacing: 5) {
                Text((transaction.amount > 0 ? "+" : "") + TamiasTheme.money(transaction.amount, currency: transaction.currency))
                    .font(.system(.subheadline, weight: .medium)).monospacedDigit()
                    .foregroundStyle(transaction.amount > 0 ? TamiasTheme.green : TamiasTheme.ink)
                if transaction.needsReceipt {
                    Text("Needs receipt").font(.caption2).foregroundStyle(TamiasTheme.amber)
                } else {
                    Text(transaction.date.formatted(TamiasTheme.ledgerDay)).font(.caption2).foregroundStyle(TamiasTheme.muted)
                }
            }
        }.padding(.vertical, 13).contentShape(Rectangle()).accessibilityElement(children: .combine)
    }
}

struct TransactionDetailView: View {
    @Bindable var store: TamiasStore
    let transaction: TamiasTransaction
    private let workspaceID: String
    @State private var categorySlug = ""
    @State private var note = ""
    @State private var isSaving = false
    @State private var error: String?
    @State private var saved = false
    @State private var showAttach = false
    private var current: TamiasTransaction {
        store.transactionResults.first { $0.id == transaction.id } ?? store.transactions.first { $0.id == transaction.id } ?? transaction
    }

    init(store: TamiasStore, transaction: TamiasTransaction) {
        self.store = store; self.transaction = transaction; workspaceID = store.workspaceID
    }

    var body: some View {
        Form {
            Section {
                VStack(spacing: 13) {
                    MerchantIcon(name: current.name, symbol: current.symbol, incoming: current.amount > 0).padding(.top, 14)
                    Text(current.name).font(.title2.weight(.medium))
                    Text(TamiasTheme.money(current.amount, currency: current.currency))
                        .font(.system(size: 39, weight: .regular, design: .rounded)).tracking(-1.2)
                        .foregroundStyle(current.amount > 0 ? TamiasTheme.green : TamiasTheme.ink)
                    StatusPill(text: current.status.capitalized)
                }.frame(maxWidth: .infinity).padding(.bottom, 16)
                DetailLine(title: "Date", value: current.date.formatted(TamiasTheme.ledgerLong), divider: false)
                DetailLine(title: "Account", value: current.accountName, divider: false)
            }.listRowBackground(TamiasTheme.paper)
            Section("Category") {
                Picker("Category", selection: $categorySlug) {
                    Text("Uncategorised").tag("")
                    ForEach(store.categories) { Text($0.name).tag($0.slug) }
                    if !categorySlug.isEmpty && !store.categories.contains(where: { $0.slug == categorySlug }) {
                        Text(current.category).tag(categorySlug)
                    }
                }.accessibilityIdentifier("transaction.category")
            }
            Section("Note") {
                TextField("Add a note", text: $note, axis: .vertical).lineLimit(3...7).accessibilityIdentifier("transaction.note")
            }
            Section {
                Button { save(reviewed: false) } label: {
                    HStack { Text(isSaving ? "Saving…" : "Save changes"); Spacer(); if isSaving { ProgressView() } }
                }.disabled(isSaving).accessibilityIdentifier("transaction.save")
                Button { save(reviewed: true) } label: { Label("Mark reviewed", systemImage: "checkmark.circle") }
                    .disabled(isSaving).accessibilityIdentifier("transaction.review")
                if saved { Label("Saved", systemImage: "checkmark.circle.fill").foregroundStyle(TamiasTheme.green).font(.caption) }
                if let error { Text(error).font(.caption).foregroundStyle(.red) }
            }
            Section("Receipt") {
                LabeledContent("Attachment", value: current.hasAttachment ? "Attached" : "No receipt attached")
                Button { showAttach = true } label: { Label("Attach a receipt", systemImage: "paperclip") }
                    .accessibilityIdentifier("transaction.attach")
            }
        }
        .scrollContentBackground(.hidden).background(TamiasTheme.paper)
        .navigationTitle("Transaction").navigationBarTitleDisplayMode(.inline)
        .task { categorySlug = current.categorySlug ?? ""; note = current.note ?? ""; await store.loadCategories() }
        .sheet(isPresented: $showAttach) { TransactionReceiptPicker(store: store, transaction: current) }
        .accessibilityIdentifier("screen.transaction")
    }

    private func save(reviewed: Bool) {
        isSaving = true; saved = false; error = nil
        Task {
            do {
                guard store.workspaceID == workspaceID else { throw WorkflowError.workspaceChanged }
                _ = try await store.updateTransaction(id: current.id, categorySlug: categorySlug.isEmpty ? nil : categorySlug, note: note, markReviewed: reviewed)
                saved = true
                UINotificationFeedbackGenerator().notificationOccurred(.success)
            } catch { self.error = error.localizedDescription }
            isSaving = false
        }
    }
}

struct TransactionReceiptPicker: View {
    @Bindable var store: TamiasStore
    let transaction: TamiasTransaction
    private let workspaceID: String
    @Environment(\.dismiss) private var dismiss
    @State private var capture = false
    @State private var selected: ReceiptCapture?
    @State private var isAttaching = false
    @State private var error: String?

    init(store: TamiasStore, transaction: TamiasTransaction) {
        self.store = store; self.transaction = transaction; workspaceID = store.workspaceID
    }

    var body: some View {
        NavigationStack {
            List {
                Section { Button { capture = true } label: { Label("Add receipt", systemImage: "viewfinder") } }
                Section("Receipts on this iPhone") {
                    ForEach(store.capturedReceipts) { receipt in
                        Button { selected = receipt } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) { Text(receipt.name); Text(receipt.status).font(.caption).foregroundStyle(TamiasTheme.muted) }
                                Spacer()
                                if let amount = receipt.amount { Text(TamiasTheme.money(amount, currency: receipt.currency)).font(.subheadline) }
                            }
                        }.disabled(isAttaching)
                    }
                    if store.capturedReceipts.isEmpty { Text("Add a receipt to attach it here.").foregroundStyle(TamiasTheme.muted) }
                }
                if isAttaching { ProgressView("Uploading and attaching…") }
                if let error { Text(error).font(.caption).foregroundStyle(.red) }
            }.scrollContentBackground(.hidden).background(TamiasTheme.paper)
            .navigationTitle("Attach receipt").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() }.disabled(isAttaching) } }
            .sheet(isPresented: $capture) { ReceiptCaptureSheet(store: store) }
            .confirmationDialog("Attach this receipt?", isPresented: Binding(get: { selected != nil }, set: { if !$0 { selected = nil } }), titleVisibility: .visible) {
                if let receipt = selected {
                    Button("Upload and attach") { attach(receipt) }
                    Button("Cancel", role: .cancel) { selected = nil }
                }
            } message: {
                if let receipt = selected { Text("\(receipt.name) will be synced to \(store.teamName) and matched to \(transaction.name), \(TamiasTheme.money(transaction.amount, currency: transaction.currency)).") }
            }
        }.interactiveDismissDisabled(isAttaching)
    }

    private func attach(_ receipt: ReceiptCapture) {
        isAttaching = true; error = nil
        Task {
            do {
                guard store.workspaceID == workspaceID else { throw WorkflowError.workspaceChanged }
                _ = try await store.syncReceipt(id: receipt.id, expectedWorkspaceID: workspaceID)
                guard store.workspaceID == workspaceID else { throw WorkflowError.workspaceChanged }
                _ = try await store.matchReceipt(localID: receipt.id, transactionID: transaction.id, expectedWorkspaceID: workspaceID)
                dismiss()
            } catch { self.error = error.localizedDescription }
            isAttaching = false
        }
    }
}

struct DetailLine: View {
    let title: String
    let value: String
    var divider = true
    var body: some View {
        VStack(spacing: 0) {
            HStack(alignment: .firstTextBaseline, spacing: 20) {
                Text(title).foregroundStyle(TamiasTheme.muted)
                Spacer(minLength: 10)
                Text(value).multilineTextAlignment(.trailing)
            }.font(.subheadline).padding(.vertical, 14)
            if divider { Divider() }
        }
    }
}
