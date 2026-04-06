"use client";

import { useCallback, useMemo, useState } from "react";

type ActionOptions<TData> = {
  onSuccess?: (data: TData) => void;
  onError?: (error: Error) => void;
};

export function useAction<TInput, TData>(
  action: (input: TInput) => Promise<TData> | TData,
  options?: ActionOptions<TData>,
) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<{
    data?: TData;
    error?: Error;
  }>({});

  const executeAsync = useCallback(
    async (input: TInput) => {
      setIsExecuting(true);

      try {
        const data = await action(input);
        setResult({ data });
        options?.onSuccess?.(data);
        return data;
      } catch (error) {
        const normalizedError = error instanceof Error ? error : new Error("Action failed");
        setResult({ error: normalizedError });
        options?.onError?.(normalizedError);
        throw normalizedError;
      } finally {
        setIsExecuting(false);
      }
    },
    [action, options],
  );

  return useMemo(
    () => ({
      execute: executeAsync,
      executeAsync,
      result,
      status: isExecuting
        ? "executing"
        : result.error
          ? "hasErrored"
          : result.data !== undefined
            ? "hasSucceeded"
            : "idle",
      isExecuting,
      hasSucceeded: Boolean(result.data),
      hasErrored: Boolean(result.error),
      reset() {
        setResult({});
      },
    }),
    [executeAsync, isExecuting, result],
  );
}
