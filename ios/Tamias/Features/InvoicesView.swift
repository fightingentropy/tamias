import CoreText
import QuickLook
import SwiftUI

struct InvoicesView: View {
    @Bindable var store: TamiasStore
    @Binding var sheet: WorkspaceSheet?
    @Binding var filter: String
    @State private var query = ""
    private var request: InvoiceFilters {
        InvoiceFilters(query: query, status: filter == "Outstanding" ? "outstanding" : filter == "Paid" ? "paid" : nil)
    }
    private var filtered: [TamiasInvoice] { store.invoiceResults }


    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 25) {
                WorkspaceDataNotice(store: store)
                VStack(alignment: .leading, spacing: 10) {
                    Eyebrow(text: "Outstanding")
                    Text(store.invoiceSummaryAvailable ? TamiasTheme.money(store.outstandingAmount, currency: store.currency) : "—")
                        .font(.system(.largeTitle, design: .rounded, weight: .regular)).tracking(-1.5)
                }.padding(.vertical, 8)
                FilterStrip(options: ["All", "Outstanding", "Paid", "Drafts"], selection: $filter)
                if filter != "Drafts" {
                    if store.invoiceResultsAreCached { Label("Offline · showing saved invoices", systemImage: "wifi.slash").font(.caption).foregroundStyle(TamiasTheme.amber) }
                    if let error = store.invoiceSearchError { Text(error).font(.caption).foregroundStyle(TamiasTheme.amber) }
                    if store.isSearchingInvoices { ProgressView().frame(maxWidth: .infinity) }
                }
                if filter == "Drafts" {
                    localDrafts
                } else if filtered.isEmpty {
                    EmptyWorkspace(symbol: "doc.text", title: "No invoices", message: "Create one with the + button.")
                } else {
                    VStack(spacing: 13) {
                        ForEach(filtered) { invoice in
                            NavigationLink { InvoiceDetailView(invoice: invoice) } label: { InvoiceCard(invoice: invoice) }.buttonStyle(.plain)
                        }
                    }
                }
                if filter != "Drafts" && store.hasMoreInvoiceResults { Button("Load more invoices") { Task { await store.loadMoreInvoiceResults() } }.buttonStyle(PrimaryButtonStyle()).disabled(store.isLoading || store.isLoadingMore) }
            }.padding(22).frame(maxWidth: 680).frame(maxWidth: .infinity)
        }
        .background(TamiasTheme.paper).navigationTitle("Invoices")
        .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search invoices")
        .toolbar {
            ToolbarItem(placement: .topBarLeading) { if store.isDemo { StatusPill(text: "Demo", tone: TamiasTheme.muted).fixedSize() } }
            ToolbarItem(placement: .topBarTrailing) { Button { sheet = .invoice } label: { Image(systemName: "plus") }.accessibilityLabel("New invoice").accessibilityIdentifier("action.newInvoice") }
        }
        .task(id: request) {
            guard filter != "Drafts" else { return }
            do { try await Task.sleep(for: .milliseconds(280)) } catch { return }
            await store.searchInvoices(request)
        }
        .refreshable { await store.searchInvoices(request) }.accessibilityIdentifier("screen.invoices")
    }

    @ViewBuilder private var localDrafts: some View {
        let drafts = store.localDrafts.filter { query.isEmpty || "\($0.customerName) \($0.description)".localizedCaseInsensitiveContains(query) }
        if drafts.isEmpty {
            EmptyWorkspace(symbol: "square.and.pencil", title: "No drafts", message: "Create one with the + button.")
        } else {
            ForEach(drafts) { draft in
                NavigationLink { LocalDraftDetailView(store: store, draftID: draft.id) } label: {
                    VStack(alignment: .leading, spacing: 17) {
                        HStack { MerchantIcon(name: draft.customerName); Text(draft.customerName).font(.subheadline.weight(.medium)); Spacer(); StatusPill(text: draft.submittedInvoiceID != nil ? "Issued" : draft.remoteDraftID != nil ? "Draft" : "On this iPhone", tone: TamiasTheme.muted) }
                        Text(draft.description).font(.subheadline).lineLimit(2).foregroundStyle(TamiasTheme.muted)
                        HStack { Text("Due \(draft.dueDate.formatted(.dateTime.month(.abbreviated).day()))").font(.caption); Spacer(); Text(TamiasTheme.money(draft.amount, currency: draft.currency)).font(.title3.weight(.medium)) }
                    }.tamiasCard()
                }.buttonStyle(.plain)
            }
        }
    }
}

