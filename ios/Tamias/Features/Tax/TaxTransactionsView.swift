import SwiftUI

struct TaxTransactionsView: View {
    @Bindable var workspace: TaxWorkspace
    @State private var filter = "To review"
    @State private var query = ""
    @State private var selecting = false
    @State private var selected: Set<String> = []
    @State private var review: TaxReviewSelection?

    private var rows: [TaxTransaction] {
        (workspace.report?.transactions ?? []).reversed().filter { row in
            let matchesSearch = query.isEmpty || row.name.localizedCaseInsensitiveContains(query) || row.note.localizedCaseInsensitiveContains(query)
            let matchesFilter = switch filter {
            case "To review": row.needsReview || row.blockedCurrency
            case "Reviewed": !row.needsReview && !row.pending && !row.blockedCurrency
            case "Needs receipt": row.included && row.businessAmountPence < 0 && !row.hasReceipt
            default: true
            }
            return matchesSearch && matchesFilter
        }
    }
    var body: some View {
        List {
            Section {
                FilterStrip(options: ["To review", "All", "Reviewed", "Needs receipt"], selection: $filter)
                    .listRowInsets(EdgeInsets(top: 8, leading: 0, bottom: 8, trailing: 0)).listRowBackground(TamiasTheme.paper)
            }.listSectionSeparator(.hidden)
            if rows.isEmpty { Text("No transactions here").foregroundStyle(TamiasTheme.muted).listRowBackground(TamiasTheme.paper) }
            ForEach(rows) { row in
                Button {
                    if selecting {
                        if selected.contains(row.id) { selected.remove(row.id) }
                        else if selected.count < 100 { selected.insert(row.id) }
                    } else { review = TaxReviewSelection(rows: [row]) }
                } label: {
                    HStack(spacing: 12) {
                        if selecting { Image(systemName: selected.contains(row.id) ? "checkmark.circle.fill" : "circle").font(.title3) }
                        VStack(alignment: .leading, spacing: 6) {
                            Text(row.name).font(.subheadline.weight(.medium)).lineLimit(1)
                            Text(row.statusLabel).font(.caption).foregroundStyle(row.needsReview ? TamiasTheme.amber : TamiasTheme.muted)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 6) {
                            Text(TamiasTheme.money(row.amount, currency: row.currency)).font(.subheadline).monospacedDigit()
                            Text(row.date).font(.caption).foregroundStyle(TamiasTheme.muted)
                        }
                    }.padding(.vertical, 7).contentShape(Rectangle())
                }.buttonStyle(.plain).listRowBackground(TamiasTheme.paper)
                    .disabled(row.automaticExclusion || row.pending)
                    .accessibilityIdentifier("tax.transaction.\(row.id)")
            }
            if selected.count == 100 { Text("Review up to 100 transactions at once.").font(.caption).foregroundStyle(TamiasTheme.muted) }
        }.listStyle(.plain).scrollContentBackground(.hidden).background(TamiasTheme.paper)
            .accessibilityIdentifier("screen.taxTransactions")
            .navigationTitle("Transactions").navigationBarTitleDisplayMode(.inline)
            .searchable(text: $query, prompt: "Search this tax year")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) { Button(selecting ? "Done" : "Select") { selecting.toggle(); selected = [] }.accessibilityIdentifier("tax.select") }
            }
            .safeAreaInset(edge: .bottom) {
                if !selected.isEmpty {
                    VStack {
                        Button("Review \(selected.count) transaction\(selected.count == 1 ? "" : "s")") {
                            review = TaxReviewSelection(rows: (workspace.report?.transactions ?? []).filter { selected.contains($0.id) })
                        }.buttonStyle(PrimaryButtonStyle()).accessibilityIdentifier("tax.reviewSelected")
                    }.padding().background(TamiasTheme.paper)
                }
            }
            .sheet(item: $review) { selection in
                TaxReviewSheet(workspace: workspace, rows: selection.rows) { selected = []; selecting = false }
            }
    }
}

private struct TaxReviewSelection: Identifiable { let id = UUID(); let rows: [TaxTransaction] }

