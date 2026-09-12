import SwiftUI

struct ReceiptDateField: View {
    @Binding var date: Date?
    private var today: Date {
        var local = Calendar(identifier: .gregorian); local.timeZone = .current
        return TamiasDates.calendar.date(from: local.dateComponents([.year, .month, .day], from: .now)) ?? .now
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Toggle("Receipt date", isOn: Binding(get: { date != nil }, set: { date = $0 ? today : nil }))
                .accessibilityIdentifier("receipt.hasDate")
            if date != nil {
                DatePicker("Date", selection: Binding(get: { date ?? today }, set: { date = $0 }), displayedComponents: .date)
                    .environment(\.timeZone, .gmt)
                    .accessibilityIdentifier("receipt.date")
            }
        }
    }
}

struct ReceiptSuggestionsCard: View {
    let recognition: ReceiptRecognition?
    let isRecognizing: Bool
    let error: String?
    let apply: () -> Void
    @State private var applied = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if isRecognizing { ProgressView("Reading receipt…").font(.subheadline) }
            else if let error { Label(error, systemImage: "text.viewfinder").font(.footnote).foregroundStyle(TamiasTheme.muted) }
            else if let recognition {
                if recognition.hasSuggestions && !applied {
                    HStack(alignment: .top, spacing: 12) {
                        VStack(alignment: .leading, spacing: 5) {
                            if let merchant = recognition.merchant { Text(merchant).font(.subheadline.weight(.medium)) }
                            if let amount = recognition.amount { Text("\(recognition.currency ?? "") \(amount)").font(.subheadline.monospacedDigit()) }
                            if let date = recognition.date { Text(date.formatted(TamiasTheme.ledgerShort)).font(.caption).foregroundStyle(TamiasTheme.muted) }
                        }
                        Spacer()
                        Button("Fill details") { apply(); applied = true }
                            .font(.subheadline.weight(.semibold))
                            .accessibilityIdentifier("receipt.useSuggestions")
                    }
                    .tamiasCard(padding: 14)
                } else if !recognition.hasSuggestions {
                    Text("Enter the receipt details below.").font(.footnote).foregroundStyle(TamiasTheme.muted)
                }
                if let notice = recognition.notice { Text(notice).font(.caption).foregroundStyle(TamiasTheme.muted) }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .onChange(of: recognition) { _, _ in applied = false }
    }
}
