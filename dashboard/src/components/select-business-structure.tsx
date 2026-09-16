import { BUSINESS_STRUCTURES, BUSINESS_STRUCTURE_LABELS } from "@tamias/contracts/business-type";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@tamias/ui/select";
import type { ComponentProps } from "react";

type TriggerProps = Omit<ComponentProps<typeof SelectTrigger>, "value" | "onChange">;

export function SelectBusinessStructure({
  value,
  onChange,
  ...triggerProps
}: TriggerProps & {
  value?: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value ?? ""} onValueChange={onChange}>
      <SelectTrigger {...triggerProps}>
        <SelectValue placeholder="Choose your business structure" />
      </SelectTrigger>
      <SelectContent>
        {BUSINESS_STRUCTURES.map((value) => (
          <SelectItem key={value} value={value}>
            {BUSINESS_STRUCTURE_LABELS[value]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SelectCis({
  value,
  onChange,
  ...triggerProps
}: TriggerProps & {
  value: boolean | null;
  onChange: (value: boolean | null) => void;
}) {
  return (
    <Select
      value={value === true ? "yes" : value === false ? "no" : "not_sure"}
      onValueChange={(value) => onChange(value === "not_sure" ? null : value === "yes")}
    >
      <SelectTrigger {...triggerProps}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="yes">Yes, I work under CIS</SelectItem>
        <SelectItem value="no">No</SelectItem>
        <SelectItem value="not_sure">Not sure yet</SelectItem>
      </SelectContent>
    </Select>
  );
}
