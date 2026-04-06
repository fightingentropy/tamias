"use client";

import { track } from "@/lib/telemetry/client";
import { LogEvents } from "@/lib/telemetry/events";
import { Button } from "@tamias/ui/button";
import { Input } from "@tamias/ui/input";
import { Skeleton } from "@tamias/ui/skeleton";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "@/framework/navigation";
import { useEffect, useRef } from "react";
import { useDebounceValue, useScript } from "usehooks-ts";
import { useConnectParams } from "@/hooks/use-connect-params";
import { usePlaidLinkBridge } from "@/components/plaid-link-bridge";
import { useTRPC } from "@/trpc/client";
import { BankLogo } from "./bank-logo";
import { ConnectBankProvider } from "./connect-bank-provider";
import { CountrySelector } from "./country-selector";

const nameWidths = [140, 100, 180, 120, 160, 130, 150, 110, 170, 90];

function SearchSkeleton() {
  return (
    <div className="space-y-0.5">
      {Array.from(new Array(10), (_, index) => (
        <div className="flex justify-between items-center -mx-2 px-2 py-2" key={index.toString()}>
          <div className="flex items-center">
            <Skeleton className="h-[34px] w-[34px] rounded-full shrink-0" />
            <div className="flex flex-col space-y-1.5 ml-3">
              <Skeleton className="h-2.5 rounded-none" style={{ width: nameWidths[index] }} />
              <Skeleton className="h-2 rounded-none w-[60px]" />
            </div>
          </div>
          <Skeleton className="h-3 w-[50px] rounded-none opacity-50" />
        </div>
      ))}
    </div>
  );
}

function formatProvider(provider: string) {
  switch (provider) {
    case "plaid":
      return "Plaid";
    case "teller":
      return "Teller";
    default:
      return provider;
  }
}

type SearchResultProps = {
  id: string;
  name: string;
  logo: string | null;
  provider: string;
  availableHistory: number;
  openPlaid: () => void;
  type?: "personal" | "business";
  redirectPath?: string;
  countryCode?: string;
};

function SearchResult({
  id,
  name,
  logo,
  provider,
  availableHistory,
  openPlaid,
  type,
  redirectPath,
  countryCode,
}: SearchResultProps) {
  const connectRef = useRef<(() => void) | null>(null);

  return (
    <div
      onClick={() => connectRef.current?.()}
      className="group flex justify-between items-center cursor-pointer hover:bg-accent/50 -mx-2 px-2 py-2 rounded-md transition-colors"
    >
      <div className="flex items-center min-w-0">
        <BankLogo src={logo} alt={name} />

        <div className="ml-3 min-w-0">
          <p className="text-sm font-medium leading-none truncate">{name}</p>
          <span className="text-[#878787] text-xs capitalize mt-0.5 block">
            Via {formatProvider(provider)}
            {type ? ` · ${type}` : ""}
          </span>
        </div>
      </div>

      <ConnectBankProvider
        id={id}
        provider={provider}
        openPlaid={openPlaid}
        availableHistory={availableHistory}
        redirectPath={redirectPath}
        countryCode={countryCode}
        connectRef={connectRef}
      />
    </div>
  );
}

type BankSearchContentProps = {
  enabled: boolean;
  redirectPath?: string;
  listHeight?: string;
  defaultCountryCode?: string;
  fadeGradientClass?: string;
  emptyState?:
    | React.ReactNode
    | ((context: { query: string; countryCode: string }) => React.ReactNode);
};

