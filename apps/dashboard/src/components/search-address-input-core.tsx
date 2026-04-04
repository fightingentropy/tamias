"use client";

import { getGoogleApiKey } from "@tamias/utils/envs";
import { cn } from "@tamias/ui/cn";
import {
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Command as CommandPrimitive,
} from "@tamias/ui/command";
import { Check } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import usePlacesAutoComplete, { getDetails } from "use-places-autocomplete";
import { useOnClickOutside } from "usehooks-ts";
import type { AddressDetails } from "./search-address-input";

const GOOGLE_PLACES_SCRIPT_ID = "tamias-google-places-api";
const GOOGLE_PLACES_LIBRARIES = "places";

type PlaceAddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

type PlaceDetailsResult = {
  address_components?: PlaceAddressComponent[];
};

declare global {
  interface Window {
    google?: {
      maps?: {
        places?: unknown;
      };
    };
    __tamiasGooglePlacesApiPromise?: Promise<void>;
  }
}

function loadGooglePlacesApi(apiKey: string) {
  if (typeof window === "undefined" || !apiKey) {
    return Promise.resolve();
  }

  if (window.google?.maps?.places) {
    return Promise.resolve();
  }

  if (window.__tamiasGooglePlacesApiPromise) {
    return window.__tamiasGooglePlacesApiPromise;
  }

  window.__tamiasGooglePlacesApiPromise = new Promise<void>(
    (resolve, reject) => {
      const existingScript = document.getElementById(
        GOOGLE_PLACES_SCRIPT_ID,
      ) as HTMLScriptElement | null;

      const handleLoad = () => {
        if (window.google?.maps?.places) {
          resolve();
          return;
        }

        window.__tamiasGooglePlacesApiPromise = undefined;
        reject(new Error("Google Places API did not initialize."));
      };

      const handleError = () => {
        window.__tamiasGooglePlacesApiPromise = undefined;
        reject(new Error("Failed to load Google Places API."));
      };

      if (existingScript) {
        existingScript.addEventListener("load", handleLoad, { once: true });
        existingScript.addEventListener("error", handleError, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.id = GOOGLE_PLACES_SCRIPT_ID;
      script.src =
        "https://maps.googleapis.com/maps/api/js" +
        `?key=${encodeURIComponent(apiKey)}&libraries=${GOOGLE_PLACES_LIBRARIES}`;
      script.async = true;
      script.defer = true;
      script.addEventListener("load", handleLoad, { once: true });
      script.addEventListener("error", handleError, { once: true });
      document.head.appendChild(script);
    },
  );

  return window.__tamiasGooglePlacesApiPromise;
}

type Props = {
  id?: string;
  defaultValue?: string;
  onSelect: (addressDetails: AddressDetails) => void;
  placeholder?: string;
  disabled?: boolean;
  emptyMessage?: string;
  autoFocus?: boolean;
};

type Option = {
  value: string;
  label: string;
};

const getAddressDetailsByAddressId = async (
  addressId: string,
): Promise<AddressDetails> => {
  const details = (await getDetails({
    placeId: addressId,
    fields: ["address_component"],
  })) as PlaceDetailsResult;

  const comps = details.address_components;

  const streetNumber =
    comps?.find((c) => c.types.includes("street_number"))?.long_name ?? "";
  const streetAddress =
    comps?.find((c) => c.types.includes("route"))?.long_name ?? "";
  const city =
    comps?.find((c) => c.types.includes("postal_town"))?.long_name ||
    comps?.find((c) => c.types.includes("locality"))?.long_name ||
    comps?.find((c) => c.types.includes("sublocality_level_1"))?.long_name ||
    "";
  const state =
    comps?.find((c) => c.types.includes("administrative_area_level_1"))
      ?.short_name || "";
  const zip =
    comps?.find((c) => c.types.includes("postal_code"))?.long_name || "";
  const country =
    comps?.find((c) => c.types.includes("country"))?.long_name || "";
  const countryCode =
    comps?.find((c) => c.types.includes("country"))?.short_name || "";

  return {
    address_line_1: `${streetNumber} ${streetAddress}`.trim(),
    city,
    state,
    zip,
    country,
    country_code: countryCode,
  };
};

export function SearchAddressInputCore({
  id,
  onSelect,
  placeholder,
  defaultValue,
  disabled = false,
  emptyMessage = "No results found.",
  autoFocus = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  const googleApiKey = getGoogleApiKey();
  const [isPlacesApiLoaded, setPlacesApiLoaded] = useState(
    typeof window !== "undefined" && Boolean(window.google?.maps?.places),
  );
  const [isOpen, setOpen] = useState(false);
  const [selected, setSelected] = useState<Option | null>(null);
  const [inputValue, setInputValue] = useState<string>(defaultValue || "");

  useEffect(() => {
    if (!googleApiKey || isPlacesApiLoaded) {
      return;
    }

    let isCancelled = false;

    void loadGooglePlacesApi(googleApiKey).then(
      () => {
        if (!isCancelled) {
          setPlacesApiLoaded(true);
        }
      },
      () => {
        if (!isCancelled) {
          setPlacesApiLoaded(false);
        }
      },
    );

    return () => {
      isCancelled = true;
    };
  }, [googleApiKey, isPlacesApiLoaded]);

  const {
    ready,
    suggestions: { status, data },
    setValue,
  } = usePlacesAutoComplete({
    initOnMount: isPlacesApiLoaded,
    debounce: 300,
    requestOptions: {
      language: "en",
    },
  });

  useEffect(() => {
    if (defaultValue) {
      setValue(defaultValue, false);
      setInputValue(defaultValue);
    }
  }, [defaultValue, setValue]);

  useEffect(() => {
    if (!autoFocus) {
      return;
    }

    const input = inputRef.current;

    if (!input) {
      return;
    }

    input.focus();
    const cursorPosition = input.value.length;
    input.setSelectionRange(cursorPosition, cursorPosition);
  }, [autoFocus]);

  const options: Option[] = data.map((item) => ({
    value: item.place_id,
    label: item.description,
  }));

  const handleSelect = async (address: Option) => {
    setValue(address.label, false);
    const addressDetails = await getAddressDetailsByAddressId(address.value);

    onSelect(addressDetails);
  };

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const input = inputRef.current;

      if (!input) {
        return;
      }

      if (!isOpen) {
        setOpen(true);
      }

      if (event.key === "Enter" && input.value !== "") {
        const optionToSelect = options.find(
          (option) => option.label === input.value,
        );

        if (optionToSelect) {
          setSelected(optionToSelect);
          void handleSelect(optionToSelect);
        }
      }

      if (event.key === "Escape") {
        input.blur();
      }
    },
    [isOpen, options],
  );

  const handleBlur = useCallback(() => {
    setInputValue(selected?.label || "");
  }, [selected]);

  const handleSelectOption = useCallback(
    (selectedOption: Option) => {
      setInputValue(selectedOption.label);
      setSelected(selectedOption);
      void handleSelect(selectedOption);
      setOpen(false);

      setTimeout(() => {
        inputRef.current?.blur();
      }, 0);
    },
    [onSelect],
  );

  // @ts-expect-error input wrapper ref type is wider than the hook expects
  useOnClickOutside(ref, () => {
    setOpen(false);
  });

  return (
    <div ref={ref} className="relative">
      <CommandPrimitive onKeyDown={handleKeyDown}>
        <div className="relative">
          <CommandInput
            id={id}
            ref={inputRef}
            value={inputValue}
            onValueChange={(value) => {
              setInputValue(value);
              setValue(value);
              setOpen(true);
            }}
            onBlur={handleBlur}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            disabled={disabled || !ready}
            className="border border-border px-3 py-1 text-sm h-9"
            autoComplete="off"
          />
        </div>

        {isOpen && (
          <CommandList className="absolute top-full left-0 right-0 z-10 mt-1 bg-background">
            {options.length > 0 ? (
              <CommandGroup className="border border-border max-h-[165px] overflow-auto">
                {options.map((option) => {
                  const isSelected = selected?.value === option.value;

                  return (
                    <CommandItem
                      key={option.value}
                      value={option.label}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      onSelect={() => handleSelectOption(option)}
                      className={cn(
                        "flex w-full items-center gap-2",
                        !isSelected ? "pl-8" : null,
                      )}
                    >
                      {option.label}
                      {isSelected ? <Check className="w-4" /> : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : null}
            {inputValue &&
            options.length === 0 &&
            !selected &&
            status === "ZERO_RESULTS" ? (
              <CommandEmpty className="select-none px-2 py-3 text-center text-sm">
                {emptyMessage}
              </CommandEmpty>
            ) : null}
          </CommandList>
        )}
      </CommandPrimitive>
    </div>
  );
}
