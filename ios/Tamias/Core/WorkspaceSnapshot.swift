import Foundation

/// Read data only. Protected by the device passcode and scoped to the last verified Keychain identity.
/// No credential, signed file URL, invoice send request or upload ticket is stored in this cache.
struct WorkspaceSnapshot: Codable {
    let version: Int
    let userID: String
    let teamID: String?
    let fetchedAt: Date
    let currency: String
    let accounts: [BankAccount]
    let transactions: [TamiasTransaction]
    let invoices: [TamiasInvoice]
    let inbox: [InboxItem]
    let customers: [Customer]
    let categories: [TransactionCategory]
    let cashflow: [CashflowPoint]
    let invoiceSummary: InvoiceSummaryDTO?
    let balancesAvailable: Bool
    let cashflowAvailable: Bool
    let invoiceSummaryAvailable: Bool
    let transactionsCursor: String?
    let invoicesCursor: String?
    let inboxCursor: String?
    let hasMoreTransactions: Bool
    let hasMoreInvoices: Bool
    let hasMoreInbox: Bool

    func belongs(to user: TamiasUser) -> Bool { version == 1 && userID == user.id && teamID == user.team?.id }
}
