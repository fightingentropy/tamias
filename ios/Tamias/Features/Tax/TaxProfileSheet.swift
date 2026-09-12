import SwiftUI

struct TaxProfileSheet: View {
    @Bindable var workspace: TaxWorkspace
    @State var profile: SoleTraderProfile
    @Environment(\.dismiss) private var dismiss
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Business") {
                    TextField("Business name", text: $profile.businessName).accessibilityIdentifier("tax.businessName")
                    TextField("What your business does", text: $profile.businessDescription).accessibilityIdentifier("tax.businessDescription")
                    Toggle("This is my sole-trader business", isOn: $profile.soleTrader)
                    Toggle("I use cash-basis accounting", isOn: $profile.cashBasis)
                }
                Section {
                    Toggle("All business records are included", isOn: $profile.recordsComplete)
                } footer: {
                    Text("Include all business accounts, cash payments and income. These figures use payment dates; unpaid invoices are not included.")
                }
                Section {
                    Toggle("I have reviewed tax adjustments", isOn: $profile.adjustmentsReviewed)
                } footer: {
                    Text("Check capital purchases, allowances, losses and any change of accounting basis. Select the relevant details below if these apply.")
                }
                Section("Other income and tax details") {
                    ForEach(SoleTraderProfile.sections, id: \.id) { section in
                        Toggle(section.name, isOn: Binding(get: { profile.additionalSections.contains(section.id) }, set: { selected in
                            profile.additionalSections.removeAll { $0 == section.id }
                            if selected { profile.additionalSections.append(section.id) }
                        }))
                    }
                }
                Section {
                    Toggle("I have checked the details above", isOn: $profile.otherIncomeReviewed).accessibilityIdentifier("tax.otherIncomeReviewed")
                } footer: { Text("Any selected sections must be completed as part of your return. The business export does not calculate your total personal tax bill.") }
                Section {
                    Link("HMRC guidance on business expenses", destination: URL(string: "https://www.gov.uk/expenses-if-youre-self-employed")!)
                    if workspace.store.isDemo { Text("Sign in to save your own tax details.").font(.caption).foregroundStyle(TamiasTheme.muted) }
                    if let error { Text(error).font(.caption).foregroundStyle(.red) }
                }
            }.scrollContentBackground(.hidden).background(TamiasTheme.paper)
                .navigationTitle("Your return").navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() }.disabled(workspace.isSaving) }
                    ToolbarItem(placement: .confirmationAction) {
                        Button(workspace.isSaving ? "Saving…" : "Save") {
                            error = nil
                            Task { do { try await workspace.save(profile); dismiss() } catch { self.error = error.localizedDescription } }
                        }.disabled(workspace.isSaving || workspace.store.isDemo || profile.businessName.count > 100 || profile.businessDescription.count > 200)
                            .accessibilityIdentifier("tax.saveProfile")
                    }
                }.interactiveDismissDisabled(workspace.isSaving)
        }
    }
}