struct InvoiceCard: View {
    let invoice: TamiasInvoice
    private var tone: Color { invoice.status.lowercased() == "paid" ? TamiasTheme.green : invoice.status.lowercased() == "overdue" ? TamiasTheme.amber : TamiasTheme.muted }
    var body: some View {
        HStack(spacing: 12) {
            MerchantIcon(name: invoice.customerName)
            VStack(alignment: .leading, spacing: 5) {
                Text(invoice.customerName).font(.subheadline.weight(.medium))
                Text("\(invoice.number) · Due \(invoice.dueDate.formatted(TamiasTheme.ledgerShort))")
                    .font(.caption).foregroundStyle(TamiasTheme.muted)
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 5) {
                Text(TamiasTheme.money(invoice.amount, currency: invoice.currency))
                    .font(.subheadline.weight(.medium)).monospacedDigit()
                Text(invoice.status.capitalized).font(.caption).foregroundStyle(tone)
            }
        }.padding(.vertical, 12)

    }
}

struct InvoiceDetailView: View {
    let invoice: TamiasInvoice
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                HStack { TamiasMark(); Spacer(); StatusPill(text: invoice.status.capitalized) }
                Text(invoice.customerName).font(.system(.largeTitle, design: .default)).tracking(-0.8)
                Text(TamiasTheme.money(invoice.amount, currency: invoice.currency)).font(.system(.largeTitle, design: .rounded)).tracking(-1.5)
                VStack(spacing: 0) {
                    DetailLine(title: "Invoice", value: invoice.number)
                    DetailLine(title: "Issued", value: invoice.issueDate.formatted(TamiasTheme.ledgerDay))
                    DetailLine(title: "Due", value: invoice.dueDate.formatted(TamiasTheme.ledgerDay))
                    DetailLine(title: "Currency", value: invoice.currency, divider: false)
                }.tamiasCard()
                if let note = invoice.note, !note.isEmpty { Text(note).font(.subheadline).foregroundStyle(TamiasTheme.muted) }
                if let url = invoice.pdfURL, url.scheme == "https" {
                    Link(destination: url) { Label("Open invoice PDF", systemImage: "arrow.up.right.square") }.buttonStyle(PrimaryButtonStyle())
                }
            }.padding(25).frame(maxWidth: 680).frame(maxWidth: .infinity)
        }.background(TamiasTheme.paper).navigationTitle("Invoice").navigationBarTitleDisplayMode(.inline)
    }
}

struct LocalDraftDetailView: View {
    @Bindable var store: TamiasStore
    let draftID: UUID
    @State private var isEditing = false
    @State private var showReview = false
    @State private var previewURL: URL?
    @State private var error: String?
    @State private var isSyncing = false
    private var draft: InvoiceDraft? { store.localDrafts.first { $0.id == draftID } }

