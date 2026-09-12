import { HTTPException } from "hono/http-exception";
import { IdempotentMutationConflict } from "../services/mutation-safety";

export function createRestErrorResponse(error: Error) {
  if (error instanceof IdempotentMutationConflict) {
    return Response.json(
      { error: "Conflict", description: error.message, code: error.reason },
      { status: 409 },
    );
  }
  if (error instanceof HTTPException) {
    return error.getResponse();
  }

  return Response.json({ error: "Internal Server Error" }, { status: 500 });
}
