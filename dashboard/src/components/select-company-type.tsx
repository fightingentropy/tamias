import { BUSINESS_TYPES, BUSINESS_TYPE_LABELS } from "@tamias/contracts/business-type";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@tamias/ui/select";

type Props = {
  value?: string;
  onChange: (value: string) => void;
  className?: string;
  dataTestId?: string;
};

export function SelectCompanyType({ value, onChange, className, dataTestId }: Props) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className} data-testid={dataTestId}>
        <SelectValue placeholder="Select one" />
      </SelectTrigger>
      <SelectContent>
        {BUSINESS_TYPES.map((value) => (
          <SelectItem key={value} value={value}>
            {BUSINESS_TYPE_LABELS[value]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