    var body: some View {
        ScrollView {
            if let draft {
                VStack(alignment: .leading, spacing: 23) {
                    StatusPill(text: draft.submittedInvoiceID != nil ? "Issued" : draft.remoteDraftID != nil ? "Draft" : "On this iPhone", tone: TamiasTheme.muted)
                    Text(draft.customerName).font(.system(.largeTitle, design: .default))
                    Text(TamiasTheme.money(draft.amount, currency: draft.currency)).font(.system(.largeTitle, design: .rounded)).accessibilityIdentifier("draft.savedTotal")
                    InvoiceDraftSummary(draft: draft)
                    if let submissionError = draft.submissionError { Text(submissionError).font(.caption).foregroundStyle(TamiasTheme.amber) }
                    if draft.pendingSubmission != nil {
                        Text("The last attempt is unconfirmed. Retry to check its status.").font(.caption).foregroundStyle(TamiasTheme.amber)
                    }
                    if draft.submittedInvoiceID == nil {
                        if draft.pendingSubmission?.delivery != .draft {
                            Button { showReview = true } label: { Label(draft.pendingSubmission != nil ? "Review and retry" : "Review invoice", systemImage: "doc.text.magnifyingglass") }
                                .buttonStyle(PrimaryButtonStyle()).accessibilityIdentifier("draft.review")
                        }
                        Button {
                            isSyncing = true; error = nil
                            Task {
                                do { _ = try await store.syncInvoiceDraft(id: draftID) }
                                catch { self.error = error.localizedDescription }
                                isSyncing = false
                            }
                        } label: { Label(isSyncing ? "Uploading…" : draft.pendingSubmission?.delivery == .draft ? "Retry upload" : "Upload draft", systemImage: "icloud.and.arrow.up") }
                            .disabled(isSyncing || (draft.pendingSubmission != nil && draft.pendingSubmission?.delivery != .draft) || store.isDemo).accessibilityIdentifier("draft.sync")
                    } else if let issued = store.invoices.first(where: { $0.id == draft.submittedInvoiceID }) {
                        NavigationLink { InvoiceDetailView(invoice: issued) } label: { Label("View issued invoice", systemImage: "doc.text") }
                            .buttonStyle(PrimaryButtonStyle())
                    }
                    Button {
                        do { previewURL = try DraftPDFExporter.export(draft, workspaceName: store.teamName) }
                        catch { self.error = "The draft PDF couldn’t be prepared. Please try again." }
                    } label: { Label("Export draft PDF", systemImage: "square.and.arrow.up") }
                        .accessibilityIdentifier("draft.export")
                    if let error { Text(error).font(.caption).foregroundStyle(.red) }
                }.padding(24).frame(maxWidth: 680).frame(maxWidth: .infinity)
            } else {
                EmptyWorkspace(symbol: "doc.text", title: "Draft unavailable", message: "Return to your invoices to view this workspace’s drafts.")
            }
        }.background(TamiasTheme.paper).navigationTitle("Invoice draft").navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Edit") { isEditing = true }.disabled(draft == nil || draft?.submittedInvoiceID != nil || draft?.pendingSubmission != nil || isSyncing).accessibilityIdentifier("draft.edit")
            }
        }
        .sheet(isPresented: $isEditing) { if let draft { NewInvoiceView(store: store, editing: draft) } }
        .sheet(isPresented: $showReview) { InvoiceReviewFlowView(store: store, draftID: draftID) }
        .quickLookPreview($previewURL).accessibilityIdentifier("screen.draft")
    }
}

struct InvoiceDraftSummary: View {
    let draft: InvoiceDraft
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            VStack(spacing: 0) {
                DetailLine(title: "Issue date", value: draft.issueDate.formatted(date: .abbreviated, time: .omitted))
                DetailLine(title: "Due date", value: draft.dueDate.formatted(date: .abbreviated, time: .omitted))
                DetailLine(title: "Customer email", value: draft.customerEmail.isEmpty ? "Not added" : draft.customerEmail, divider: false)
            }.tamiasCard()
            VStack(alignment: .leading, spacing: 14) {
                ForEach(draft.lineItems) { item in
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 5) {
                            Text(item.name).font(.subheadline.weight(.medium))
                            Text("\(item.quantity.formatted()) × \(TamiasTheme.money(item.unitPrice, currency: draft.currency))").font(.caption).foregroundStyle(TamiasTheme.muted)
                        }
                        Spacer()
                        Text(TamiasTheme.money(item.quantity * item.unitPrice, currency: draft.currency)).font(.subheadline).monospacedDigit()
                    }
                }
                Divider()
                DetailLine(title: "Subtotal", value: TamiasTheme.money(draft.subtotal, currency: draft.currency))
                DetailLine(title: "VAT (\(draft.vatRate.formatted())%)", value: TamiasTheme.money(draft.vatAmount, currency: draft.currency))
                DetailLine(title: "Total", value: TamiasTheme.money(draft.amount, currency: draft.currency), divider: false)
            }.tamiasCard()
            if !draft.fromDetails.isEmpty { summaryText("From", value: draft.fromDetails) }
            if !draft.paymentDetails.isEmpty { summaryText("Payment details", value: draft.paymentDetails) }
            if !draft.note.isEmpty { summaryText("Note", value: draft.note) }
        }
    }
    private func summaryText(_ title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 9) { Eyebrow(text: title); Text(value).font(.subheadline) }.frame(maxWidth: .infinity, alignment: .leading).tamiasCard()
    }
}

struct InvoiceReviewFlowView: View {
    @Bindable var store: TamiasStore
    let draftID: UUID
    @Environment(\.dismiss) private var dismiss
    @State private var emailCustomer = false
    @State private var review: InvoiceSubmissionReview?
    @State private var error: String?
    @State private var isSubmitting = false
    @State private var completed = false
    private var draft: InvoiceDraft? { store.localDrafts.first { $0.id == draftID } }

