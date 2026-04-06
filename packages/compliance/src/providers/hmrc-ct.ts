import {
  type HmrcCtEnvironment,
  type HmrcCtGatewayError,
  type HmrcCtProviderConfig,
  HmrcCtProviderConfigSchema,
  type HmrcCtTransactionEngineMessage,
} from "../types";

type HmrcCtCredentials = {
  senderId: string;
  senderPassword: string;
  vendorId: string;
  productName: string;
  productVersion: string;
};

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function readXmlTagValue(xml: string, tagName: string) {
  const match = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)</${tagName}>`, "i").exec(xml);

  return match?.[1]?.trim() ?? null;
}

function readXmlTagValues(xml: string, tagName: string) {
  return [...xml.matchAll(new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)</${tagName}>`, "gi"))]
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value));
}

function readXmlElementAttribute(xml: string, tagName: string, attributeName: string) {
  const match = new RegExp(`<${tagName}\\b[^>]*\\b${attributeName}="([^"]*)"[^>]*>`, "i").exec(xml);

  return match?.[1] ?? null;
}

function stripXmlMarkup(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseHmrcCtErrors(xml: string): HmrcCtGatewayError[] {
  return [...xml.matchAll(/<Error\b[^>]*>([\s\S]*?)<\/Error>/gi)].map((match) => {
    const errorXml = match[1] ?? "";
    return {
      raisedBy: readXmlTagValue(errorXml, "RaisedBy"),
      number: readXmlTagValue(errorXml, "Number"),
      type: readXmlTagValue(errorXml, "Type"),
      text: readXmlTagValue(errorXml, "Text"),
      location: readXmlTagValue(errorXml, "Location"),
    };
  });
}

function buildHmrcCtSummary(args: {
  qualifier: string | null;
  bodyStatus: string | null;
  bodyStatusText: string | null;
  responseType: string | null;
  errors: HmrcCtGatewayError[];
  notices: string[];
}) {
  if (args.errors.length > 0) {
    return (
      args.errors.find((error) => error.text)?.text ??
      args.bodyStatusText ??
      args.bodyStatus ??
      "HMRC returned one or more errors."
    );
  }

  return (
    args.bodyStatusText ??
    args.bodyStatus ??
    args.responseType ??
    args.notices[0] ??
    (args.qualifier === "acknowledgement"
      ? "Submission acknowledged by HMRC."
      : args.qualifier === "response"
        ? "HMRC returned a response."
        : args.qualifier === "error"
          ? "HMRC returned an error."
          : null)
  );
}

export function parseHmrcCtTransactionEngineMessage(xml: string): HmrcCtTransactionEngineMessage {
  const qualifier = readXmlTagValue(xml, "Qualifier");
  const bodyXml = readXmlTagValue(xml, "Body");
  const errors = parseHmrcCtErrors(xml);
  const bodyStatus =
    (bodyXml ? readXmlTagValue(bodyXml, "Status") : null) ?? readXmlTagValue(xml, "Status");
  const bodyStatusText =
    (bodyXml ? readXmlTagValue(bodyXml, "StatusText") : null) ??
    (bodyXml ? readXmlTagValue(bodyXml, "Text") : null) ??
    (bodyXml ? readXmlTagValue(bodyXml, "Reason") : null) ??
    readXmlTagValue(xml, "StatusText") ??
    readXmlTagValue(xml, "Reason");
  const responseType =
    (bodyXml ? readXmlTagValue(bodyXml, "ResponseType") : null) ??
    readXmlTagValue(xml, "ResponseType");
  const normalizedBodyStatus = bodyStatus?.trim().toLowerCase() ?? null;
  const normalizedResponseType = responseType?.trim().toLowerCase() ?? null;
  const notices = [
    ...new Set(
      (bodyXml
        ? [...readXmlTagValues(bodyXml, "Message"), ...readXmlTagValues(bodyXml, "Text")]
        : readXmlTagValues(xml, "Message")
      )
        .map((value) => stripXmlMarkup(value))
        .filter(Boolean),
    ),
  ];
  const status =
    errors.length > 0 ||
    qualifier === "error" ||
    normalizedBodyStatus === "rejected" ||
    normalizedBodyStatus === "failed"
      ? "rejected"
      : qualifier === "response" &&
          (normalizedBodyStatus === "accepted" || normalizedResponseType === "success")
        ? "accepted"
        : qualifier === "response"
          ? "submitted"
          : "submitted";

  return {
    qualifier,
    function: readXmlTagValue(xml, "Function"),
    correlationId: readXmlTagValue(xml, "CorrelationID"),
    transactionId: readXmlTagValue(xml, "TransactionID"),
    responseEndpoint: readXmlTagValue(xml, "ResponseEndPoint"),
    pollInterval:
      Number.parseInt(readXmlElementAttribute(xml, "ResponseEndPoint", "PollInterval") ?? "", 10) ||
      null,
    gatewayTimestamp: readXmlTagValue(xml, "GatewayTimestamp"),
    bodyXml,
    bodyStatus,
    bodyStatusText,
    responseType,
    formBundleNumber:
      (bodyXml ? readXmlTagValue(bodyXml, "FormBundleNumber") : null) ??
      readXmlTagValue(xml, "FormBundleNumber"),
    status,
    summary: buildHmrcCtSummary({
      qualifier,
      bodyStatus,
      bodyStatusText,
      responseType,
      errors,
      notices,
    }),
    errors,
    notices,
    rawXml: xml,
  };
}

export function buildHmrcCtSubmissionPollXml(args: { correlationId: string; className?: string }) {
  const className = args.className ?? "HMRC-CT-CT600";

  return `<?xml version="1.0" encoding="UTF-8"?>
<GovTalkMessage xmlns="http://www.govtalk.gov.uk/CM/envelope">
  <EnvelopeVersion>2.0</EnvelopeVersion>
  <Header>
    <MessageDetails>
      <Class>${escapeXml(className)}</Class>
      <Qualifier>poll</Qualifier>
      <Function>submit</Function>
      <CorrelationID>${escapeXml(args.correlationId)}</CorrelationID>
      <Transformation>XML</Transformation>
    </MessageDetails>
  </Header>
  <GovTalkDetails>
    <Keys/>
  </GovTalkDetails>
</GovTalkMessage>`;
}

export class HmrcCtProvider {
  readonly id = "hmrc-ct" as const;
  readonly name = "HMRC Corporation Tax";

  constructor(
    private readonly credentials: HmrcCtCredentials,
    private readonly config?: { environment?: HmrcCtEnvironment },
  ) {}

  static fromEnvironment() {
    const senderId = process.env.HMRC_CT_SENDER_ID;
    const senderPassword = process.env.HMRC_CT_SENDER_PASSWORD;
    const vendorId = process.env.HMRC_CT_VENDOR_ID;

    if (!senderId || !senderPassword || !vendorId) {
      throw new Error("HMRC CT submission configuration missing");
    }

    return new HmrcCtProvider(
      {
        senderId,
        senderPassword,
        vendorId,
        productName: process.env.HMRC_CT_PRODUCT_NAME ?? "Tamias",
        productVersion: process.env.HMRC_CT_PRODUCT_VERSION ?? "0.1.0",
      },
      {
        environment: process.env.HMRC_CT_ENVIRONMENT === "production" ? "production" : "test",
      },
    );
  }

  static fromConfig(config: HmrcCtProviderConfig) {
    const parsedConfig = HmrcCtProviderConfigSchema.parse(config);

    return new HmrcCtProvider(
      {
        senderId: parsedConfig.senderId,
        senderPassword: parsedConfig.senderPassword,
        vendorId: parsedConfig.vendorId,
        productName: parsedConfig.productName,
        productVersion: parsedConfig.productVersion,
      },
      {
        environment: parsedConfig.environment,
      },
    );
  }

  get environment() {
    return this.config?.environment ?? "test";
  }

  get baseUrl() {
    return this.environment === "production"
      ? "https://transaction-engine.tax.service.gov.uk/submission"
      : "https://test-transaction-engine.tax.service.gov.uk/submission";
  }

  toConfig(): HmrcCtProviderConfig {
    return HmrcCtProviderConfigSchema.parse({
      provider: "hmrc-ct",
      environment: this.environment,
      senderId: this.credentials.senderId,
      senderPassword: this.credentials.senderPassword,
      vendorId: this.credentials.vendorId,
      productName: this.credentials.productName,
      productVersion: this.credentials.productVersion,
    });
  }

  async submitSubmissionXml(xml: string) {
    return this.postXml(this.baseUrl, xml);
  }

  async pollSubmission(args: {
    correlationId: string;
    responseEndpoint?: string | null;
    className?: string;
  }) {
    return this.postXml(
      args.responseEndpoint || this.baseUrl,
      buildHmrcCtSubmissionPollXml({
        correlationId: args.correlationId,
        className: args.className,
      }),
    );
  }

  private async postXml(url: string, xml: string) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/xml, text/xml;q=0.9, */*;q=0.8",
        "Content-Type": "text/xml; charset=utf-8",
      },
      body: xml,
    });
    const text = await response.text();

    if (!response.ok) {
      throw new Error(`HMRC CT request failed (${response.status}): ${text}`);
    }

    return parseHmrcCtTransactionEngineMessage(text);
  }
}
