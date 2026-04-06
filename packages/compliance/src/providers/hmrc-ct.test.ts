import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
  buildHmrcCtSubmissionPollXml,
  HmrcCtProvider,
  parseHmrcCtTransactionEngineMessage,
} from "./hmrc-ct";

function createProvider() {
  return HmrcCtProvider.fromConfig({
    provider: "hmrc-ct",
    environment: "test",
    senderId: "sds-user",
    senderPassword: "sds-password",
    vendorId: "1234",
    productName: "Tamias",
    productVersion: "0.1.0",
  });
}

const originalFetch = globalThis.fetch;
let mockFetchFn: ReturnType<typeof mock>;

beforeEach(() => {
  mockFetchFn = mock(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      text: () =>
        Promise.resolve(`<?xml version="1.0" encoding="UTF-8"?>
<GovTalkMessage xmlns="http://www.govtalk.gov.uk/CM/envelope">
  <EnvelopeVersion>2.0</EnvelopeVersion>
  <Header>
    <MessageDetails>
      <Class>HMRC-CT-CT600</Class>
      <Qualifier>acknowledgement</Qualifier>
      <Function>submit</Function>
      <CorrelationID>ABC123</CorrelationID>
      <ResponseEndPoint PollInterval="15"></ResponseEndPoint>
      <GatewayTimestamp>2026-03-22T12:00:00.000</GatewayTimestamp>
    </MessageDetails>
  </Header>
  <GovTalkDetails>
    <Keys/>
  </GovTalkDetails>
  <Body/>
</GovTalkMessage>`),
    }),
  );
  globalThis.fetch = mockFetchFn as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("HmrcCtProvider", () => {
  test("submits XML to the HMRC CT transaction-engine test endpoint", async () => {
    const provider = createProvider();
    const response = await provider.submitSubmissionXml(
      '<?xml version="1.0" encoding="UTF-8"?><GovTalkMessage/>',
    );

    expect(response.qualifier).toBe("acknowledgement");
    expect(response.correlationId).toBe("ABC123");
    expect(response.pollInterval).toBe(15);

    const [url, init] = mockFetchFn.mock.calls[0]!;
    expect(url).toBe("https://test-transaction-engine.tax.service.gov.uk/submission");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      "Content-Type": "text/xml; charset=utf-8",
    });
  });

  test("targets the HMRC CT live endpoint when configured for production", async () => {
    const provider = HmrcCtProvider.fromConfig({
      provider: "hmrc-ct",
      environment: "production",
      senderId: "live-user",
      senderPassword: "live-password",
      vendorId: "1234",
      productName: "Tamias",
      productVersion: "0.1.0",
    });

    await provider.submitSubmissionXml('<?xml version="1.0" encoding="UTF-8"?><GovTalkMessage/>');

    const [url] = mockFetchFn.mock.calls[0]!;
    expect(url).toBe("https://transaction-engine.tax.service.gov.uk/submission");
  });

  test("builds a valid submission poll envelope", () => {
    const xml = buildHmrcCtSubmissionPollXml({
      correlationId: "ABC123",
    });

    expect(xml).toContain("<Qualifier>poll</Qualifier>");
    expect(xml).toContain("<Function>submit</Function>");
    expect(xml).toContain("<CorrelationID>ABC123</CorrelationID>");
    expect(xml).toContain("<Class>HMRC-CT-CT600</Class>");
  });

  test("polls the response endpoint returned by transaction engine", async () => {
    const provider = createProvider();
    const response = await provider.pollSubmission({
      correlationId: "ABC123",
      responseEndpoint: "https://example.com/poll",
    });

    expect(response.qualifier).toBe("acknowledgement");

    const [url, init] = mockFetchFn.mock.calls[0]!;
    expect(url).toBe("https://example.com/poll");
    expect(init?.method).toBe("POST");
    expect(String(init?.body)).toContain("<Qualifier>poll</Qualifier>");
    expect(String(init?.body)).toContain("<CorrelationID>ABC123</CorrelationID>");
  });

  test("parses HMRC gateway errors into a rejected outcome summary", () => {
    const message = parseHmrcCtTransactionEngineMessage(`<?xml version="1.0" encoding="UTF-8"?>
<GovTalkMessage xmlns="http://www.govtalk.gov.uk/CM/envelope">
  <Header>
    <MessageDetails>
      <Qualifier>error</Qualifier>
      <Function>submit</Function>
      <CorrelationID>XYZ999</CorrelationID>
    </MessageDetails>
  </Header>
  <GovTalkDetails>
    <GovTalkErrors>
      <Error>
        <RaisedBy>HMRC</RaisedBy>
        <Number>1046</Number>
        <Type>fatal</Type>
        <Text>Authentication failure</Text>
        <Location>/GovTalkMessage/Header/SenderDetails</Location>
      </Error>
    </GovTalkErrors>
  </GovTalkDetails>
  <Body/>
</GovTalkMessage>`);

    expect(message.status).toBe("rejected");
    expect(message.summary).toBe("Authentication failure");
    expect(message.errors).toHaveLength(1);
    expect(message.errors[0]).toMatchObject({
      number: "1046",
      text: "Authentication failure",
      raisedBy: "HMRC",
    });
  });
});
