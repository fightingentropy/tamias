# Security and personal-data incident procedure

Owner: Erlin Hoxha. Effective 20 September 2026. Reports: security@tamias.xyz; customer contact: support@tamias.xyz.

1. **Receive and triage.** Record discovery time, reporter, affected services, affected accounts and known impact in a restricted incident record. Acknowledge a security report within three business days; investigate suspected active compromise immediately. Do not request passwords or full tax identifiers in email.
2. **Contain.** Preserve relevant access/audit evidence, revoke affected sessions and provider tokens, disable the compromised integration or isolate the affected feature, and restrict access to the incident team. Avoid destroying evidence. Use the provider's normal secret-rotation and deployment rollback procedures.
3. **Assess personal data.** Identify what was accessed, disclosed, changed or unavailable, the affected people, likely consequences, safeguards already applied and what remains uncertain. Assess legal notification obligations; document the decision and rationale even if notification is not required.
4. **Notify.** For incidents involving HMRC-connected personal data, notify HMRC's Software Developer Support without undue delay and follow the applicable API terms, including the 72-hour requirement. Assess whether ICO notification is required under UK GDPR; where required, report within 72 hours of becoming aware and provide updates as information becomes available. Notify affected people without undue delay if the applicable high-risk threshold is met. Communications must state known facts and useful protective steps, without exposing other users' information.
5. **Recover and verify.** Apply and review the fix, restore from a verified backup if needed, retest the affected control and check provider acknowledgements before re-enabling filings. Never retry an uncertain filing without reconciling its status.
6. **Review.** Record the cause, scope, timeline, notifications, recovery checks and assigned preventive changes. Rehearse this procedure and a restore with synthetic data; retain evidence of the rehearsal.

This is an operating procedure, not evidence that a real incident or a restore rehearsal has occurred. Provider contract, processing-location, access-review and backup-restore evidence must be maintained separately.

References: [HMRC API terms](https://developer.service.hmrc.gov.uk/api-documentation/docs/terms-of-use), [ICO personal data breaches](https://ico.org.uk/for-organisations/report-a-breach/personal-data-breach/).
