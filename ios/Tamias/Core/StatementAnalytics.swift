import Foundation

/// All settled statement movements, including personal transfers. These are not taxable profit.
struct StatementAnalytics: Codable, Sendable, Equatable {
    struct Summary: Codable, Sendable, Equatable {
        let count: Int
        let firstDate: Date?
        let lastDate: Date?
        let moneyIn: Double
        let moneyOut: Double
        let spending: Double
        let unconvertedCount: Int
        let unconvertedCurrencies: String?
    }
    struct Month: Codable, Sendable, Equatable {
        let month: String
        let moneyIn: Double
        let moneyOut: Double
    }
    struct Category: Codable, Sendable, Equatable, Identifiable {
        var id: String { slug }
        let slug: String
        let name: String
        let amount: Double
        let percentage: Double
    }
    let currency: String
    let summary: Summary
    let months: [Month]
    let categories: [Category]

    func cashflow(now: Date = .now) -> [CashflowPoint] {
        let from = TamiasDates.calendar.date(byAdding: .month, value: -11, to: TamiasDates.monthStart(now))!
        let grouped = Dictionary(grouping: months, by: \.month)
        return (0..<12).map { offset in
            let date = TamiasDates.calendar.date(byAdding: .month, value: offset, to: from)!
            let key = String(TamiasDates.apiString(date).prefix(7))
            return CashflowPoint(date: date,
                income: grouped[key, default: []].reduce(0) { $0 + $1.moneyIn },
                expense: grouped[key, default: []].reduce(0) { $0 + $1.moneyOut })
        }
    }
}