    var body: some View {
        NavigationStack {
            ScrollView {
                if let draft {
                    VStack(alignment: .leading, spacing: 24) {
                        if completed {
                            Image(systemName: "checkmark.circle.fill").font(.system(size: 48)).foregroundStyle(TamiasTheme.green)
                            Text("Invoice issued").font(.system(.largeTitle, design: .default))
                            Text(emailCustomer ? "Email queued for delivery." : "Saved to your invoices.").foregroundStyle(TamiasTheme.muted)
                            Button("Done") { dismiss() }.buttonStyle(PrimaryButtonStyle())
                        } else {
                            Text(draft.customerName).font(.system(.largeTitle, design: .default))
                            Text(TamiasTheme.money(draft.amount, currency: draft.currency)).font(.system(.largeTitle, design: .rounded))
                            InvoiceDraftSummary(draft: draft)
                            Toggle("Email this invoice to the customer", isOn: $emailCustomer)
                                .disabled(isSubmitting || draft.pendingSubmission != nil).accessibilityIdentifier("invoice.emailCustomer")
                            if emailCustomer, let review, !review.billingEmails.isEmpty {
                                VStack(alignment: .leading, spacing: 6) {
                                    Eyebrow(text: "Billing copies")
                                    ForEach(review.billingEmails, id: \.self) { Text($0).font(.subheadline) }
                                }
                            }
                            Text(emailCustomer ? "Issuing will create an invoice and request email delivery to \(draft.customerEmail.isEmpty ? "the selected customer" : draft.customerEmail)." : "Issuing will create an unpaid invoice in \(store.teamName). The customer will not be emailed.")
                                .font(.caption).foregroundStyle(TamiasTheme.muted)
                            if let error { Text(error).font(.caption).foregroundStyle(.red) }
                            Button { submit() } label: {
                                HStack { Spacer(); if isSubmitting { ProgressView() }; Text(isSubmitting ? "Issuing…" : emailCustomer ? "Issue & email invoice" : "Issue invoice"); Spacer() }
                            }.buttonStyle(PrimaryButtonStyle()).disabled(isSubmitting || review == nil || store.isDemo)
                                .accessibilityIdentifier("invoice.issue")
                        }
                    }.padding(24).frame(maxWidth: 680).frame(maxWidth: .infinity)
                }
            }.background(TamiasTheme.paper)
            .navigationTitle("Review invoice").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() }.disabled(isSubmitting) } }
            .task {
                if let pending = draft?.pendingSubmission { emailCustomer = pending.delivery == .createAndSend }
                prepare()
            }
            .onChange(of: emailCustomer) { prepare() }
        }.interactiveDismissDisabled(isSubmitting).accessibilityIdentifier("screen.invoiceReview")
    }
    private func prepare() {
        error = nil; review = nil
        do { review = try store.prepareInvoiceSubmission(draftID: draftID, delivery: emailCustomer ? .createAndSend : .create) }
        catch { self.error = error.localizedDescription }
    }
    private func submit() {
        guard let review else { return }
        isSubmitting = true; error = nil
        Task {
            do {
                _ = try await store.submitInvoice(review)
                completed = true
                UINotificationFeedbackGenerator().notificationOccurred(.success)
            } catch { self.error = error.localizedDescription }
            isSubmitting = false
        }
    }
}

struct NewInvoiceView: View {
    @Bindable var store: TamiasStore
    private let editing: InvoiceDraft?
    @Environment(\.dismiss) private var dismiss
    @State private var fields: InvoiceDraftFields
    @State private var initialFields: InvoiceDraftFields
    @State private var draftID: UUID
    @State private var error: String?
    @State private var showDiscard = false
    @State private var showCustomers = false
    @State private var showReview = false
    private var hasChanges: Bool { fields != initialFields }
    private var valid: Bool { fields.isValid }

