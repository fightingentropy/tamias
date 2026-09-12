import SwiftUI

enum TamiasTheme {
    static let ink = Color(uiColor: UIColor { $0.userInterfaceStyle == .dark ? UIColor(white: 0.95, alpha: 1) : UIColor(white: 0.10, alpha: 1) })
    static let muted = Color(uiColor: .secondaryLabel)
    static let paper = Color(uiColor: UIColor { $0.userInterfaceStyle == .dark ? .black : UIColor(white: 0.97, alpha: 1) })
    static let surface = Color(uiColor: UIColor { $0.userInterfaceStyle == .dark ? UIColor(white: 0.075, alpha: 1) : .white })
    static let line = Color.primary.opacity(0.09)
    static let green = Color(uiColor: UIColor { $0.userInterfaceStyle == .dark ? UIColor(red: 0.49, green: 0.77, blue: 0.64, alpha: 1) : UIColor(red: 0.17, green: 0.39, blue: 0.29, alpha: 1) })
    static let amber = Color(uiColor: UIColor { $0.userInterfaceStyle == .dark ? UIColor(red: 0.88, green: 0.67, blue: 0.40, alpha: 1) : UIColor(red: 0.61, green: 0.37, blue: 0.15, alpha: 1) })
    static let ledgerDay = Date.FormatStyle(date: .omitted, time: .omitted, timeZone: .gmt).day().month(.abbreviated)
    static let ledgerMonth = Date.FormatStyle(date: .omitted, time: .omitted, timeZone: .gmt).month(.abbreviated)
    static let ledgerLong = Date.FormatStyle(date: .long, time: .omitted, timeZone: .gmt)
    static let ledgerShort = Date.FormatStyle(date: .abbreviated, time: .omitted, timeZone: .gmt)

    static func money(_ value: Double, currency: String = "GBP", decimals: Bool = true) -> String {
        guard Locale.commonISOCurrencyCodes.contains(currency.uppercased()) else {
            return value.formatted(.number.precision(.fractionLength(decimals ? 2 : 0))) + " (currency unknown)"
        }
        return value.formatted(.currency(code: currency).precision(.fractionLength(decimals ? InvoiceMoney.decimalPlaces(currency) : 0)))
    }
}

struct WorkspaceDataNotice: View {
    let store: TamiasStore
    var body: some View {
        if store.isUsingOfflineSnapshot || store.isSnapshotStale, let snapshotDate = store.snapshotDate {
            VStack(alignment: .leading, spacing: 5) {
                Label("Offline", systemImage: "wifi.slash").font(.caption.weight(.semibold))
                Text("Updated \(snapshotDate.formatted(date: .abbreviated, time: .shortened))")
                    .font(.caption).foregroundStyle(TamiasTheme.muted)
            }.frame(maxWidth: .infinity, alignment: .leading).padding(14)
                .background(TamiasTheme.amber.opacity(0.08), in: RoundedRectangle(cornerRadius: 13))
        }
        if let error = store.errorMessage {
            VStack(alignment: .leading, spacing: 10) {
                Label(store.needsReauthentication ? "Sign in again" : "Couldn’t refresh", systemImage: "wifi.exclamationmark")
                    .font(.subheadline.weight(.medium))
                Text(error).font(.caption).foregroundStyle(TamiasTheme.muted)
                if !store.dataWarnings.isEmpty {
                    DisclosureGroup("Details") {
                        ForEach(store.dataWarnings, id: \.self) { Text($0).font(.caption).frame(maxWidth: .infinity, alignment: .leading).padding(.top, 4) }
                    }.font(.caption)
                }
                Button("Try again") { Task { await store.refresh() } }.font(.subheadline.bold()).disabled(store.isLoading)
            }.tamiasCard()
        } else if store.isLoading && store.lastRefreshed == nil {
            HStack(spacing: 10) { ProgressView(); Text("Loading…").font(.subheadline).foregroundStyle(TamiasTheme.muted) }.frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

struct TamiasMark: View {
    var size: CGFloat = 30
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.26).fill(TamiasTheme.ink)
            Image("TamiasMark").resizable().renderingMode(.template)
                .padding(size * 0.15).foregroundStyle(TamiasTheme.paper)
        }.frame(width: size, height: size).accessibilityHidden(true)
    }
}

struct Eyebrow: View {
    let text: String
    var body: some View {
        Text(text).font(.subheadline).foregroundStyle(TamiasTheme.muted)
    }
}

struct SectionHeading<Trailing: View>: View {
    let title: String
    @ViewBuilder var trailing: Trailing
    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title).font(.system(.title3, weight: .semibold)).tracking(-0.4)
            Spacer()
            trailing.font(.subheadline).foregroundStyle(TamiasTheme.muted)
        }
    }
}

struct StatusPill: View {
    let text: String
    var tone: Color = TamiasTheme.green
    var body: some View {
        Text(text).font(.system(.caption2, weight: .medium)).foregroundStyle(tone)
            .padding(.horizontal, 8).padding(.vertical, 5)
            .background(tone.opacity(0.09), in: RoundedRectangle(cornerRadius: 5))
    }
}

struct MerchantIcon: View {
    let name: String
    var symbol: String? = nil
    var incoming = false
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 13).fill(incoming ? TamiasTheme.green.opacity(0.09) : TamiasTheme.ink.opacity(0.045))
            if let symbol {
                Image(systemName: symbol).font(.system(size: 18, weight: .medium))
            } else {
                Text(String(name.prefix(1)).uppercased()).font(.system(size: 18, weight: .medium))
            }
        }.frame(width: 44, height: 44).foregroundStyle(incoming ? TamiasTheme.green : TamiasTheme.ink).accessibilityHidden(true)
    }
}

struct PrimaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.font(.system(.body, weight: .semibold))
            .frame(maxWidth: .infinity).padding(.vertical, 16)
            .foregroundStyle(TamiasTheme.paper)
            .background(TamiasTheme.ink, in: RoundedRectangle(cornerRadius: 15))
            .opacity(!isEnabled ? 0.4 : configuration.isPressed ? 0.75 : 1)
    }
}

struct EmptyWorkspace: View {
    let symbol: String
    let title: String
    let message: String
    var body: some View {
        ContentUnavailableView {
            Label(title, systemImage: symbol)
        } description: {
            Text(message)
        }.padding(.vertical, 30)
    }
}

extension View {
    func tamiasCard(padding: CGFloat = 18) -> some View {
        self.padding(padding).background(TamiasTheme.surface, in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(TamiasTheme.line, lineWidth: 0.7))
    }
}
