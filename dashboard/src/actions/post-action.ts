export async function postAction<TInput, TOutput>(
  path: string,
  input: TInput,
): Promise<TOutput> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const text = await response.text();
  const data = text ? tryParseJson(text) : undefined;

  if (!response.ok) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : text || "Action failed";

    throw new Error(message);
  }

  return data as TOutput;
}

function tryParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