    init(store: TamiasStore, editing: InvoiceDraft? = nil) {
        self.store = store; self.editing = editing
        var fields = InvoiceDraftFields(draft: editing, workspaceCurrency: store.currency)
        if editing == nil { fields.fromDetails = store.teamName }
        _fields = State(initialValue: fields); _initialFields = State(initialValue: fields)
        _draftID = State(initialValue: editing?.id ?? UUID())
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    if fields.customerID != nil {
                        LabeledContent("Customer", value: fields.customer)
                        LabeledContent("Email", value: fields.email)
                        Button("Change customer") { showCustomers = true }
                    } else {
                        TextField("Customer name", text: $fields.customer).textContentType(.organizationName).accessibilityIdentifier("draft.customer")
                        TextField("Email (optional)", text: $fields.email).textContentType(.emailAddress).keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
                        Button("Choose customer") { showCustomers = true }.accessibilityIdentifier("draft.chooseCustomer")
                    }
                } header: { Text("Bill to") }
                ForEach(fields.items.indices, id: \.self) { index in
                    Section("Item \(index + 1)") {
                        TextField("Description", text: $fields.items[index].name, axis: .vertical).lineLimit(2...4)
                            .accessibilityIdentifier(index == 0 ? "draft.description" : "draft.description.\(index)")
                        HStack {
                            Text("Quantity"); Spacer()
                            TextField("1", text: $fields.items[index].quantity).keyboardType(.decimalPad).multilineTextAlignment(.trailing)
                                .accessibilityIdentifier("draft.quantity.\(index)")
                        }
                        HStack {
                            Text("Unit price"); Spacer()
                            TextField("0.00", text: $fields.items[index].unitPrice).keyboardType(.decimalPad).multilineTextAlignment(.trailing)
                                .accessibilityIdentifier(index == 0 ? "draft.amount" : "draft.amount.\(index)")
                        }
                        if fields.items.count > 1 { Button("Remove item", role: .destructive) { fields.items.remove(at: index) } }
                    }
                }
                Section { Button { fields.items.append(InvoiceLineFields()) } label: { Label("Add item", systemImage: "plus") }.accessibilityIdentifier("draft.addItem") }
                Section("Invoice details") {
                    Picker("Currency", selection: $fields.currency) { ForEach(TamiasCurrencies.choices(preferred: fields.currency), id: \.self) { Text($0).tag($0) } }
                    DatePicker("Issue date", selection: $fields.issueDate, displayedComponents: .date)
                    DatePicker("Due date", selection: $fields.dueDate, displayedComponents: .date)
                    HStack { Text("VAT %"); Spacer(); TextField("0", text: $fields.vatRate).keyboardType(.decimalPad).multilineTextAlignment(.trailing).accessibilityIdentifier("draft.vat") }
                    LabeledContent("Subtotal", value: TamiasTheme.money(fields.subtotal, currency: fields.currency))
                    LabeledContent("VAT", value: TamiasTheme.money(fields.vatAmount, currency: fields.currency))
                    LabeledContent("Total", value: TamiasTheme.money(fields.total, currency: fields.currency)).fontWeight(.semibold).accessibilityIdentifier("draft.total")
                }
                Section("From") { TextField("Your business and address", text: $fields.fromDetails, axis: .vertical).lineLimit(2...6) }
                Section("Payment details") { TextField("Bank, account name and payment reference", text: $fields.paymentDetails, axis: .vertical).lineLimit(2...6).accessibilityIdentifier("draft.payment") }
                Section("Note") { TextField("Optional details", text: $fields.note, axis: .vertical).lineLimit(2...4) }
                Section {
                    Button("Review invoice") { if save() { showReview = true } }.disabled(!valid).accessibilityIdentifier("draft.review")
                } footer: { Text("Saved on this iPhone until you upload or issue it.") }
                if !valid && fields.items.contains(where: { !$0.unitPrice.isEmpty }) {
                    Section { Text("Add a customer and item descriptions. Quantities and prices must be positive. \(fields.currency) prices allow \(InvoiceMoney.decimalPlaces(fields.currency)) decimal places, VAT must be between 0 and 100%, and the due date cannot precede the issue date.").font(.caption).foregroundStyle(TamiasTheme.amber) }
                }
                if let error { Section { Text(error).foregroundStyle(.red) } }
            }.scrollContentBackground(.hidden).background(TamiasTheme.paper)
            .navigationTitle(editing == nil ? "New invoice" : "Edit draft").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { if hasChanges { showDiscard = true } else { dismiss() } }.accessibilityIdentifier("draft.cancel") }
                ToolbarItem(placement: .confirmationAction) { Button(editing == nil ? "Save draft" : "Save changes") { if save() { dismiss() } }.disabled(!valid).accessibilityIdentifier("draft.save") }
            }
            .interactiveDismissDisabled(hasChanges)
            .confirmationDialog("Discard changes?", isPresented: $showDiscard, titleVisibility: .visible) {
                Button("Discard changes", role: .destructive) { dismiss() }
                Button("Keep editing", role: .cancel) {}
            } message: { Text("Your changes haven’t been saved.") }
            .sheet(isPresented: $showCustomers) {
                InvoiceCustomerPicker(store: store) { customer in
                    fields.customerID = customer.id; fields.customer = customer.name; fields.email = customer.email
                }
            }
            .sheet(isPresented: $showReview, onDismiss: {
                if store.localDrafts.first(where: { $0.id == draftID })?.submittedInvoiceID != nil { dismiss() }
            }) { InvoiceReviewFlowView(store: store, draftID: draftID) }
        }
    }

    private func save() -> Bool {
        guard valid else { return false }
        do {
            var draft = fields.makeDraft(id: draftID, createdAt: editing?.createdAt ?? .now)
            draft.remoteDraftID = editing?.remoteDraftID
            try store.saveDraft(draft)
            initialFields = fields
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            return true
        } catch { self.error = error.localizedDescription; return false }
    }
}

