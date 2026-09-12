import SwiftUI
import Charts

struct OverviewView: View {
    @Bindable var store: TamiasStore
    @Binding var tab: WorkspaceTab
    @Binding var sheet: WorkspaceSheet?
    @Binding var activityFilter: String
    @Binding var activityThisMonth: Bool
    @Binding var invoiceFilter: String
    @State private var period = "6M"
    @State private var selectedDate: Date?
    private var displayedAccounts: [BankAccount] { store.accounts.filter { $0.enabled && $0.type == "depository" && $0.currency == store.currency } }
    private var balanceReadable: Bool { store.balancesAvailable && !displayedAccounts.contains(where: { $0.balance == nil }) }

    private var points: [CashflowPoint] {
        Array(store.cashflow.suffix(period == "3M" ? 3 : period == "6M" ? 6 : 12))
    }
    private var selectedPoint: CashflowPoint? {
        guard let selectedDate else { return nil }
        return points.min(by: { abs($0.date.timeIntervalSince(selectedDate)) < abs($1.date.timeIntervalSince(selectedDate)) })
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                masthead
                WorkspaceDataNotice(store: store)
                balanceCard
                quickActions
                attention
                cashflowCard
                recentActivity
                if let updated = store.lastRefreshed {
                    Text("Updated \(updated.formatted(date: .omitted, time: .shortened))")
                        .font(.caption).foregroundStyle(TamiasTheme.muted).frame(maxWidth: .infinity)
                }
            }
            .padding(.horizontal, 22).padding(.top, 10).padding(.bottom, 28)
            .frame(maxWidth: 680)
            .frame(maxWidth: .infinity)
        }
        .background(TamiasTheme.paper)
        .toolbar(.hidden, for: .navigationBar)
        .refreshable { await store.refresh() }
        .accessibilityIdentifier("screen.overview")
    }

    private var masthead: some View {
        HStack(spacing: 9) {
            TamiasMark(size: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text("Tamias").font(.headline)
                Text(store.teamName).font(.caption).foregroundStyle(TamiasTheme.muted)
            }
            Spacer()
            if store.isDemo { StatusPill(text: "Demo", tone: TamiasTheme.muted) }
            Button { sheet = .settings } label: {
                Text(String(store.firstName.prefix(1)).uppercased()).font(.system(.subheadline, weight: .medium))
                    .frame(width: 40, height: 40)
                    .background(TamiasTheme.surface, in: Circle())
                    .overlay(Circle().strokeBorder(TamiasTheme.line))
            }.accessibilityLabel("Workspace settings").accessibilityIdentifier("workspace.settings")
        }
    }

    private var balanceCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Balance").font(.subheadline).foregroundStyle(TamiasTheme.muted)
                Spacer()
                Text(store.currency).font(.caption).foregroundStyle(TamiasTheme.muted)
            }
            Text(balanceReadable ? TamiasTheme.money(store.balance, currency: store.currency) : "—")
                .font(.system(size: 38, weight: .medium)).tracking(-1)
                .minimumScaleFactor(0.6).lineLimit(1)
                .contentTransition(.numericText())
            if !balanceReadable {
                Text("Balance unavailable").font(.caption).foregroundStyle(TamiasTheme.muted)
            }
            if !store.unconvertedAccountCurrencies.isEmpty {
                Text("Excludes \(store.unconvertedAccountCurrencies.joined(separator: ", ")) accounts")
                    .font(.caption).foregroundStyle(TamiasTheme.muted)
            }
            Divider()
            Text("This month").font(.caption).foregroundStyle(TamiasTheme.muted)
            HStack(alignment: .top) {
                balanceMetric("Income", amount: store.monthlyIncome, symbol: "arrow.down.left", positive: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                balanceMetric("Expenses", amount: store.monthlyExpenses, symbol: "arrow.up.right", positive: false)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }.tamiasCard(padding: 20)
    }

    private func balanceMetric(_ title: String, amount: Double, symbol: String, positive: Bool) -> some View {
        Button {
            activityFilter = positive ? "Income" : "Expenses"
            activityThisMonth = true
            tab = .activity
        } label: { VStack(alignment: .leading, spacing: 7) {
            Label(title, systemImage: symbol).font(.caption).foregroundStyle(TamiasTheme.muted)
            Text(store.cashflowAvailable ? TamiasTheme.money(amount, currency: store.currency, decimals: false) : "—")
                .font(.system(.title3, weight: .medium)).monospacedDigit()
                .foregroundStyle(TamiasTheme.ink)
        }.contentShape(Rectangle()) }
        .buttonStyle(.plain)
        .accessibilityLabel("View this month’s \(positive ? "income" : "expenses")")
        .accessibilityIdentifier(positive ? "home.income" : "home.expenses")
    }

    private var quickActions: some View {
        HStack(spacing: 11) {
            Button { sheet = .invoice } label: {
                Label("New invoice", systemImage: "plus").frame(maxWidth: .infinity)
                    .font(.system(.subheadline, weight: .medium)).padding(.vertical, 16)
                    .background(TamiasTheme.surface, in: RoundedRectangle(cornerRadius: 14))
                    .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(TamiasTheme.line))
            }.accessibilityIdentifier("action.newInvoice")
            Button { sheet = .capture } label: {
                Label("Scan receipt", systemImage: "viewfinder").frame(maxWidth: .infinity)
                    .font(.system(.subheadline, weight: .medium)).padding(.vertical, 16)
                    .background(TamiasTheme.surface, in: RoundedRectangle(cornerRadius: 14))
                    .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(TamiasTheme.line))
            }.accessibilityIdentifier("action.capture")
        }.buttonStyle(.plain)
    }

    private var cashflowCard: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack {
                Text("Cash flow").font(.system(.headline, weight: .semibold)).tracking(-0.5)
                Spacer()
                HStack(spacing: 2) {
                    ForEach(["3M", "6M", "1Y"], id: \.self) { range in
                        Button { withAnimation(.easeInOut(duration: 0.2)) { period = range } } label: {
                            Text(range).font(.system(.caption, weight: .medium))
                                .padding(.horizontal, 9).padding(.vertical, 7)
                                .background(period == range ? TamiasTheme.ink : .clear, in: RoundedRectangle(cornerRadius: 7))
                                .foregroundStyle(period == range ? TamiasTheme.paper : TamiasTheme.muted)
                        }.accessibilityLabel("Income and expenses \(range)").accessibilityAddTraits(period == range ? .isSelected : [])
                    }
                }
            }
            HStack(spacing: 18) {
                legend("Income", color: TamiasTheme.green)
                legend("Expenses", color: TamiasTheme.ink.opacity(0.15))
                Spacer()
                if let point = selectedPoint {
                    Text(point.date.formatted(TamiasTheme.ledgerMonth)).font(.caption).foregroundStyle(TamiasTheme.muted)
                }
            }
            if points.isEmpty {
                Text(store.isLoading ? "Loading reports…" : store.cashflowAvailable ? "No transactions yet." : "Couldn’t load cash flow.").font(.subheadline).foregroundStyle(TamiasTheme.muted).frame(height: 135)
            } else {
                Chart(points) { point in
                    BarMark(x: .value("Month", point.date, unit: .month), y: .value("Income", point.income))
                        .foregroundStyle(TamiasTheme.green).position(by: .value("Type", "Income")).cornerRadius(3)
                    BarMark(x: .value("Month", point.date, unit: .month), y: .value("Expenses", point.expense))
                        .foregroundStyle(TamiasTheme.ink.opacity(0.14)).position(by: .value("Type", "Expenses")).cornerRadius(3)
                }
                .chartLegend(.hidden)
                .chartXAxis {
                    AxisMarks(values: .stride(by: .month)) { _ in AxisValueLabel(format: TamiasTheme.ledgerMonth).font(.system(size: 10)) }
                }
                .chartYAxis {
                    AxisMarks(position: .trailing, values: .automatic(desiredCount: 3)) { value in
                        AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5, dash: [3, 4])).foregroundStyle(TamiasTheme.line)
                        AxisValueLabel { if let amount = value.as(Double.self) { Text(amount.formatted(.number.notation(.compactName))).font(.system(size: 10)) } }
                    }
                }
                .chartXSelection(value: $selectedDate)
                .environment(\.calendar, TamiasDates.calendar)
                .environment(\.timeZone, .gmt)
                .frame(height: 157)
                .accessibilityLabel("Monthly income and expenses in \(store.currency)")
                if let point = selectedPoint {
                    HStack {
                        Text("\(TamiasTheme.money(point.income, currency: store.currency, decimals: false)) income").foregroundStyle(TamiasTheme.green)
                        Spacer()
                        Text("\(TamiasTheme.money(point.expense, currency: store.currency, decimals: false)) expenses").foregroundStyle(TamiasTheme.muted)
                    }.font(.caption).monospacedDigit()
                }
            }
        }.tamiasCard()
    }

    private func legend(_ text: String, color: Color) -> some View {
        HStack(spacing: 5) { RoundedRectangle(cornerRadius: 2).fill(color).frame(width: 7, height: 7); Text(text).font(.caption).foregroundStyle(TamiasTheme.muted) }
    }

    @ViewBuilder private var attention: some View {
        if store.invoiceSummaryAvailable && store.outstandingAmount > 0 {
            Button { invoiceFilter = "Outstanding"; tab = .invoices } label: {
                HStack(spacing: 13) {
                    Image(systemName: "clock").font(.title3).foregroundStyle(TamiasTheme.amber)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Outstanding invoices").font(.system(.subheadline, weight: .medium))
                        Text(TamiasTheme.money(store.outstandingAmount, currency: store.currency, decimals: false))
                            .font(.caption).foregroundStyle(TamiasTheme.muted)
                    }
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right").font(.caption)
                }.padding(17).background(TamiasTheme.surface, in: RoundedRectangle(cornerRadius: 15))
            }.buttonStyle(.plain).accessibilityIdentifier("home.outstanding")
        }
        if store.transactions.contains(where: { $0.needsReceipt }) {
            Button { activityFilter = "Needs receipt"; activityThisMonth = false; tab = .activity } label: {
                HStack(spacing: 13) {
                    Image(systemName: "receipt").foregroundStyle(TamiasTheme.amber)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Receipts to add").font(.subheadline.weight(.medium))
                        Text("\(store.transactions.filter { $0.needsReceipt }.count) transactions").font(.caption).foregroundStyle(TamiasTheme.muted)
                    }
                    Spacer()
                    Image(systemName: "chevron.right").font(.caption)
                }.padding(17).background(TamiasTheme.surface, in: RoundedRectangle(cornerRadius: 15))
            }.buttonStyle(.plain).accessibilityIdentifier("home.receipts")
        }
    }

    private var recentActivity: some View {
        VStack(spacing: 18) {
            SectionHeading(title: "Recent activity") { Button("View all") { activityFilter = "All"; activityThisMonth = false; tab = .activity } }
            if store.transactions.isEmpty {
                EmptyWorkspace(symbol: "arrow.left.arrow.right", title: "No transactions", message: "Your latest transactions will appear here.")
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(store.transactions.prefix(4))) { transaction in
                        NavigationLink { TransactionDetailView(store: store, transaction: transaction) } label: { TransactionRow(transaction: transaction) }
                            .buttonStyle(.plain)
                        if transaction.id != store.transactions.prefix(4).last?.id { Divider().overlay(TamiasTheme.line).padding(.leading, 58) }
                    }
                }
            }
        }
    }
}
