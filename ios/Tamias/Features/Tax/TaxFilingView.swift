import SwiftUI

struct TaxFilingView: View {
    @Bindable var workspace: TaxWorkspace
    @State private var history: TaxFilings?
    @State private var loading = false
    @State private var showIdentity = false
    @State private var error: String?
    var body: some View {
        List {
            Section {
                Text("2025/26 Self Assessment").font(.headline)
                Text("Prepare a return for one cash-basis sole-trader business. Other income, reliefs, losses and Making Tax Digital need a different filing route.")
                    .font(.subheadline).foregroundStyle(TamiasTheme.muted)
            }
            if let connection = history?.connection {
                Section("HMRC connection") {
                    LabeledContent("Environment", value: connection.environment == "test" ? "Test service" : "Live service")
                    ForEach(connection.blockers, id: \.self) { Text($0).font(.subheadline) }
                    if connection.environment == "test" { Text("Test submissions do not file your tax return.").font(.subheadline).foregroundStyle(TamiasTheme.muted) }
                }
            }
            if let report = workspace.report {
                if !report.filingBlockers.isEmpty {
                    Section("Before preparing") { ForEach(report.filingBlockers, id: \.self) { Text($0).font(.subheadline) } }
                }
                Section {
                    Button("Prepare return for review") { showIdentity = true }
                        .disabled(workspace.store.isDemo || !report.filingBlockers.isEmpty || loading)
                        .accessibilityIdentifier("tax.prepareReturn")
                } footer: { Text("Preparing saves a copy to review. Submission requires a separate declaration and confirmation.") }
            }
            if let history, !history.data.isEmpty, let report = workspace.report {
                Section("Submission history") {
                    ForEach(history.data) { filing in
                        NavigationLink {
                            TaxFilingDetailView(store: workspace.store, workspaceID: workspace.workspaceID, year: report.taxYear,
                                filing: filing, connection: history.connection)
                        } label: {
                            VStack(alignment: .leading, spacing: 6) {
                                Text(filing.statusLabel)
                                Text(filing.createdAt.formatted(date: .abbreviated, time: .shortened)).font(.caption).foregroundStyle(TamiasTheme.muted)
                            }.padding(.vertical, 4)
                        }
                    }
                }
            }
            if loading { ProgressView() }
            if let error { Section { Text(error).font(.subheadline).foregroundStyle(.red); Button("Try again") { Task { await load() } } } }
        }.listStyle(.insetGrouped).scrollContentBackground(.hidden).background(TamiasTheme.paper)
            .navigationTitle("HMRC filing").navigationBarTitleDisplayMode(.inline)
            .task { await load() }.refreshable { await load() }
            .sheet(isPresented: $showIdentity, onDismiss: { Task { await load() } }) { TaxFilingIdentitySheet(workspace: workspace) }
            .accessibilityIdentifier("screen.taxFiling")
    }
    private func load() async {
        guard let report = workspace.report, !workspace.store.isDemo else { return }
        loading = true; error = nil
        defer { loading = false }
        do {
            let result = try await workspace.store.loadTaxFilings(year: report.taxYear, expectedWorkspaceID: workspace.workspaceID)
            guard workspace.store.workspaceID == workspace.workspaceID else { return }
            history = result
        } catch { self.error = error.localizedDescription }
    }
}

