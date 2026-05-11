import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";

export function useConnectParams(initialCountryCode?: string) {
  const [params, setParams] = useQueryStates({
    step: parseAsStringLiteral(["connect", "account", "import"]),
    countryCode: parseAsString.withDefault(initialCountryCode ?? ""),
    provider: parseAsStringLiteral(["truelayer"]),
    token: parseAsString,
    institution_id: parseAsString,
    search: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
    error: parseAsString,
    ref: parseAsString,
    details: parseAsString,
  });

  return {
    ...params,
    setParams,
  };
}
