import Foundation

/// A fictional GBP design studio. Never used as a fallback for authenticated API responses.
struct SampleWorkspace {
    let user: TamiasUser
    let accounts: [BankAccount]
    let transactions: [TamiasTransaction]
    let invoices: [TamiasInvoice]
    let inbox: [InboxItem]
    let customers: [Customer]
    let cashflow: [CashflowPoint]

    init(now: Date = .now) {
        let calendar = TamiasDates.calendar
        let start = TamiasDates.monthStart(now)
        let elapsedDays = max(0, calendar.dateComponents([.day], from: start, to: now).day ?? 0)
        func day(_ offset: Int) -> Date {
            calendar.date(byAdding: .day, value: min(max(0, offset), elapsedDays), to: start)!
        }
        func due(_ offset: Int) -> Date { calendar.date(byAdding: .day, value: offset, to: now)! }
        user = TamiasUser(id: "sample-user", fullName: "Alex Morgan", email: "alex@northstar.example",
                          team: .init(id: "sample-studio", name: "Northstar Studio"))
        accounts = [
            BankAccount(id: "sample-current", name: "Monzo Business", currency: "GBP", balance: 61_240.50,
                        enabled: true, type: "depository", manual: false),
            BankAccount(id: "sample-reserve", name: "Business reserve", currency: "GBP", balance: 25_180,
                        enabled: true, type: "depository", manual: false)
        ]
        let records: [(String, Double, String, Int, Bool)] = [
            ("Linear", -129, "Software", 7, false),
            ("Forma Studio", 12_400, "Client payment", 7, false),
            ("Ozone Coffee", -42, "Meals & drinks", 7, true),
            ("Figma", -95, "Software", 6, false),
            ("Evergreen", 8_250, "Client payment", 5, false),
            ("The Ministry", -2_450, "Office rent", 4, false),
            ("A. Chen", -3_600, "Contractors", 4, false),
            ("Studio Pensa", 4_100, "Client payment", 3, false),
            ("J. Williams", -1_800, "Contractors", 3, false),
            ("Eurostar", -468, "Travel", 2, true),
            ("Printworks", -600, "Production", 1, true)
        ]
        transactions = records.enumerated().map { index, item in
            TamiasTransaction(id: "sample-transaction-\(index)", name: item.0, amount: item.1, currency: "GBP",
                              date: day(item.3), category: item.2, status: item.4 ? "pending" : "completed", accountName: "Monzo Business",
                              note: item.1 > 0 ? "Invoice payment received" : nil, needsReceipt: item.4,
                              isFulfilled: !item.4, isExported: false, hasExportError: false)
        }
        customers = [
            Customer(id: "sample-forma", name: "Forma Studio", email: "finance@forma.example"),
            Customer(id: "sample-evergreen", name: "Evergreen", email: "hello@evergreen.example"),
            Customer(id: "sample-pensa", name: "Studio Pensa", email: "accounts@pensa.example"),
            Customer(id: "sample-arc", name: "Arc Objects", email: "studio@arc.example"),
            Customer(id: "sample-atelier", name: "Atelier No. 8", email: "hello@atelier.example")
        ]
        invoices = [
            TamiasInvoice(id: "sample-invoice-42", number: "INV-042", customerName: "Arc Objects", amount: 6_200,
                          currency: "GBP", status: "unpaid", dueDate: due(7), issueDate: day(1),
                          note: "Brand identity · phase two", pdfURL: nil),
            TamiasInvoice(id: "sample-invoice-41", number: "INV-041", customerName: "Evergreen", amount: 3_250,
                          currency: "GBP", status: "unpaid", dueDate: due(3), issueDate: day(0),
                          note: "Website design retainer", pdfURL: nil),
            TamiasInvoice(id: "sample-invoice-40", number: "INV-040", customerName: "Atelier No. 8", amount: 1_800,
                          currency: "GBP", status: "overdue", dueDate: due(-5), issueDate: due(-35),
                          note: "Art direction · summer campaign", pdfURL: nil),
            TamiasInvoice(id: "sample-invoice-39", number: "INV-039", customerName: "Forma Studio", amount: 12_400,
                          currency: "GBP", status: "paid", dueDate: day(7), issueDate: due(-23),
                          note: "Brand strategy and visual identity", pdfURL: nil),
            TamiasInvoice(id: "sample-invoice-38", number: "INV-038", customerName: "Evergreen", amount: 8_250,
                          currency: "GBP", status: "paid", dueDate: day(5), issueDate: due(-25),
                          note: "Ecommerce experience design", pdfURL: nil),
            TamiasInvoice(id: "sample-invoice-37", number: "INV-037", customerName: "Studio Pensa", amount: 4_100,
                          currency: "GBP", status: "paid", dueDate: day(3), issueDate: due(-27),
                          note: "Editorial and print design", pdfURL: nil)
        ]
        inbox = [
            InboxItem(id: "sample-inbox-1", name: "Eurostar", fileName: "eurostar-receipt.pdf", amount: 468,
                      currency: "GBP", date: day(2), status: "suggested_match", note: "London → Paris · client workshop"),
            InboxItem(id: "sample-inbox-2", name: "Printworks", fileName: "printworks-invoice.pdf", amount: 600,
                      currency: "GBP", date: day(1), status: "suggested_match", note: "Brand stationery production"),
            InboxItem(id: "sample-inbox-3", name: "Ozone Coffee", fileName: "ozone-receipt.jpg", amount: 42,
                      currency: "GBP", date: day(7), status: "no_match", note: "Client coffee meeting"),
            InboxItem(id: "sample-inbox-4", name: "Figma", fileName: "figma-invoice.pdf", amount: 95,
                      currency: "GBP", date: day(6), status: "done", note: "Professional plan · monthly"),
            InboxItem(id: "sample-inbox-5", name: "Linear", fileName: "linear-invoice.pdf", amount: 129,
                      currency: "GBP", date: day(7), status: "done", note: "Workspace subscription")
        ]
        let incomes: [Double] = [12_800, 14_200, 11_650, 15_900, 14_450, 17_200, 16_850, 20_400, 18_250, 23_100, 22_150, 24_750]
        let expenses: [Double] = [5_800, 6_350, 6_100, 6_900, 6_400, 7_200, 7_100, 8_200, 7_650, 9_600, 8_840, 9_184]
        cashflow = (0..<12).map { index in
            CashflowPoint(date: calendar.date(byAdding: .month, value: index - 11, to: start)!,
                          income: incomes[index], expense: expenses[index])
        }
    }
}