private struct TaxFilingIdentitySheet: View {
    @Bindable var workspace: TaxWorkspace
    @Environment(\.dismiss) private var dismiss
    @State private var identity = TaxFilingIdentity()
    @State private var dateOfBirth = Calendar(identifier: .gregorian).date(from: DateComponents(year: 1990, month: 1, day: 1))!
    @State private var busy = false
    @State private var error: String?
    private var complete: Bool {
        !identity.fullName.trimmingCharacters(in: .whitespaces).isEmpty && identity.utr.count == 10 && identity.nino.count == 9 &&
        identity.onlyThisBusinessIncome && identity.standardPersonalAllowance && identity.noOtherChargesOrReliefs &&
        identity.businessOperatedFullYear && identity.standardNationalInsurance
    }
    var body: some View {
        NavigationStack {
            Form {
                Section("Your details") {
                    TextField("Full name", text: $identity.fullName).textContentType(.name)
                    TextField("10-digit UTR", text: $identity.utr).keyboardType(.numberPad).privacySensitive()
                    TextField("National Insurance number", text: $identity.nino).textInputAutocapitalization(.characters).autocorrectionDisabled().privacySensitive()
                    DatePicker("Date of birth", selection: $dateOfBirth, in: ...Date.now, displayedComponents: .date)
                    Picker("Taxpayer status", selection: $identity.taxpayerStatus) {
                        Text("England / Northern Ireland").tag("U"); Text("Scotland").tag("S"); Text("Wales").tag("C")
                    }
                }
                Section {
                    Toggle("This business is my only income", isOn: $identity.onlyThisBusinessIncome)
                    Toggle("I qualify for the standard Personal Allowance", isOn: $identity.standardPersonalAllowance)
                    Toggle("No other charges, reliefs or tax deducted", isOn: $identity.noOtherChargesOrReliefs)
                    Toggle("My business operated for the full tax year", isOn: $identity.businessOperatedFullYear)
                    Toggle("Standard self-employed National Insurance applies", isOn: $identity.standardNationalInsurance)
                } header: { Text("Confirm this applies to you") } footer: {
                    Text("Other charges or deductions include the Child Benefit charge, student loans, CIS deductions, underpaid tax and pension charges. If these apply, complete the return with HMRC or your accountant.")
                }
                Section {
                    Picker("Voluntary contributions", selection: $identity.class2Choice) {
                        Text("Not needed: profit £6,845 or more").tag("not_needed")
                        Text("Below £6,845: choose not to pay").tag("do_not_pay")
                        Text("Below £6,845: want to pay").tag("pay_voluntarily")
                    }.pickerStyle(.navigationLink)
                } header: { Text("Class 2 National Insurance") } footer: { Text("Voluntary Class 2 payments need to be completed through HMRC or your accountant.") }
                if let error { Text(error).foregroundStyle(.red).font(.subheadline) }
            }.disabled(busy).navigationTitle("Prepare return").navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() }.disabled(busy) }
                    ToolbarItem(placement: .confirmationAction) { Button(busy ? "Preparing…" : "Prepare") { prepare() }.disabled(!complete || busy) }
                }
                .interactiveDismissDisabled(busy)
        }
    }
    private func prepare() {
        guard let report = workspace.report else { return }
        let formatter = DateFormatter(); formatter.locale = Locale(identifier: "en_US_POSIX"); formatter.dateFormat = "yyyy-MM-dd"
        identity.dateOfBirth = formatter.string(from: dateOfBirth)
        identity.nino = identity.nino.uppercased().replacingOccurrences(of: " ", with: "")
        busy = true; error = nil
        Task {
            defer { busy = false }
            do { _ = try await workspace.store.prepareTaxFiling(report: report, identity: identity, expectedWorkspaceID: workspace.workspaceID); dismiss() }
            catch { self.error = error.localizedDescription }
        }
    }
}

