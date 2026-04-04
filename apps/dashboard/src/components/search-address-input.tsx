"use client";

import { Input } from "@tamias/ui/input";
import { useEffect, useState } from "react";
import dynamic from "@/framework/dynamic";

type Props = {
  id?: string;
  defaultValue?: string;
  onSelect: (addressDetails: AddressDetails) => void;
  placeholder?: string;
  disabled?: boolean;
  emptyMessage?: string;
};

export type AddressDetails = {
  address_line_1: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  country_code: string;
};

const SearchAddressInputCore = dynamic(
  () =>
    import("./search-address-input-core").then(
      (mod) => mod.SearchAddressInputCore,
    ),
  {
    ssr: false,
  },
);

export function SearchAddressInput({
  id,
  onSelect,
  placeholder,
  defaultValue,
  disabled = false,
  emptyMessage = "No results found.",
}: Props) {
  const [isActive, setIsActive] = useState(false);
  const [inputValue, setInputValue] = useState(defaultValue || "");

  useEffect(() => {
    setInputValue(defaultValue || "");
  }, [defaultValue]);

  if (isActive) {
    return (
      <SearchAddressInputCore
        id={id}
        onSelect={onSelect}
        placeholder={placeholder}
        defaultValue={inputValue}
        disabled={disabled}
        emptyMessage={emptyMessage}
        autoFocus
      />
    );
  }

  return (
    <Input
      id={id}
      value={inputValue}
      onChange={(event) => {
        setInputValue(event.target.value);
      }}
      onFocus={() => {
        if (!disabled) {
          setIsActive(true);
        }
      }}
      placeholder={placeholder}
      disabled={disabled}
      autoComplete="off"
      className="border border-border px-3 py-1 text-sm h-9"
    />
  );
}