struct TaxReviewSheet: View {
    @Bindable var workspace: TaxWorkspace
    let rows: [TaxTransaction]
    let onSaved: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var category: String
    @State private var businessPercent: Double
    @State private var note: String
    @State private var error: String?

    init(workspace: TaxWorkspace, rows: [TaxTransaction], onSaved: @escaping () -> Void) {
        self.workspace = workspace; self.rows = rows; self.onSaved = onSaved
        // A blank selection requires an explicit tax decision for unreviewed and mixed records.
        let sameCategory = Set(rows.map { $0.category ?? "" })
        _category = State(initialValue: sameCategory.count == 1 ? sameCategory.first! : "")
        let percentages = Set(rows.map(\.businessPercent))
        _businessPercent = State(initialValue: percentages.count == 1 ? Double(percentages.first!) : 100)
        _note = State(initialValue: rows.count == 1 ? rows[0].note : "")
    }
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    if rows.count == 1 {
                        LabeledContent(rows[0].name, value: TamiasTheme.money(rows[0].amount, currency: rows[0].currency))
                        LabeledContent("Date", value: rows[0].date)
                        LabeledContent("Receipt", value: rows[0].hasReceipt ? "Attached" : "Missing")
                    } else { LabeledContent("Selected transactions", value: "\(rows.count)") }
                }
                Section("Tax category") {
                    Picker("Category", selection: $category) {
                        Text("Choose a category").tag("")
                        ForEach(workspace.report?.categories ?? SoleTraderCategory.all) { Text($0.name).tag($0.id) }
                    }.accessibilityIdentifier("tax.reviewCategory")
                }
                if category != "excluded" {
                    Section {
                        HStack { Text("Business use"); Spacer(); Text("\(Int(businessPercent))%").monospacedDigit() }
                        Slider(value: $businessPercent, in: 0...100, step: 1).accessibilityLabel("Business use percentage").accessibilityIdentifier("tax.businessPercent")
                        if rows.count == 1, let amount = rows[0].amountPence {
                            LabeledContent("Business portion", value: SoleTraderReport.money(Int((Double(abs(amount)) * businessPercent / 100).rounded())))
                        }
                    } footer: { Text("Only include the business share. Use the original category for a refund; it reduces that category's total.") }
                }
                Section("Note") {
                    TextField(rows.count == 1 ? "Optional note" : "Optional note for all selected transactions", text: $note, axis: .vertical).lineLimit(2...5)
                }
                Section {
                    if workspace.store.isDemo { Text("Sign in to save your own tax review.").font(.caption).foregroundStyle(TamiasTheme.muted) }
                    if let error { Text(error).font(.caption).foregroundStyle(.red) }
                    Link("Which expenses can I claim?", destination: URL(string: "https://www.gov.uk/expenses-if-youre-self-employed")!)
                } footer: { Text("Client entertaining and personal costs are not allowable business expenses.") }
            }.scrollContentBackground(.hidden).background(TamiasTheme.paper)
                .navigationTitle(rows.count == 1 ? "Review transaction" : "Review \(rows.count) transactions").navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() }.disabled(workspace.isSaving) }
                    ToolbarItem(placement: .confirmationAction) {
                        Button(workspace.isSaving ? "Saving…" : "Save") { save() }
                            .disabled(category.isEmpty || note.count > 500 || workspace.isSaving || workspace.store.isDemo)
                            .accessibilityIdentifier("tax.saveReview")
                    }
                }.interactiveDismissDisabled(workspace.isSaving)
                .accessibilityIdentifier("screen.taxReview")
        }
    }
    private func save() {
        error = nil
        let reviews = rows.map { row in TaxTransactionReview(transactionId: row.id, sourceVersion: row.sourceVersion,
            category: category, businessPercent: category == "excluded" ? 0 : Int(businessPercent),
            note: rows.count > 1 && note.isEmpty ? row.note : note) }
        Task {
            do { try await workspace.review(reviews); onSaved(); dismiss() }
            catch { self.error = error.localizedDescription }
        }
    }
}
