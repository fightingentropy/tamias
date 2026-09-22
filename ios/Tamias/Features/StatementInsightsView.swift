import SwiftUI

struct StatementInsightsView: View {
    let report: StatementAnalytics
    private let dateFormat = Date.FormatStyle(date: .abbreviated, time: .omitted, timeZone: .gmt)

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Statement history").font(.headline)
                Text("\(report.summary.count.formatted()) transactions · \(report.currency)")
                    .font(.subheadline).foregroundStyle(TamiasTheme.muted)
                if let first = report.summary.firstDate, let last = report.summary.lastDate {
                    Text("\(first.formatted(dateFormat)) – \(last.formatted(dateFormat))")
                        .font(.caption).foregroundStyle(TamiasTheme.muted)
                }
            }
            if !report.categories.isEmpty {
                Divider()
                HStack {
                    Text("Spending").font(.subheadline.weight(.medium))
                    Spacer()
                    Text(TamiasTheme.money(report.summary.spending, currency: report.currency))
                        .font(.subheadline.weight(.medium)).monospacedDigit()
                }
                Text("Across your statement history, excluding transfers and excluded categories.")
                    .font(.caption).foregroundStyle(TamiasTheme.muted)
                ForEach(report.categories.prefix(5)) { category in
                    VStack(spacing: 7) {
                        HStack {
                            Text(category.name).lineLimit(2)
                            Spacer()
                            Text(TamiasTheme.money(category.amount, currency: report.currency, decimals: false))
                                .monospacedDigit()
                        }.font(.caption)
                        ProgressView(value: min(max(category.percentage, 0), 100), total: 100)
                            .tint(TamiasTheme.green)
                            .accessibilityLabel(category.name)
                            .accessibilityValue("\(category.percentage.formatted()) percent of spending")
                    }
                }
            }
            if report.summary.unconvertedCount > 0 {
                Text("\(report.summary.unconvertedCount) transactions in \(report.summary.unconvertedCurrencies ?? "other currencies") are excluded because no exchange rate is available.")
                    .font(.caption).foregroundStyle(TamiasTheme.amber)
            }
        }
        .tamiasCard()
        .accessibilityIdentifier("home.statementHistory")
    }
}
