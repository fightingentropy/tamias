import type { Register } from "@tanstack/react-router";
import type { ValidateSerializableInput } from "@tanstack/router-core";

/**
 * Asserts a value is safe to return from a TanStack Start `createServerFn` handler.
 * Use only when runtime payloads are JSON-like (Convex/tRPC) but static types still
 * contain `unknown` (for example AI SDK chat parts with dynamic tool `input`).
 */
export function asStartServerFnResult<T>(value: T): ValidateSerializableInput<Register, T> {
  return value as ValidateSerializableInput<Register, T>;
}
