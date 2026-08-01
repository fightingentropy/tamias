import { HTTPException } from "hono/http-exception";

export function createRestErrorResponse(error: Error) {
  if (error instanceof HTTPException) {
    return error.getResponse();
  }

  return Response.json({ error: "Internal Server Error" }, { status: 500 });
}
