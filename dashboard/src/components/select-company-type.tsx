import { BUSINESS_CATEGORIES, BUSINESS_TYPE_LABELS } from "@tamias/contracts/business-type";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@tamias/ui/select";
import type { ComponentProps } from "react";

type Props = Omit<ComponentProps<typeof SelectTrigger>, "value" | "onChange"> & {
  value?: string;
  onChange: (value: string) => void;
  dataTestId?: string;
};

export function SelectCompanyType({ value, onChange, dataTestId, ...triggerProps }: Props) {
  return (
    <Select value={value ?? ""} onValueChange={onChange}>
      <SelectTrigger {...triggerProps} data-testid={dataTestId}>
        <SelectValue placeholder="Select one" />
      </SelectTrigger>
      <SelectContent>
        {BUSINESS_CATEGORIES.map((value) => (
          <SelectItem key={value} value={value}>
            {BUSINESS_TYPE_LABELS[value]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
