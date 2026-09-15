import { DOMParser } from "@xmldom/xmldom";
import {
  canonicalXmlText,
  GOVTALK_NAMESPACE,
  SelfAssessmentFilingError,
} from "../self-assessment-filing";

export type HmrcSaEnvironment = "test" | "production";
export type HmrcSaReceipt = {
  status: "acknowledged" | "accepted" | "rejected" | "unknown";
  correlationId: string | null;
  responseEndpoint: string | null;
  pollInterval: number;
  gatewayTimestamp: string | null;
  summary: string;
  errors: { number: string | null; text: string }[];
  irMarkMatched: boolean;
  rawXml: string;
};
export function parseHmrcSaReceipt(
  xml: string,
  expectedIrMark: string,
  expectedCorrelationId?: string,
): HmrcSaReceipt {
  if (xml.length > 1_000_000 || /<!DOCTYPE|<!ENTITY/i.test(xml))
    throw new SelfAssessmentFilingError("HMRC returned an invalid response.");
  let invalid = false;
  const document = new DOMParser({
    errorHandler: {
      warning() {
        invalid = true;
      },
      error() {
        invalid = true;
      },
      fatalError() {
        invalid = true;
      },
    },
  }).parseFromString(xml, "text/xml");
  if (
    invalid ||
    document.documentElement?.localName !== "GovTalkMessage" ||
    document.documentElement.namespaceURI !== GOVTALK_NAMESPACE
  )
    throw new SelfAssessmentFilingError("HMRC returned an invalid response.");
  const elements = (name: string, namespace = "*") =>
    Array.from(document.getElementsByTagNameNS(namespace, name));
  const text = (name: string, namespace = "*") =>
    elements(name, namespace)[0]?.textContent?.trim() || null;
  const qualifier = text("Qualifier", GOVTALK_NAMESPACE)?.toLowerCase();
  const className = text("Class", GOVTALK_NAMESPACE);
  const errors = elements("Error").map((e) => ({
    number: e.getElementsByTagNameNS("*", "Number")[0]?.textContent?.trim() ?? null,
    text:
      e.getElementsByTagNameNS("*", "Text")[0]?.textContent?.trim().slice(0, 1500) ??
      "HMRC rejected this return.",
  }));
  // ETS uses UndefinedClass when it rejects authentication before routing the
  // initial submission. A polling failure cannot reject an already sent return.
  const initialGatewayRejection =
    !expectedCorrelationId &&
    className === "UndefinedClass" &&
    qualifier === "error" &&
    errors.length > 0;
  if (className !== "HMRC-SA-SA100" && !initialGatewayRejection)
    throw new SelfAssessmentFilingError("HMRC returned a response for a different service.");
  const correlationId = text("CorrelationID", GOVTALK_NAMESPACE);
  if (correlationId && !/^[A-Fa-f0-9]{32}$/.test(correlationId))
    throw new SelfAssessmentFilingError("HMRC returned an invalid receipt reference.");
  if (expectedCorrelationId && correlationId !== expectedCorrelationId)
    throw new SelfAssessmentFilingError("The HMRC receipt does not match this submission.");
  const receipt = elements("IRmarkReceipt")[0];
  const irMarkMatched = Boolean(
    receipt &&
    Array.from(
      receipt.getElementsByTagNameNS("http://www.w3.org/2000/09/xmldsig#", "DigestValue"),
    ).some((e) => e.textContent?.trim() === expectedIrMark),
  );
  const status =
    errors.length || qualifier === "error"
      ? "rejected"
      : qualifier === "acknowledgement" && correlationId
        ? "acknowledged"
        : qualifier === "response" && receipt && irMarkMatched
          ? "accepted"
          : "unknown";
  const summary =
    status === "accepted"
      ? "HMRC accepted this return and its receipt matches the submitted IRmark."
      : status === "acknowledged"
        ? "HMRC received the submission. Acceptance is still pending."
        : status === "rejected"
          ? "HMRC rejected this submission. Review the returned errors."
          : "HMRC acceptance could not be verified. Check this submission before sending anything again.";
  return {
    status,
    correlationId,
    responseEndpoint: text("ResponseEndPoint", GOVTALK_NAMESPACE),
    pollInterval: Math.max(
      10,
      Math.min(
        3600,
        Number(elements("ResponseEndPoint", GOVTALK_NAMESPACE)[0]?.getAttribute("PollInterval")) ||
          10,
      ),
    ),
    gatewayTimestamp: text("GatewayTimestamp", GOVTALK_NAMESPACE),
    summary,
    errors,
    irMarkMatched,
    rawXml: xml,
  };
}