struct InvoiceCustomerPicker: View {
    @Bindable var store: TamiasStore
    let onSelect: (Customer) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var customers: [Customer] = []
    @State private var error: String?
    @State private var isLoading = false
    var body: some View {
        NavigationStack {
            List {
                if isLoading { ProgressView() }
                if let error { Text(error).font(.caption).foregroundStyle(.red) }
                ForEach(customers) { customer in
                    Button { onSelect(customer); dismiss() } label: {
                        VStack(alignment: .leading, spacing: 5) { Text(customer.name); Text(customer.email).font(.caption).foregroundStyle(TamiasTheme.muted) }
                    }
                }
                if customers.isEmpty && !isLoading { Text("No customers found").foregroundStyle(TamiasTheme.muted) }
            }.navigationTitle("Choose customer").navigationBarTitleDisplayMode(.inline)
            .searchable(text: $query, prompt: "Search customers")
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
            .task(id: query) {
                do { try await Task.sleep(for: .milliseconds(250)) } catch { return }
                isLoading = true; error = nil
                do { customers = try await store.searchCustomers(query: query) }
                catch { if !Task.isCancelled { self.error = error.localizedDescription } }
                isLoading = false
            }
        }
    }
}

enum TamiasCurrencies {
    static func choices(preferred: String) -> [String] {
        let common = ["GBP", "EUR", "USD", "CHF", "AUD", "CAD", "NZD", "JPY", "SEK", "NOK", "DKK", "ALL"]
        let preferred = preferred.uppercased()
        var result: [String] = []
        for code in [preferred] + common where Locale.commonISOCurrencyCodes.contains(code) && !result.contains(code) {
            result.append(code)
        }
        return result
    }
}

struct InvoiceLineFields: Identifiable, Equatable {
    var id = UUID()
    var name = ""
    var quantity = "1"
    var unitPrice = ""
    var item: InvoiceLineItem? { item(currency: "GBP") }
    func item(currency: String) -> InvoiceLineItem? {
        guard !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              let quantity = InvoiceDraftFields.number(quantity, maxDecimals: 4), quantity > 0,
              let price = InvoiceDraftFields.number(unitPrice, maxDecimals: InvoiceMoney.decimalPlaces(currency)), price > 0 else { return nil }
        return InvoiceLineItem(id: id, name: name.trimmingCharacters(in: .whitespacesAndNewlines), quantity: quantity, unitPrice: price)
    }
}

struct InvoiceDraftFields: Equatable {
    var customer: String
    var email: String
    var customerID: String?
    var items: [InvoiceLineFields]
    var description: String { get { items.first?.name ?? "" } set { items[0].name = newValue } }
    var amount: String { get { items.first?.unitPrice ?? "" } set { items[0].unitPrice = newValue } }
    var currency: String
    var issueDate: Date
    var dueDate: Date
    var vatRate: String
    var note: String
    var fromDetails: String
    var paymentDetails: String

