import { describe, expect, test } from "bun:test";
import { isInsightSummaryRequest } from "./shared";

describe("isInsightSummaryRequest", () => {
  test("matches explicit weekly summary prompts", () => {
    expect(
      isInsightSummaryRequest("Show me my weekly summary for Week 11, 2026"),
    ).toBe(true);
  });

  test("matches business overview prompts", () => {
    expect(isInsightSummaryRequest("Give me a business overview")).toBe(true);
  });

  test("does not match detailed report prompts", () => {
    expect(isInsightSummaryRequest("Show me a revenue breakdown by month")).toBe(
      false,
    );
  });
});
