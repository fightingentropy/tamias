import SwiftUI

struct TaxPreparationView: View {
    @Bindable var workspace: TaxWorkspace
    var body: some View {
        List {
            if let report = workspace.report {
                Section {
                    LabeledContent("Tax year", value: report.label)
                    LabeledContent("Period", value: "6 Apr \(String(report.taxYear)) – 5 Apr \(String(report.taxYear + 1))")
                    LabeledContent("Online deadline", value: "31 Jan \(String(report.taxYear + 2))")
                }
                Section("Business figures") {
                    ForEach(report.groups.filter { $0.amountPence != 0 }) { group in
                        LabeledContent(group.name, value: SoleTraderReport.money(group.amountPence))
                    }
                    LabeledContent("Total expenses", value: SoleTraderReport.money(report.expensesPence))
                    LabeledContent("Profit before adjustments", value: SoleTraderReport.money(report.profitPence))
                }
                if !report.blockers.isEmpty {
                    Section("Still to review") {
                        ForEach(report.blockers, id: \.self) { Text($0).font(.subheadline) }
                    }
                }
                if !report.profile.additionalSections.isEmpty {
                    Section("Other return sections") {
                        ForEach(report.profile.additionalSections, id: \.self) { id in
                            Text(SoleTraderProfile.sections.first { $0.id == id }?.name ?? id).font(.subheadline)
                        }
                    }
                }
                Section {
                    NavigationLink("Prepare and submit with Tamias") { TaxFilingView(workspace: workspace) }
                        .accessibilityIdentifier("tax.filing")
                    Link("File with HMRC", destination: URL(string: "https://www.gov.uk/log-in-file-self-assessment-tax-return")!)
                    Link("Check Making Tax Digital", destination: URL(string: "https://www.gov.uk/guidance/find-out-if-and-when-you-need-to-use-making-tax-digital-for-income-tax")!)
                } footer: {
                    Text("These are business working figures, not a calculation of your total Income Tax or National Insurance. Complete any other income, allowances and adjustments before submitting.")
                }
            }
        }.listStyle(.insetGrouped).scrollContentBackground(.hidden).background(TamiasTheme.paper)
            .navigationTitle("Self Assessment").navigationBarTitleDisplayMode(.inline)
            .accessibilityIdentifier("screen.taxPreparation")
    }
}
