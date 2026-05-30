import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

export interface OrdoSelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
}

interface OrdoSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  options: OrdoSelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * OrdoSelect — canonical single-select dropdown for Ordo forms. Wraps the
 * themed Radix select with Ordo surface + radius. No default browser styling.
 */
export function OrdoSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  className,
  disabled,
}: OrdoSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger
        className={cn(
          "h-11 rounded-small border-border bg-card px-3.5 text-sm shadow-subtle",
          "focus:ring-2 focus:ring-ring/30 focus:ring-offset-0 data-[state=open]:border-primary/40",
          className,
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="rounded-small border-border bg-popover shadow-panel">
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className="rounded-[8px]">
            <span className="flex items-center gap-2">
              {opt.icon}
              <span className="flex flex-col">
                <span>{opt.label}</span>
                {opt.description && (
                  <span className="text-xs text-muted-foreground">{opt.description}</span>
                )}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
