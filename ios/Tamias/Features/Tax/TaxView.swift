import SwiftUI

struct TaxView: View {
    @Bindable var store: TamiasStore
    @State private var workspace: TaxWorkspace
    @State private var year = SoleTraderReport.lastCompletedYear()
    @State private var showProfile = false
    @State private var isExporting = false
    @State private var exportFile: TaxShareFile?
    @State private var exportError: String?
    init(store: TamiasStore) { self.store = store; _workspace = State(initialValue: TaxWorkspace(store: store)) }
    private var years: [Int] { Array((2024...max(2025, SoleTraderReport.lastCompletedYear() + 1)).reversed()) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                WorkspaceDataNotice(store: store)
                if workspace.isLoading { ProgressView().frame(maxWidth: .infinity).padding(.vertical, 50) }
                else if let report = workspace.report {
                    summary(report)
                    VStack(spacing: 0) {
                        NavigationLink { TaxTransactionsView(workspace: workspace) } label: {
                            taxRow("Transactions", detail: report.needsReview > 0 ? "\(report.needsReview) to review" : "Reviewed", symbol: "arrow.down.left.arrow.up.right")
                        }.accessibilityIdentifier("tax.transactions")
                        Divider()
                        Button { showProfile = true } label: {
                            taxRow("Your return", detail: report.readyToExport ? "Details complete" : "Check details", symbol: "person.text.rectangle")
                        }.accessibilityIdentifier("tax.profile")
                        Divider()
                        NavigationLink { TaxPreparationView(workspace: workspace) } label: {
                            taxRow("Self Assessment", detail: "Figures and filing", symbol: "doc.text")
                        }.accessibilityIdentifier("tax.preparation")
                    }.buttonStyle(.plain)

                    if report.missingReceipts > 0 {
                        Label("\(report.missingReceipts) expense\(report.missingReceipts == 1 ? " is" : "s are") missing a receipt", systemImage: "paperclip")
                            .font(.subheadline).foregroundStyle(TamiasTheme.muted)
                    }
                    Button { export() } label: {
                        HStack { Text(isExporting ? "Preparing…" : "Export figures"); Spacer(); if isExporting { ProgressView() } else { Image(systemName: "square.and.arrow.up") } }.padding(.horizontal, 18)
                    }.buttonStyle(PrimaryButtonStyle()).disabled(store.isDemo || isExporting || workspace.isSaving)
                        .accessibilityIdentifier("tax.export")
                    Text(report.readyToExport ? "Business figures for your return or accountant. This is not a submitted return." : "Exports include the items still to review and are marked as a draft.")
                        .font(.caption).foregroundStyle(TamiasTheme.muted)
                    if let exportError { Text(exportError).font(.caption).foregroundStyle(.red) }
                } else if let error = workspace.error {
                    EmptyWorkspace(symbol: "wifi.exclamationmark", title: "Tax figures unavailable", message: error)
                    Button("Try again") { Task { await workspace.load(year: year) } }.buttonStyle(PrimaryButtonStyle())
                }
            }.padding(22).frame(maxWidth: 680).frame(maxWidth: .infinity)
        }
        .background(TamiasTheme.paper).navigationTitle("Tax")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Picker("Tax year", selection: $year) { ForEach(years, id: \.self) { value in Text("\(String(value))/\(String(value + 1).suffix(2))").tag(value) } }
                } label: { HStack(spacing: 4) { Text("\(String(year))/\(String(year + 1).suffix(2))"); Image(systemName: "chevron.down").font(.caption2) } }
                    .accessibilityLabel("Tax year").accessibilityIdentifier("tax.year").disabled(workspace.isSaving || isExporting)
            }
        }
        .task(id: year) { await workspace.load(year: year) }
        .refreshable { await workspace.load(year: year) }
        .sheet(isPresented: $showProfile) {
            if let report = workspace.report { TaxProfileSheet(workspace: workspace, profile: report.profile) }
        }
        .sheet(item: $exportFile, onDismiss: cleanupExport) { file in TaxShareSheet(file: file.url) }
        .accessibilityIdentifier("screen.tax")
    }

    private func summary(_ report: SoleTraderReport) -> some View {
        VStack(alignment: .leading, spacing: 22) {
            VStack(alignment: .leading, spacing: 8) {
                Text("Profit so far").font(.subheadline).foregroundStyle(TamiasTheme.muted)
                Text(SoleTraderReport.money(report.profitPence)).font(.system(size: 42, weight: .regular, design: .rounded))
                    .tracking(-1.5).minimumScaleFactor(0.65).lineLimit(1).accessibilityIdentifier("tax.profit")
                Text("From reviewed transactions · before tax adjustments").font(.caption).foregroundStyle(TamiasTheme.muted)
            }
            HStack {
                amount("Income", report.incomePence)
                Spacer()
                amount("Expenses", report.expensesPence)
            }
        }.padding(.vertical, 10)
    }
    private func amount(_ title: String, _ pence: Int) -> some View {
        VStack(alignment: .leading, spacing: 7) { Text(title).font(.caption).foregroundStyle(TamiasTheme.muted); Text(SoleTraderReport.money(pence)).font(.title3).monospacedDigit() }
    }
    private func taxRow(_ title: String, detail: String, symbol: String) -> some View {
        HStack(spacing: 14) {
            Image(systemName: symbol).frame(width: 24).foregroundStyle(TamiasTheme.muted)
            Text(title).font(.subheadline.weight(.medium))
            Spacer(minLength: 8)
            Text(detail).font(.caption).foregroundStyle(TamiasTheme.muted)
            Image(systemName: "chevron.right").font(.caption2).foregroundStyle(TamiasTheme.muted)
        }.padding(.vertical, 21).contentShape(Rectangle())
    }
    private func export() {
        isExporting = true; exportError = nil
        Task {
            defer { isExporting = false }
            do { let url = try await workspace.export(); exportFile = TaxShareFile(url: url); exportedURL = url }
            catch { exportError = error.localizedDescription }
        }
    }
    @State private var exportedURL: URL?
    private func cleanupExport() {
        if let exportedURL { try? FileManager.default.removeItem(at: exportedURL.deletingLastPathComponent()) }
        exportedURL = nil
    }
}

private struct TaxShareFile: Identifiable { let id = UUID(); let url: URL }
private struct TaxShareSheet: UIViewControllerRepresentable {
    let file: URL
    func makeUIViewController(context: Context) -> UIActivityViewController { UIActivityViewController(activityItems: [file], applicationActivities: nil) }
    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
