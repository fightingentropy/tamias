"use client";

import { Button } from "@tamias/ui/button";
import { Input } from "@tamias/ui/input";
import { Label } from "@tamias/ui/label";

export type EditableJournalLine = {
  accountCode: string;
  description: string;
  debit: string;
  credit: string;
};

type JournalLinesEditorProps = {
  lines: EditableJournalLine[];
  onChange: (lines: EditableJournalLine[]) => void;
  addLabel?: string;
};

export function JournalLinesEditor({
  lines,
  onChange,
  addLabel = "Add line",
}: JournalLinesEditorProps) {
  const updateLine = (
    index: number,
    key: keyof EditableJournalLine,
    value: string,
  ) => {
    onChange(
      lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, [key]: value } : line,
      ),
    );
  };

  const removeLine = (index: number) => {
    onChange(lines.filter((_, lineIndex) => lineIndex !== index));
  };

  return (
    <div className="space-y-3">
      {lines.map((line, index) => (
        <div
          key={`${index}-${line.accountCode}-${line.description}`}
          className="grid gap-3 rounded-lg border p-3 md:grid-cols-[1.1fr_1.5fr_1fr_1fr_auto]"
        >
          <div className="space-y-1">
            <Label>Account</Label>
            <Input
              value={line.accountCode}
              onChange={(event) =>
                updateLine(index, "accountCode", event.target.value)
              }
              placeholder="3100"
            />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Input
              value={line.description}
              onChange={(event) =>
                updateLine(index, "description", event.target.value)
              }
              placeholder="Accrual"
            />
          </div>
          <div className="space-y-1">
            <Label>Debit</Label>
            <Input
              inputMode="decimal"
              value={line.debit}
              onChange={(event) =>
                updateLine(index, "debit", event.target.value)
              }
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1">
            <Label>Credit</Label>
            <Input
              inputMode="decimal"
              value={line.credit}
              onChange={(event) =>
                updateLine(index, "credit", event.target.value)
              }
              placeholder="0.00"
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => removeLine(index)}
              disabled={lines.length <= 2}
            >
              Remove
            </Button>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={() =>
          onChange([
            ...lines,
            {
              accountCode: "",
              description: "",
              debit: "",
              credit: "",
            },
          ])
        }
      >
        {addLabel}
      </Button>
    </div>
  );
}