export function BankSearchContent({
  enabled,
  redirectPath,
  listHeight = "h-[430px]",
  fadeGradientClass,
  defaultCountryCode,
  emptyState,
}: BankSearchContentProps) {
  const trpc = useTRPC();
  const router = useRouter();
  const { setSession, open, ready } = usePlaidLinkBridge();
  const setSessionRef = useRef(setSession);
  setSessionRef.current = setSession;
  const teamCountryCode = defaultCountryCode || "";
  const connectDefaultCountry =
    teamCountryCode === "US" || teamCountryCode === "CA" || teamCountryCode === "GB"
      ? teamCountryCode
      : "GB";

  const { countryCode, search: query, setParams } = useConnectParams(connectDefaultCountry);
  const setParamsRef = useRef(setParams);
  setParamsRef.current = setParams;

  const effectiveCountryCode =
    countryCode === "GB" || countryCode === "US" || countryCode === "CA"
      ? countryCode
      : connectDefaultCountry;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (countryCode === "GB" || countryCode === "US" || countryCode === "CA") {
      return;
    }

    setParams({ countryCode: connectDefaultCountry });
  }, [connectDefaultCountry, countryCode, enabled, setParams]);

  const { mutateAsync: fetchPlaidLinkToken } = useMutation(trpc.banking.plaidLink.mutationOptions());

  const { mutateAsync: exchangePublicToken } = useMutation(trpc.banking.plaidExchange.mutationOptions());

  const fetchPlaidLinkTokenRef = useRef(fetchPlaidLinkToken);
  fetchPlaidLinkTokenRef.current = fetchPlaidLinkToken;
  const exchangePublicTokenRef = useRef(exchangePublicToken);
  exchangePublicTokenRef.current = exchangePublicToken;

  useScript("https://cdn.teller.io/connect/connect.js", {
    removeOnUnmount: false,
  });

  const [debouncedQuery] = useDebounceValue(query ?? "", 200);

  const { data, isLoading } = useQuery({
    ...trpc.institutions.get.queryOptions(
      {
        q: debouncedQuery,
        countryCode: effectiveCountryCode,
        // Do not exclude Teller: the Convex catalog may only have Teller US rows if Plaid
        // institution sync failed, which otherwise yields an empty list for US/CA.
      },
      {
        enabled,
      },
    ),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (!enabled) {
      setSessionRef.current(null);
      return;
    }

    if (
      effectiveCountryCode !== "GB" &&
      effectiveCountryCode !== "US" &&
      effectiveCountryCode !== "CA"
    ) {
      setSessionRef.current(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const result = await fetchPlaidLinkTokenRef.current();
        if (cancelled) {
          return;
        }

        const token = result.data.link_token;
        if (!token) {
          return;
        }

        setSessionRef.current({
          token,
          onSuccess: async (public_token, metadata) => {
            const exchangeResult = await exchangePublicTokenRef.current({
              token: public_token,
            });

            setParamsRef.current({
              step: "account",
              provider: "plaid",
              token: exchangeResult.data.access_token,
              ref: exchangeResult.data.item_id,
              institution_id: metadata.institution?.institution_id,
            });
            track({
              event: LogEvents.ConnectBankAuthorized.name,
              channel: LogEvents.ConnectBankAuthorized.channel,
              provider: "plaid",
            });
          },
          onExit: () => {
            setParamsRef.current({ step: "connect" });

            track({
              event: LogEvents.ConnectBankCanceled.name,
              channel: LogEvents.ConnectBankCanceled.channel,
              provider: "plaid",
            });
          },
        });
      } catch {
        // Prefetch is best-effort; user can retry via Connect.
      }
    })();

    return () => {
      cancelled = true;
      setSessionRef.current(null);
    };
  }, [enabled, effectiveCountryCode]);

  return (
    <div>
      <div className="flex space-x-2 relative">
        <Input
          placeholder="Search bank..."
          type="search"
          onChange={(evt) => setParams({ search: evt.target.value || null })}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          autoFocus
          value={query ?? ""}
        />

        <div className="absolute right-0">
          <CountrySelector
            defaultValue={effectiveCountryCode}
            onSelect={(nextCountry) => {
              setParams({ countryCode: nextCountry });
            }}
          />
        </div>
      </div>

      <div className="relative">
        <div className={`${listHeight} space-y-0.5 overflow-auto scrollbar-hide pt-2 mt-2 pb-16`}>
          {isLoading && <SearchSkeleton />}

          {data?.map((institution) => {
            if (!institution) {
              return null;
            }

            return (
              <SearchResult
                key={institution.id}
                id={institution.id}
                name={institution.name}
                logo={institution.logo}
                provider={institution.provider}
                availableHistory={institution.availableHistory ? +institution.availableHistory : 0}
                type={institution?.type ?? undefined}
                openPlaid={() => {
                  if (ready) {
                    open();
                  }
                }}
                redirectPath={redirectPath}
                countryCode={effectiveCountryCode}
              />
            );
          })}

          {!isLoading &&
            data?.length === 0 &&
            (typeof emptyState === "function" ? (
              emptyState({ query: debouncedQuery, countryCode: effectiveCountryCode })
            ) : emptyState ? (
              emptyState
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[350px]">
                <p className="font-medium mb-2">No banks found</p>
                <p className="text-sm text-center text-[#878787]">
                  We couldn't find a bank matching your criteria.
                  <br /> Let us know, or start with manual import.
                </p>
                {effectiveCountryCode === "GB" &&
                  debouncedQuery &&
                  /\b(platypus|tartan|gingham|houndstooth)\b/i.test(debouncedQuery) && (
                    <p className="text-sm text-center text-muted-foreground mt-3 max-w-[320px]">
                      Those names are US Plaid sandbox institutions. Switch the country to{" "}
                      <strong>United States</strong>, then search again.
                    </p>
                  )}

                <div className="mt-4 flex space-x-2">
                  <Button variant="outline" onClick={() => setParams({ step: "import" })}>
                    Import
                  </Button>

                  <Button
                    onClick={() => {
                      router.push("/account/support");
                    }}
                  >
                    Contact us
                  </Button>
                </div>
              </div>
            ))}
        </div>
        {fadeGradientClass && (
          <div
            className={`pointer-events-none absolute bottom-0 left-0 right-0 h-16 ${fadeGradientClass}`}
          />
        )}
      </div>
    </div>
  );
}
