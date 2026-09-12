import SwiftUI

struct WorkspaceSettingsView: View {
    @Bindable var store: TamiasStore
    @Environment(\.dismiss) private var dismiss
    @State private var email = ""
    @State private var password = ""
    @State private var apiKey = ""
    @State private var useAPIKey = false
    @State private var isConnecting = false
    @State private var error: String?
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
                    Section {
                        if useAPIKey {
                            SecureField("Tamias API key", text: $apiKey).textInputAutocapitalization(.never).autocorrectionDisabled().accessibilityIdentifier("auth.apiKey")
                        } else {
                            TextField("Email", text: $email).textContentType(.username).keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled().accessibilityIdentifier("auth.email")
                            SecureField("Password", text: $password).textContentType(.password).accessibilityIdentifier("auth.password")
                        }
                        Button {
                            isConnecting = true
                            error = nil
                            Task {
                                do {
                                    if useAPIKey { try await store.connect(apiKey: apiKey.trimmingCharacters(in: .whitespacesAndNewlines)) }
                                    else { try await store.signIn(email: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password) }
                                    password = ""; apiKey = ""
                                } catch { self.error = error.localizedDescription }
                                isConnecting = false
                            }
                        } label: {
                            HStack { Text(isConnecting ? "Signing in…" : "Sign in"); Spacer(); if isConnecting { ProgressView() } else { Image(systemName: "arrow.right") } }
                        }.disabled(isConnecting || (useAPIKey ? apiKey.isEmpty : email.isEmpty || password.isEmpty)).accessibilityIdentifier("auth.connect")
                        Button(useAPIKey ? "Use email and password" : "Use an API key") { useAPIKey.toggle(); error = nil }.font(.subheadline)
                        if let error { Text(error).font(.caption).foregroundStyle(.red) }
                    } header: { Text("Sign in") }
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
                    }
                }
            }.scrollContentBackground(.hidden).background(TamiasTheme.paper)
            .navigationTitle("Settings").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() }.disabled(isConnecting) } }
            .interactiveDismissDisabled(isConnecting)
        }
    }
}
