import SwiftUI

struct WorkspaceSettingsView: View {
    @Bindable var store: TamiasStore
    @Environment(\.dismiss) private var dismiss
    @AppStorage("tamias.appearance") private var appearance = "System"

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack(spacing: 14) {
                        TamiasMark(size: 48)
                        VStack(alignment: .leading, spacing: 5) {
                            Text(store.teamName).font(.headline)
                            Text(store.isDemo ? "Demo" : store.user?.email ?? "Signed in").font(.caption).foregroundStyle(TamiasTheme.muted)
                        }
                    }.padding(.vertical, 9)
                }
                if store.isDemo || !store.isAuthenticated || store.needsReauthentication {
                    WorkspaceAuthenticationSection(store: store, onConnected: { dismiss() })
                }
                if !store.accounts.isEmpty {
                    Section("Accounts") {
                        ForEach(store.accounts) { account in
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(account.name).font(.subheadline)
                                    Text(account.currency).font(.caption).foregroundStyle(TamiasTheme.muted)
                                }
                                Spacer()
                                if let balance = account.balance { Text(TamiasTheme.money(balance, currency: account.currency)).font(.subheadline).monospacedDigit() }
                            }
                        }
                    }
                }
                Section("Appearance") {
                    Picker("Theme", selection: $appearance) { ForEach(["System", "Light", "Dark"], id: \.self) { Text($0) } }
                }
                Section {
                    Link("Open Tamias on the web", destination: URL(string: "https://app.tamias.xyz")!)
                    LabeledContent("Version", value: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.1.1")
                    if store.isAuthenticated {
                        Button("Sign out", role: .destructive) { store.signOut() }
                    } else if store.isDemo {
                        Button("Leave sample workspace") { store.signOut(); dismiss() }
                    }
                }
            }.scrollContentBackground(.hidden).background(TamiasTheme.paper)
            .navigationTitle("Settings").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() }.disabled(store.isLoading) } }
            .interactiveDismissDisabled(store.isLoading)
        }
    }
}
