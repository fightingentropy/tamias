import { describe, expect, test } from "bun:test";
import { HTTPException } from "hono/http-exception";
import { createRestErrorResponse } from "./error-response";

describe("REST error responses", () => {
  test("preserves fail-closed HTTP exception status codes", async () => {
    const response = createRestErrorResponse(
      new HTTPException(401, { message: "Authorization header required" }),
    );

    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Authorization header required");
  });

  test("hides unexpected internal errors", async () => {
    const response = createRestErrorResponse(new Error("sensitive detail"));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Internal Server Error" });
  });
});
