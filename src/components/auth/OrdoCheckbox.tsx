import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrdoCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  id?: string;
}

/** Ordo OS styled checkbox with label. */
export function OrdoCheckbox({ checked, onChange, label, id }: OrdoCheckboxProps) {
  const cbId = id || React.useId();
  return (
    <label htmlFor={cbId} className="flex cursor-pointer select-none items-center gap-2.5">
      <span className="relative inline-flex">
        <input
          id={cbId}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span
          className={cn(
            "flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border transition-all",
            checked ? "border-foreground bg-foreground" : "border-border bg-card",
          )}
        >
          {checked && <Check className="h-3 w-3 text-card" strokeWidth={3} />}
        </span>
      </span>
      {label && <span className="text-sm text-foreground">{label}</span>}
    </label>
  );
}
