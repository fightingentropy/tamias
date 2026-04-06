import { describe, expect, it } from "bun:test";
import { buildUploadedFilePath } from "./upload";

describe("buildUploadedFilePath", () => {
  it("appends a sanitized filename to the parent path", () => {
    expect(buildUploadedFilePath(["team-id", "inbox"], "Edinburgh Workshop Receipt.JPG")).toEqual([
      "team-id",
      "inbox",
      "edinburgh-workshop-receipt.jpg",
    ]);
  });

  it("removes special characters from the appended filename", () => {
    expect(buildUploadedFilePath(["team-id"], "March Receipt #1 (Final).png")).toEqual([
      "team-id",
      "march-receipt-1-final.png",
    ]);
  });
});