    init(draft: InvoiceDraft?, workspaceCurrency: String) {
        customer = draft?.customerName ?? ""; email = draft?.customerEmail ?? ""; customerID = draft?.customerID
        items = draft?.lineItems.map {
            let price = String($0.unitPrice)
            return InvoiceLineFields(id: $0.id, name: $0.name, quantity: String($0.quantity), unitPrice: price.hasSuffix(".0") ? String(price.dropLast(2)) : price)
        } ?? [InvoiceLineFields()]
        if items.isEmpty { items = [InvoiceLineFields()] }
        currency = draft?.currency ?? TamiasCurrencies.choices(preferred: workspaceCurrency).first ?? "GBP"
        issueDate = draft?.issueDate ?? .now
        dueDate = draft?.dueDate ?? Calendar.current.date(byAdding: .day, value: 30, to: .now) ?? .now
        vatRate = String(draft?.vatRate ?? 0)
        note = draft?.note ?? ""; fromDetails = draft?.fromDetails ?? ""; paymentDetails = draft?.paymentDetails ?? ""
    }
    var parsedAmount: Double? { guard let value = Self.number(amount, maxDecimals: InvoiceMoney.decimalPlaces(currency)), value > 0 else { return nil }; return value }
    var parsedVAT: Double? { guard let value = Self.number(vatRate, maxDecimals: 2), (0...100).contains(value) else { return nil }; return value }
    private var lineItems: [InvoiceLineItem] { items.compactMap { $0.item(currency: currency) } }
    var subtotal: Double { InvoiceMoney.subtotal(lineItems, currency: currency) }
    var vatAmount: Double { InvoiceMoney.vat(lineItems: lineItems, rate: parsedVAT ?? 0, currency: currency) }
    var total: Double { InvoiceMoney.total(lineItems: lineItems, vatRate: parsedVAT ?? 0, currency: currency) }
    var isValid: Bool {
        !customer.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !items.isEmpty && lineItems.count == items.count &&
        parsedVAT != nil && total.isFinite && total > 0 && Calendar.current.startOfDay(for: dueDate) >= Calendar.current.startOfDay(for: issueDate)
    }
    func makeDraft(id: UUID, createdAt: Date) -> InvoiceDraft {
        InvoiceDraft(id: id, customerName: customer.trimmingCharacters(in: .whitespacesAndNewlines), customerEmail: email.trimmingCharacters(in: .whitespacesAndNewlines),
            description: items.map(\.name).joined(separator: " · "), amount: total, currency: currency, dueDate: dueDate, note: note, createdAt: createdAt,
            customerID: customerID, lineItems: lineItems, vatRate: parsedVAT ?? 0, paymentDetails: paymentDetails, fromDetails: fromDetails, issueDate: issueDate)
    }
    static func number(_ input: String, maxDecimals: Int) -> Double? {
        let normalized = input.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: ",", with: ".")
        let pattern = maxDecimals == 0 ? "^\\d+$" : "^\\d+(\\.\\d{1,\(maxDecimals)})?$"
        guard normalized.range(of: pattern, options: .regularExpression) != nil,
              let decimal = Decimal(string: normalized, locale: Locale(identifier: "en_US_POSIX")) else { return nil }
        guard let value = Double(NSDecimalNumber(decimal: decimal).stringValue) else { return nil }
        return value.isFinite ? value : nil
    }
}

