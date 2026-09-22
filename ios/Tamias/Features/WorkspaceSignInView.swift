import SwiftUI

struct WorkspaceSignInView: View {
    @Bindable var store: TamiasStore

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    VStack(alignment: .leading, spacing: 16) {
                        TamiasMark(size: 52)
                        Text("Your finances, on your iPhone")
                            .font(.title2.weight(.medium))
                        Text("Sign in to see the accounts, imported statements and transactions already in your Tamias workspace.")
                            .font(.subheadline).foregroundStyle(TamiasTheme.muted)
                    }.padding(.vertical, 12)
                }
                WorkspaceAuthenticationSection(store: store)
                Section {
                    Button("Explore sample workspace") { store.enterDemoMode() }
                        .disabled(store.isLoading)
                        .accessibilityIdentifier("auth.exploreDemo")
                } footer: {
                    Text("The sample workspace contains fictional figures.")
                }
            }
            .scrollContentBackground(.hidden).background(TamiasTheme.paper)
            .navigationTitle("Tamias")
            .accessibilityIdentifier("screen.signIn")
        }
    }
}

/// The same sign-in flow is available on first launch and when reconnecting a saved workspace.
struct WorkspaceAuthenticationSection: View {
    @Bindable var store: TamiasStore
    var onConnected: () -> Void = {}
    @State private var email = ""
    @State private var password = ""
    @State private var apiKey = ""
    @State private var useAPIKey = false
    @State private var isConnecting = false
    @State private var error: String?

    var body: some View {
        Section {
            if useAPIKey {
                SecureField("Tamias API key", text: $apiKey)
                    .textInputAutocapitalization(.never).autocorrectionDisabled()
                    .accessibilityIdentifier("auth.apiKey")
            } else {
                TextField("Email", text: $email)
                    .textContentType(.username).keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never).autocorrectionDisabled()
                    .accessibilityIdentifier("auth.email")
                SecureField("Password", text: $password)
                    .textContentType(.password).accessibilityIdentifier("auth.password")
            }
            Button {
                isConnecting = true
                error = nil
                Task {
                    do {
                        if useAPIKey { try await store.connect(apiKey: apiKey) }
                        else { try await store.signIn(email: email, password: password) }
                        password = ""; apiKey = ""
                        onConnected()
                    } catch { self.error = error.localizedDescription }
                    isConnecting = false
                }
            } label: {
                HStack {
                    Text(isConnecting ? "Signing in…" : "Sign in")
                    Spacer()
                    if isConnecting { ProgressView() } else { Image(systemName: "arrow.right") }
                }
            }
            .disabled(isConnecting || store.isLoading || (useAPIKey ? apiKey.isEmpty : email.isEmpty || password.isEmpty))
            .accessibilityIdentifier("auth.connect")
            Button(useAPIKey ? "Use email and password" : "Use an API key") {
                useAPIKey.toggle(); error = nil
            }.font(.subheadline).disabled(isConnecting)
            if let message = error ?? store.errorMessage {
                Text(message).font(.caption).foregroundStyle(.red)
                    .accessibilityIdentifier("auth.error")
            }
        } header: { Text(store.needsReauthentication ? "Reconnect your workspace" : "Sign in") }
        .onAppear { if email.isEmpty { email = store.user?.email ?? "" } }
    }
}
