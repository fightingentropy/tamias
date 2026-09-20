import { LegalPage, legalOperator } from "./legal-page";

export function SupportPage() {
  return (
    <LegalPage
      title="How can we help?"
      intro="Get help with your account, records, subscription or a connected service."
    >
      <section>
        <h2>Contact support</h2>
        <p>
          Email <a href={`mailto:${legalOperator.email}`}>{legalOperator.email}</a>. Include the
          page you were using, what happened and the approximate time. Redact bank details and tax
          identifiers from screenshots. We will investigate and reply by email.
        </p>
      </section>
      <section>
        <h2>Security issues</h2>
        <p>
          Report suspected vulnerabilities or unauthorised access to{" "}
          <a href="mailto:security@tamias.xyz">security@tamias.xyz</a>. Give enough detail to
          reproduce the issue without including other people’s records or secrets. Do not test
          against other users or disrupt the live service. We aim to acknowledge security reports
          within three business days.
        </p>
      </section>
      <section>
        <h2>Privacy, exports and account closure</h2>
        <p>
          Contact support to request a copy of your information, correct records or close your
          account. We may verify your identity. Read our <a href="/privacy">privacy policy</a> for
          details.
        </p>
      </section>
      <section>
        <h2>Accessibility</h2>
        <p>
          If a screen or interaction prevents you using Tamias, tell us the page, your browser and
          any assistive technology you use. We will work with you to provide an accessible way to
          complete the task.
        </p>
      </section>
      <section>
        <h2>Postal contact</h2>
        <p>
          {legalOperator.name}
          <br />
          {legalOperator.address}
        </p>
      </section>
    </LegalPage>
  );
}
