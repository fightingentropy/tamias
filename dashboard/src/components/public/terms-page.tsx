import { LegalPage, legalOperator } from "./legal-page";

export function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      intro="The terms for using Tamias to organise records, analyse finances and use connected services."
    >
      <section>
        <h2>Your agreement with Tamias</h2>
        <p>
          Tamias is operated by {legalOperator.name}, {legalOperator.address}. Contact{" "}
          <a href={`mailto:${legalOperator.email}`}>{legalOperator.email}</a>. By creating an
          account or subscribing, you agree to these terms. If you act for an organisation, you must
          have authority to agree on its behalf.
        </p>
      </section>
      <section>
        <h2>Your account and records</h2>
        <p>
          Provide accurate account details, protect your credentials and only give access to
          authorised people. You are responsible for the content you upload and for having
          permission to use information about others. You retain ownership of your records and
          permit us to store and process them to provide Tamias.
        </p>
        <p>
          Do not use Tamias for unlawful activity, access another person’s records without
          permission, bypass access controls, interfere with the service or upload malicious
          material. Report suspected unauthorised access promptly through support.
        </p>
      </section>
      <section>
        <h2>Subscriptions and cancellation</h2>
        <p>
          The checkout shows the price, currency, applicable taxes, billing interval and any trial
          terms before you pay. Subscriptions renew at that interval until cancelled. Cancel through
          your billing settings where available, or contact support before renewal. Cancellation
          stops future renewals; access continues for the period already paid unless you request
          account closure.
        </p>
        <p>
          We will tell you about material price changes before they apply to a renewal so you can
          cancel. Contact support about billing errors or refund requests. Nothing in these terms
          removes refund, cancellation or other rights you have under applicable law.
        </p>
      </section>
      <section>
        <h2>Reports, tax preparation and filing</h2>
        <p>
          Tamias provides software, not a substitute for your accountant or tax adviser. Check
          imported records, categories, calculations, AI suggestions and draft returns. You remain
          responsible for the accuracy and completeness of your return, deadlines and payments.
        </p>
        <p>
          Filing availability depends on the tax year, supported return type, your eligibility and
          the relevant authority connection. A draft or a successful test is not a filed return. A
          return is submitted only when you authorise the live submission and the authority receives
          it; check its acknowledgement and status. Tamias does not claim HMRC recognition, approval
          or accreditation.
        </p>
      </section>
      <section>
        <h2>Connections and service availability</h2>
        <p>
          You choose which third-party connections to authorise and may revoke them. Their terms and
          availability also apply. We cannot guarantee uninterrupted access or the continued
          availability of an external API. We may maintain, improve or change features, and will
          give reasonable notice of material changes where practicable.
        </p>
        <p>
          Keep independent copies of important records. Contact support if a fault affects access,
          reports or a submission. Do not repeatedly submit a return with an uncertain outcome;
          first check the authority’s acknowledgement.
        </p>
      </section>
      <section>
        <h2>Privacy and confidentiality</h2>
        <p>
          Our <a href="/privacy">privacy policy</a> explains how we use information. We use your
          records to provide and secure the service and handle support requests, with access limited
          to what is needed for those purposes. Do not send passwords, payment-card details or full
          tax credentials in support messages.
        </p>
      </section>
      <section>
        <h2>Ending access</h2>
        <p>
          You may close your account by contacting support. Export the records you need before
          closure. We may restrict or suspend access where reasonably necessary to address a
          security incident, unlawful use, serious breach of these terms or unpaid fees. Where
          practicable, we will explain the reason and give you an opportunity to resolve it.
          Deletion and any necessary retention are handled as described in our privacy policy.
        </p>
      </section>
      <section>
        <h2>Responsibility for loss</h2>
        <p>
          We will provide the service with reasonable care and skill. We are responsible for losses
          caused by our breach of these terms that were reasonably foreseeable. We do not exclude
          liability for fraud, death or personal injury caused by negligence, or any liability that
          cannot lawfully be limited. You must take reasonable steps to avoid unnecessary loss,
          including checking outputs and keeping copies of important records.
        </p>
      </section>
      <section>
        <h2>Changes, complaints and governing law</h2>
        <p>
          We will give notice of material changes to these terms before they take effect where
          practicable. You can stop using Tamias and cancel renewal if you do not accept the
          changes. Contact support first about a complaint so we can investigate.
        </p>
        <p>
          These terms are governed by the law of England and Wales. Courts of England and Wales have
          jurisdiction, subject to any mandatory rights you have to bring proceedings elsewhere.
          Your statutory rights are unaffected.
        </p>
      </section>
    </LegalPage>
  );
}