/// Produces a reviewable local PDF. Exporting never creates or sends a workspace invoice.
enum DraftPDFExporter {
    static func export(_ draft: InvoiceDraft, workspaceName: String) throws -> URL {
        let text = NSMutableAttributedString(string: "")
        let ink = UIColor(red: 0.11, green: 0.13, blue: 0.12, alpha: 1)
        let muted = UIColor.darkGray
        let paragraph = NSMutableParagraphStyle()
        paragraph.lineSpacing = 4
        paragraph.paragraphSpacing = 13
        func append(_ value: String, size: CGFloat = 12, weight: UIFont.Weight = .regular, color: UIColor? = nil) {
            text.append(NSAttributedString(string: value + "\n", attributes: [
                .font: UIFont.systemFont(ofSize: size, weight: weight),
                .foregroundColor: color ?? ink,
                .paragraphStyle: paragraph
            ]))
        }
        append("PREPARED FOR", size: 10, weight: .semibold, color: muted)
        append(draft.customerName, size: 27, weight: .semibold)
        if !draft.customerEmail.isEmpty { append(draft.customerEmail, color: muted) }
        append("DRAFT TOTAL", size: 10, weight: .semibold, color: muted)
        append(TamiasTheme.money(draft.amount, currency: draft.currency), size: 35, weight: .medium)
        append("Due \(draft.dueDate.formatted(date: .long, time: .omitted))  |  \(draft.currency)", color: muted)
        append("For review only. This draft has not been issued or sent.", size: 11, weight: .medium)
        append("LINE ITEMS", size: 10, weight: .semibold, color: muted)
        for item in draft.lineItems {
            append(item.name, weight: .medium)
            append("\(item.quantity.formatted()) × \(TamiasTheme.money(item.unitPrice, currency: draft.currency))  =  \(TamiasTheme.money(item.quantity * item.unitPrice, currency: draft.currency))", color: muted)
        }
        append("Subtotal: \(TamiasTheme.money(draft.subtotal, currency: draft.currency))")
        append("VAT (\(draft.vatRate.formatted())%): \(TamiasTheme.money(draft.vatAmount, currency: draft.currency))")
        if !draft.fromDetails.isEmpty { append("FROM", size: 10, weight: .semibold, color: muted); append(draft.fromDetails) }
        if !draft.paymentDetails.isEmpty { append("PAYMENT DETAILS", size: 10, weight: .semibold, color: muted); append(draft.paymentDetails) }
        if !draft.note.isEmpty {
            append("NOTE", size: 10, weight: .semibold, color: muted)
            append(draft.note)
        }

        let page = CGRect(x: 0, y: 0, width: 595.28, height: 841.89)
        let format = UIGraphicsPDFRendererFormat()
        format.documentInfo = [kCGPDFContextTitle as String: "DRAFT - \(draft.customerName)",
                               kCGPDFContextCreator as String: "Tamias"]
        let framesetter = CTFramesetterCreateWithAttributedString(text)
        let renderer = UIGraphicsPDFRenderer(bounds: page, format: format)
        let data = renderer.pdfData { context in
            var offset = 0
            var pageNumber = 0
            repeat {
                context.beginPage()
                pageNumber += 1
                ("tamias" as NSString).draw(at: CGPoint(x: 44, y: 38), withAttributes: [
                    .font: UIFont.systemFont(ofSize: 23, weight: .semibold), .foregroundColor: ink
                ])
                ("DRAFT" as NSString).draw(at: CGPoint(x: 454, y: 38), withAttributes: [
                    .font: UIFont.systemFont(ofSize: 23, weight: .bold), .foregroundColor: muted
                ])
                (workspaceName as NSString).draw(in: CGRect(x: 44, y: 72, width: 390, height: 18), withAttributes: [
                    .font: UIFont.systemFont(ofSize: 11), .foregroundColor: muted,
                    .paragraphStyle: { let style = NSMutableParagraphStyle(); style.lineBreakMode = .byTruncatingTail; return style }()
                ])
                let graphics = context.cgContext
                graphics.setStrokeColor(UIColor.lightGray.cgColor)
                graphics.setLineWidth(0.5)
                graphics.move(to: CGPoint(x: 44, y: 105))
                graphics.addLine(to: CGPoint(x: page.width - 44, y: 105))
                graphics.strokePath()

                let body = CGRect(x: 44, y: 88, width: page.width - 88, height: page.height - 216)
                let frame = CTFramesetterCreateFrame(framesetter, CFRange(location: offset, length: 0), CGPath(rect: body, transform: nil), nil)
                graphics.saveGState()
                graphics.textMatrix = .identity
                graphics.translateBy(x: 0, y: page.height)
                graphics.scaleBy(x: 1, y: -1)
                CTFrameDraw(frame, graphics)
                graphics.restoreGState()
                let visible = CTFrameGetVisibleStringRange(frame)
                guard visible.length > 0 else { break }
                offset += visible.length
                ("DRAFT - NOT ISSUED - NOT SENT" as NSString).draw(at: CGPoint(x: 44, y: page.height - 49), withAttributes: [
                    .font: UIFont.systemFont(ofSize: 9, weight: .semibold), .foregroundColor: muted
                ])
                ("\(pageNumber)" as NSString).draw(at: CGPoint(x: page.width - 55, y: page.height - 49), withAttributes: [
                    .font: UIFont.systemFont(ofSize: 9), .foregroundColor: muted
                ])
            } while offset < text.length
        }
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("TamiasDraftExports", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true,
                                               attributes: [.protectionKey: FileProtectionType.complete])
        let url = directory.appendingPathComponent("DRAFT-\(draft.id.uuidString).pdf")
        try data.write(to: url, options: [.atomic, .completeFileProtection])
        return url
    }
}