export function buildHmrcSaEnvelope(args: {
  bodyXml: string;
  utr: string;
  senderId: string;
  password: string;
  vendorId: string;
  environment: HmrcSaEnvironment;
}) {
  const escape = canonicalXmlText;
  return `<?xml version="1.0" encoding="UTF-8"?><GovTalkMessage xmlns="${GOVTALK_NAMESPACE}"><EnvelopeVersion>2.0</EnvelopeVersion><Header><MessageDetails><Class>HMRC-SA-SA100</Class><Qualifier>request</Qualifier><Function>submit</Function><CorrelationID></CorrelationID><Transformation>XML</Transformation><GatewayTest>${args.environment === "test" ? 1 : 0}</GatewayTest></MessageDetails><SenderDetails><IDAuthentication><SenderID>${escape(args.senderId)}</SenderID><Authentication><Method>clear</Method><Role>Principal</Role><Value>${escape(args.password)}</Value></Authentication></IDAuthentication></SenderDetails></Header><GovTalkDetails><Keys><Key Type="UTR">${escape(args.utr)}</Key></Keys><TargetDetails><Organisation>HMRC</Organisation></TargetDetails><ChannelRouting><Channel><URI>${escape(args.vendorId)}</URI><Product>Tamias</Product><Version>1.2.0</Version></Channel></ChannelRouting></GovTalkDetails>${args.bodyXml}</GovTalkMessage>`;
}

export class HmrcSelfAssessmentProvider {
  readonly baseURL: string;
  constructor(
    readonly environment: HmrcSaEnvironment,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    this.baseURL =
      environment === "production"
        ? "https://transaction-engine.tax.service.gov.uk"
        : "https://test-transaction-engine.tax.service.gov.uk";
  }
  private endpoint(candidate?: string | null, receiptAcknowledgement = false) {
    const url = new URL(
      candidate || `${this.baseURL}/${receiptAcknowledgement ? "submission" : "poll"}`,
    );
    // The business response supplies /submission for DELETE_REQUEST; polling uses /poll.
    const allowedPath =
      url.pathname === "/poll" || (receiptAcknowledgement && url.pathname === "/submission");
    if (url.origin !== this.baseURL || !allowedPath || url.username || url.password || url.hash) {
      throw new SelfAssessmentFilingError(
        "The HMRC response endpoint was not recognised. The submission needs review.",
      );
    }
    return url.href;
  }
  private async post(url: string, xml: string) {
    const response = await this.fetcher(url, {
      method: "POST",
      body: xml,
      redirect: "error",
      signal: AbortSignal.timeout(30000),
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        Accept: "text/xml",
        "User-Agent": "Tamias/1.2.0",
      },
    });
    if (!response.body) throw new SelfAssessmentFilingError("HMRC returned no receipt.");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 1_000_000) {
          await reader.cancel();
          throw new SelfAssessmentFilingError("HMRC returned an oversized response.");
        }
        chunks.push(chunk.value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    // HTTP errors may still contain a structured GovTalk rejection; the strict parser decides.
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  }
  async submit(xml: string, irMark: string) {
    return parseHmrcSaReceipt(await this.post(`${this.baseURL}/submission`, xml), irMark);
  }
  async poll(args: { correlationId: string; irMark: string; responseEndpoint?: string | null }) {
    const xml = this.controlMessage("poll", "submit", args.correlationId);
    return parseHmrcSaReceipt(
      await this.post(this.endpoint(args.responseEndpoint), xml),
      args.irMark,
      args.correlationId,
    );
  }
  async acknowledgeReceipt(args: { correlationId: string; responseEndpoint?: string | null }) {
    const xml = await this.post(
      this.endpoint(args.responseEndpoint, true),
      this.controlMessage("request", "delete", args.correlationId),
    );
    // Only cleanup transport state after the caller has durably saved the business receipt.
    if (
      !xml.includes("<Function>delete</Function>") ||
      !xml.includes("<Qualifier>response</Qualifier>")
    ) {
      throw new SelfAssessmentFilingError(
        "HMRC receipt was saved, but transport acknowledgement is pending.",
      );
    }
  }
  private controlMessage(qualifier: string, fn: string, correlationId: string) {
    if (!/^[A-Fa-f0-9]{32}$/.test(correlationId))
      throw new SelfAssessmentFilingError("Invalid HMRC submission reference.");
    return `<?xml version="1.0" encoding="UTF-8"?><GovTalkMessage xmlns="${GOVTALK_NAMESPACE}"><EnvelopeVersion>2.0</EnvelopeVersion><Header><MessageDetails><Class>HMRC-SA-SA100</Class><Qualifier>${qualifier}</Qualifier><Function>${fn}</Function><CorrelationID>${correlationId}</CorrelationID><Transformation>XML</Transformation></MessageDetails></Header><GovTalkDetails><Keys></Keys></GovTalkDetails></GovTalkMessage>`;
  }
}
