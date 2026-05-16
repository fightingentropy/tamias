export function renderCt600ReturnInfoSummaryXml(args: {
  encodedAccountsAttachment?: string;
  encodedComputationsAttachment?: string;
  hasCt600aSupplement: boolean;
}) {
  const supplementaryPagesXml = args.hasCt600aSupplement
    ? "<SupplementaryPages><CT600A>yes</CT600A></SupplementaryPages>"
    : "";

  return `<ReturnInfoSummary><Accounts>${
    args.encodedAccountsAttachment
      ? "<ThisPeriodAccounts>yes</ThisPeriodAccounts>"
      : "<NoAccountsReason>NO_ACCOUNTS_ATTACHMENT_GENERATED</NoAccountsReason>"
  }</Accounts><Computations>${
    args.encodedComputationsAttachment
      ? "<ThisPeriodComputations>yes</ThisPeriodComputations>"
      : "<NoComputationsReason>NO_COMPUTATION_ATTACHMENT_GENERATED</NoComputationsReason>"
  }</Computations>${supplementaryPagesXml}</ReturnInfoSummary>`;
}

export function renderCt600AttachedFilesXml(args: {
  encodedAccountsAttachment?: string;
  encodedComputationsAttachment?: string;
}) {
  if (args.encodedComputationsAttachment) {
    return `<XBRLsubmission><Computation><Instance><EncodedInlineXBRLDocument>${args.encodedComputationsAttachment}</EncodedInlineXBRLDocument></Instance></Computation>${
      args.encodedAccountsAttachment
        ? `<Accounts><Instance><EncodedInlineXBRLDocument>${args.encodedAccountsAttachment}</EncodedInlineXBRLDocument></Instance></Accounts>`
        : ""
    }</XBRLsubmission>`;
  }

  return args.encodedAccountsAttachment
    ? `<XBRLsubmission><Accounts><Instance><EncodedInlineXBRLDocument>${args.encodedAccountsAttachment}</EncodedInlineXBRLDocument></Instance></Accounts></XBRLsubmission>`
    : "";
}
