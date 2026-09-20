import { LegalPage, legalOperator } from "./legal-page";

export function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      intro="How Tamias uses your information when you organise your finances, connect services and prepare tax records."
    >
      <section>
        <h2>Who is responsible</h2>
        <p>
          {legalOperator.name} operates Tamias and is the controller of account, billing, support
          and service-security information. Contact{" "}
          <a href={`mailto:${legalOperator.email}`}>{legalOperator.email}</a> or write to{" "}
          {legalOperator.address}. When you upload records about your customers or workers, you
          remain responsible for your lawful use of those records; Tamias processes them to provide
          the service you request.
        </p>
      </section>
      <section>
        <h2>Information we use</h2>
        <ul>
          <li>
            Account and workspace details, including your name, email, business details, preferences
            and workspace membership.
          </li>
          <li>
            Records you enter or upload: bank statements and transactions, receipts, invoices,
            documents, customers, time entries and tax information. These records can include names,
            addresses, account identifiers, tax references and payment details.
          </li>
          <li>
            Data from services you connect, limited by the permissions you grant. This can include
            bank transactions, selected email and attachments, accounting records and HMRC
            responses. We store connection tokens so the connection can work.
          </li>
          <li>
            Subscription status, payment references, support messages and technical information such
            as IP addresses, device information, request times and error logs. Payment providers
            handle payment-card details.
          </li>
        </ul>
        <p>
          Information comes from you, members of your workspace and the services you authorise.
          Providing account details is necessary to create an account; optional connections and
          uploads are your choice. Without required information, the corresponding feature cannot
          operate.
        </p>
      </section>
      <section>
        <h2>Why we use it</h2>
        <p>
          We use information to deliver the service you request: storing records, producing reports,
          processing documents, managing your subscription, answering support requests and carrying
          out actions you authorise. Our lawful basis is performance of our contract with you, or
          our legitimate interest in providing the service to your organisation where you are its
          user.
        </p>
        <p>
          We also have legitimate interests in preventing fraud and abuse, securing accounts,
          diagnosing faults and improving reliability. We use information to meet legal obligations
          where those apply, including maintaining our own financial records. Where processing
          depends on consent, you can withdraw that consent by disconnecting the relevant service or
          contacting us; this does not affect earlier lawful processing.
        </p>
      </section>
      <section>
        <h2>Connected services and AI</h2>
        <p>
          Service providers receive information needed for the functions they supply. Cloudflare
          hosts Tamias and its database and file storage. Payment and email-delivery providers
          process billing and service communications. Banks, email services, accounting providers
          and tax authorities receive information when you use their connections.
        </p>
        <p>
          Document extraction and AI features send relevant document contents, prompts and financial
          context to the model provider used for that feature. The software supports OpenAI, Google
          and Mistral, and optional alternative model providers. Review sensitive material before
          uploading it and contact us if you need to confirm the provider used for a feature.
          Suggestions and extracted data can be incorrect; review them before relying on them.
          Tamias does not use these suggestions to make decisions with legal or similarly
          significant effects on you without your involvement.
        </p>
        <p>
          We do not sell your personal information or share it with other companies for their
          marketing. Workspace members you authorise can access information according to their
          permissions. We may disclose information when lawfully required, to protect the service,
          or to advisers subject to confidentiality.
        </p>
      </section>
      <section>
        <h2>HMRC fraud-prevention information</h2>
        <p>
          When you use an HMRC Making Tax Digital connection, we collect device and connection
          information for HMRC fraud prevention. This includes a persistent device identifier,
          browser details, screen and window dimensions, timezone, your Tamias identifiers, your
          public IP address and collection time, and available network and authentication
          information. We send it to HMRC with the relevant API requests. The device identifier is
          stored in your browser and is regenerated if you delete it.
        </p>
        <p>
          Read{" "}
          <a href="https://www.gov.uk/government/publications/anti-fraud-measures-in-hmrc-apis">
            HMRC’s guidance on anti-fraud measures
          </a>
          . HMRC controls its use of information it receives. Authorising a connection takes place
          on HMRC’s site; do not send your Government Gateway password to Tamias support.
        </p>
      </section>
      <section>
        <h2>Storage and international processing</h2>
        <p>
          Tamias uses cloud infrastructure and providers that may process information in the UK, the
          EEA and other countries. A connection can also send information to the provider you
          choose. International processing must have an applicable UK adequacy basis or appropriate
          contractual safeguards. Contact us for the locations and safeguards applicable to your use
          of Tamias, including copies or details of the relevant arrangements.
        </p>
      </section>
      <section>
        <h2>How long we keep information</h2>
        <p>
          We keep account and workspace records while needed to provide your account and the
          features you use. Retention depends on whether your account is active, whether the
          information is needed for an authorised connection, a legal obligation or a dispute, and
          the time needed to remove copies from operational systems and backups. Disconnecting a
          provider stops that connection but does not automatically delete records already imported.
        </p>
        <p>
          You can export your records and request account or record deletion through support. We
          explain any legal reason for retaining particular records and any backup limitations when
          handling your request. Keep your own copies of records you need for tax or other legal
          purposes.
        </p>
      </section>
      <section>
        <h2>Your rights, including objection</h2>
        <p>
          You can ask for access, correction, deletion, restriction of processing or a portable copy
          of your information, subject to the conditions in data-protection law.
        </p>
        <p>
          <strong>
            You have the right to object to processing based on legitimate interests, and to direct
            marketing.
          </strong>{" "}
          Contact <a href={`mailto:${legalOperator.email}`}>{legalOperator.email}</a>. We may need
          to verify your identity before releasing or changing records. You can complain to the{" "}
          <a href="https://ico.org.uk/make-a-complaint/">Information Commissioner’s Office</a>.
        </p>
      </section>
      <section>
        <h2>Cookies and browser storage</h2>
        <p>
          Tamias uses authentication cookies and browser storage for sign-in, security, workspace
          state and preferences. HMRC-connected features also use the device identifier described
          above. Blocking or clearing this storage may sign you out or reset preferences. The
          service does not use advertising cookies.
        </p>
      </section>
      <section>
        <h2>Changes and contact</h2>
        <p>
          We update this page when our processing changes and bring material changes to your
          attention where required. For privacy questions, contact{" "}
          <a href={`mailto:${legalOperator.email}`}>{legalOperator.email}</a>.
        </p>
      </section>
    </LegalPage>
  );
}
