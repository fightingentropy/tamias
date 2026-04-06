"use client";

import { calculateLineItemTotal } from "@tamias/invoice/calculate";
import { Button } from "@tamias/ui/button";
import { Icons } from "@tamias/ui/icons";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { useTemplateUpdate } from "@/hooks/use-template-update";
import { formatAmount } from "@/utils/format";
import type { InvoiceFormValues } from "./form-context";
import { LabelInput } from "./label-input";
import { PercentInput } from "./percent-input";
import { ProductAutocomplete } from "./product-autocomplete";
import { ProductAwareAmountInput } from "./product-aware-amount-input";
import { ProductAwareUnitInput } from "./product-aware-unit-input";
import { QuantityInput } from "./quantity-input";

export function LineItems() {
  const { control } = useFormContext();
  const currency = useWatch({ control, name: "template.currency" });
  const { updateTemplate } = useTemplateUpdate();

  const includeDecimals = useWatch({
    control,
    name: "template.includeDecimals",
  });

  const includeUnits = useWatch({
    control,
    name: "template.includeUnits",
  });

  const includeLineItemTax = useWatch({
    control,
    name: "template.includeLineItemTax",
  });

  const maximumFractionDigits = includeDecimals ? 2 : 0;

  // Build grid columns based on settings
  const getGridCols = () => {
    if (includeLineItemTax && includeUnits) {
      return "grid-cols-[1.5fr_12%_20%_12%_15%]";
    }
    if (includeLineItemTax) {
      return "grid-cols-[1.5fr_12%_12%_12%_15%]";
    }
    if (includeUnits) {
      return "grid-cols-[1.5fr_15%_25%_15%]";
    }
    return "grid-cols-[1.5fr_15%_15%_15%]";
  };

  const gridCols = getGridCols();

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "lineItems",
  });

  const handleRemove = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= fields.length) {
      return;
    }
    move(index, targetIndex);
  };

  return (
    <div className="space-y-4">
      <div className={`grid ${gridCols} gap-4 items-end mb-2`}>
        <LabelInput
          name="template.descriptionLabel"
          onSave={(value) => {
            updateTemplate({ descriptionLabel: value });
          }}
          className="truncate"
        />

        <LabelInput
          name="template.quantityLabel"
          onSave={(value) => {
            updateTemplate({ quantityLabel: value });
          }}
          className="truncate"
        />

        <LabelInput
          name="template.priceLabel"
          onSave={(value) => {
            updateTemplate({ priceLabel: value });
          }}
          className="truncate"
        />

        {includeLineItemTax && (
          <LabelInput
            name="template.lineItemTaxLabel"
            defaultValue="Tax"
            onSave={(value) => {
              updateTemplate({ lineItemTaxLabel: value });
            }}
            className="truncate"
          />
        )}

        <LabelInput
          name="template.totalLabel"
          onSave={(value) => {
            updateTemplate({ totalLabel: value });
          }}
          className="text-right truncate"
        />
      </div>

      <div className="space-y-2">
        {fields.map((field, index) => (
          <LineItemRow
            key={field.id}
            index={index}
            handleRemove={handleRemove}
            isReorderable={fields.length > 1}
            onMoveUp={() => handleMove(index, -1)}
            onMoveDown={() => handleMove(index, 1)}
            canMoveUp={index > 0}
            canMoveDown={index < fields.length - 1}
            currency={currency}
            maximumFractionDigits={maximumFractionDigits}
            includeUnits={includeUnits}
            includeLineItemTax={includeLineItemTax}
            gridCols={gridCols}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() =>
          append({
            name: "",
            quantity: 0,
            price: 0,
          })
        }
        className="flex items-center space-x-2 text-xs text-[#878787] font-mono"
      >
        <Icons.Add />
        <span className="text-[11px]">Add item</span>
      </button>
    </div>
  );
}

function LineItemRow({
  index,
  handleRemove,
  isReorderable,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  currency,
  maximumFractionDigits,
  includeUnits,
  includeLineItemTax,
  gridCols,
}: {
  index: number;
  handleRemove: (index: number) => void;
  isReorderable: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  currency: string;
  maximumFractionDigits: number;
  includeUnits?: boolean;
  includeLineItemTax?: boolean;
  gridCols: string;
}) {
  const { control, watch, setValue } = useFormContext();

  const locale = useWatch({ control, name: "template.locale" });

  const price = useWatch({
    control,
    name: `lineItems.${index}.price`,
  });

  const quantity = useWatch({
    control,
    name: `lineItems.${index}.quantity`,
  });

  const lineItemName = watch(`lineItems.${index}.name`);

  return (
    <div className={`grid ${gridCols} gap-4 items-start relative group mb-2 w-full`}>
      {isReorderable && (
        <div className="absolute -left-10 -top-[4px] flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            type="button"
            variant="ghost"
            className="h-5 w-5 p-0 hover:bg-transparent disabled:opacity-30"
            onClick={onMoveUp}
            disabled={!canMoveUp}
          >
            <Icons.ArrowUpward className="size-3 text-[#878787]" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-5 w-5 p-0 hover:bg-transparent disabled:opacity-30"
            onClick={onMoveDown}
            disabled={!canMoveDown}
          >
            <Icons.ArrowDownward className="size-3 text-[#878787]" />
          </Button>
        </div>
      )}

      <ProductAutocomplete
        index={index}
        value={lineItemName || ""}
        onChange={(value: string) => {
          setValue(`lineItems.${index}.name`, value, {
            shouldValidate: true,
            shouldDirty: true,
          });
        }}
      />

      <QuantityInput name={`lineItems.${index}.quantity`} />

      <div className="flex items-center gap-2">
        <ProductAwareAmountInput
          name={`lineItems.${index}.price`}
          lineItemIndex={index}
        />
        {includeUnits && <span className="text-xs text-[#878787]">/</span>}
        {includeUnits && (
          <ProductAwareUnitInput
            name={`lineItems.${index}.unit`}
            lineItemIndex={index}
          />
        )}
      </div>

      {includeLineItemTax && (
        <PercentInput name={`lineItems.${index}.taxRate`} />
      )}

      <div className="text-right">
        <span className="text-xs text-primary font-mono">
          {formatAmount({
            amount: calculateLineItemTotal({
              price,
              quantity,
            }),
            currency,
            locale,
            maximumFractionDigits,
          })}
        </span>
      </div>

      {index !== 0 && (
        <Button
          type="button"
          onClick={() => handleRemove(index)}
          className="absolute -right-9 -top-[4px] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-transparent text-[#878787]"
          variant="ghost"
        >
          <Icons.Close />
        </Button>
      )}
    </div>
  );
}