private struct TaxFilingDetailView: View {
    let store: TamiasStore
    let workspaceID: String
    let year: Int
    @State var filing: TaxFiling
    let connection: TaxFilingConnection
    @State private var declared = false
    @State private var senderId = ""
    @State private var password = ""
    @State private var busy = false
    @State private var confirmSend = false
    @State private var error: String?
    @State private var evidenceURL: URL?
    @State private var showEvidence = false
    var body: some View {
        List {
            Section {
                Text(filing.statusLabel).font(.headline)
                if filing.isTest { Text("Test return · does not fulfil your filing obligation").font(.subheadline).foregroundStyle(TamiasTheme.muted) }
                if let receipt = filing.receipt {
                    Text(receipt.summary).font(.subheadline)
                    ForEach(Array(receipt.errors.enumerated()), id: \.offset) { _, issue in Text(issue.text).font(.subheadline).foregroundStyle(.red) }
                }
                if filing.status == "unknown" || filing.status == "pending" {
                    Text("Acceptance is unconfirmed. Check the saved receipt and your HMRC account before trying to file again.").font(.subheadline)
                }
            }
            Section("Return details") {
                LabeledContent("Name", value: filing.identity.fullName)
                LabeledContent("UTR", value: filing.identity.utr).privacySensitive()
                LabeledContent("National Insurance", value: filing.identity.nino).privacySensitive()
                LabeledContent("Tax year", value: "\(String(year))/\(String(year + 1).suffix(2))")
                ForEach(filing.calculation.groups.filter { $0.wholePounds != 0 }) { group in
                    LabeledContent(group.name, value: SoleTraderReport.money(group.wholePounds * 100))
                }
                LabeledContent("Taxable business profit", value: SoleTraderReport.money(filing.calculation.profitPounds * 100))
            }
            Section {
                LabeledContent("Income Tax", value: SoleTraderReport.money(filing.calculation.incomeTaxPence))
                LabeledContent("Class 4 National Insurance", value: SoleTraderReport.money(filing.calculation.class4Pence))
                LabeledContent("Total tax for this return", value: SoleTraderReport.money(filing.calculation.totalTaxPence))
            } footer: { Text("Uses whole-pound return figures. Before payments already made and payments on account for next year. This is not your HMRC account balance.") }
            Section("Return reference") {
                Text(filing.irMark).font(.caption.monospaced()).textSelection(.enabled)
                if let reference = filing.correlationId { Text(reference).font(.caption.monospaced()).textSelection(.enabled) }
                Button("Save return and receipt") { saveEvidence() }.disabled(busy)
            }
            if filing.status == "prepared" {
                Section {
                    ForEach(connection.blockers, id: \.self) { Text($0).font(.subheadline) }
                    if !filing.isTest {
                        TextField("Government Gateway user ID", text: $senderId).textInputAutocapitalization(.never).autocorrectionDisabled().privacySensitive()
                        SecureField("Government Gateway password", text: $password)
                    }
                    Toggle("I declare that this return is correct and complete to the best of my knowledge and belief", isOn: $declared)
                    Button(filing.isTest ? "Send test return" : "Submit return to HMRC") { confirmSend = true }
                        .disabled(busy || !declared || !connection.ready || (!filing.isTest && (senderId.isEmpty || password.isEmpty)))
                } footer: { Text("Government Gateway credentials are used for this submission only and are not saved by Tamias.") }
            } else if filing.correlationId != nil && ["acknowledged", "unknown"].contains(filing.status) {
                Section {
                    TimelineView(.periodic(from: .now, by: 1)) { context in
                        Button("Check HMRC status") { poll() }.disabled(busy || (filing.nextPollAt ?? .distantPast) > context.date)
                    }
                }
            }
            if busy { ProgressView() }
            if let error { Text(error).font(.subheadline).foregroundStyle(.red) }
        }.listStyle(.insetGrouped).scrollContentBackground(.hidden).background(TamiasTheme.paper)
            .navigationTitle("Review return").navigationBarTitleDisplayMode(.inline)
            .confirmationDialog(filing.isTest ? "Send this test return?" : "Submit your \(year)/\(String(year + 1).suffix(2)) return to HMRC?", isPresented: $confirmSend, titleVisibility: .visible) {
                Button(filing.isTest ? "Send test return" : "Submit to HMRC") { submit() }
                Button("Cancel", role: .cancel) { }
            } message: { Text("\(filing.identity.fullName) · UTR ending \(filing.identity.utr.suffix(4)) · Tax \(SoleTraderReport.money(filing.calculation.totalTaxPence))") }
            .sheet(isPresented: $showEvidence, onDismiss: cleanup) { if let evidenceURL { TaxEvidenceShareSheet(url: evidenceURL) } }
            .onDisappear { password = ""; senderId = "" }
    }
    private func submit() {
        let body = TaxFilingSubmission(declarationAccepted: declared, confirmedIrMark: filing.irMark,
            senderId: filing.isTest ? nil : senderId, password: filing.isTest ? nil : password)
        password = ""; senderId = ""; busy = true; error = nil
        Task {
            defer { busy = false }
            do { filing = try await store.submitTaxFiling(year: year, filing: filing, body: body, expectedWorkspaceID: workspaceID) }
            catch { self.error = "\(error.localizedDescription) Refresh submission history before trying again." }
        }
    }
    private func poll() {
        busy = true; error = nil
        Task {
            defer { busy = false }
            do { filing = try await store.pollTaxFiling(year: year, id: filing.id, expectedWorkspaceID: workspaceID) }
            catch { self.error = error.localizedDescription }
        }
    }
    private func saveEvidence() {
        busy = true; error = nil
        Task {
            defer { busy = false }
            do {
                let evidence = try await store.taxFilingEvidence(year: year, id: filing.id, expectedWorkspaceID: workspaceID)
                guard store.workspaceID == workspaceID else { throw WorkflowError.workspaceChanged }
                let folder = FileManager.default.temporaryDirectory.appendingPathComponent("TamiasTaxEvidence").appendingPathComponent(UUID().uuidString)
                try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true, attributes: [.protectionKey: FileProtectionType.complete])
                let url = folder.appendingPathComponent("Tamias-Self-Assessment-\(year)-receipt.json")
                let encoder = JSONEncoder(); encoder.outputFormatting = [.prettyPrinted, .sortedKeys]; encoder.dateEncodingStrategy = .iso8601
                try encoder.encode(evidence).write(to: url, options: [.atomic, .completeFileProtection])
                evidenceURL = url; showEvidence = true
            } catch { self.error = error.localizedDescription }
        }
    }
    private func cleanup() { if let evidenceURL { try? FileManager.default.removeItem(at: evidenceURL.deletingLastPathComponent()) }; evidenceURL = nil }
}

private struct TaxEvidenceShareSheet: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context: Context) -> UIActivityViewController { UIActivityViewController(activityItems: [url], applicationActivities: nil) }
    func updateUIViewController(_ controller: UIActivityViewController, context: Context) { }
}
