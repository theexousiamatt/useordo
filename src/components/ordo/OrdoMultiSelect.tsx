import { useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

export interface OrdoMultiSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  avatarUrl?: string | null;
}

interface OrdoMultiSelectProps {
  options: OrdoMultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
}

/**
 * OrdoMultiSelect — canonical multi-select (member / tag pickers) for Ordo
 * forms. Pill chips for selection, calm brand accents, soft popover surface.
 */
export function OrdoMultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select…",
  emptyText = "No options available.",
  className,
}: OrdoMultiSelectProps) {
  const [open, setOpen] = useState(false);

  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  };

  const selectedOptions = options.filter((o) => selected.includes(o.value));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-h-11 w-full items-center justify-between gap-2 rounded-small border border-border bg-card px-3.5 py-2 text-left text-sm shadow-subtle transition-colors",
            "focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/30",
            open && "border-primary/40",
            className,
          )}
        >
          <span className="flex flex-1 flex-wrap gap-1.5">
            {selectedOptions.length === 0 ? (
              <span className="text-muted-foreground/70">{placeholder}</span>
            ) : (
              selectedOptions.map((o) => (
                <span
                  key={o.value}
                  className="inline-flex items-center gap-1.5 rounded-pill bg-primary-surface px-2 py-0.5 text-xs font-medium text-primary-text"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(o.value);
                  }}
                >
                  {o.label}
                  <X className="h-3 w-3 opacity-60" />
                </span>
              ))
            )}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] rounded-small border-border bg-popover p-1 shadow-panel"
      >
        {options.length === 0 ? (
          <p className="px-3 py-4 text-center text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <ScrollArea className="max-h-60">
            <div className="space-y-0.5">
              {options.map((o) => {
                const isSelected = selected.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => toggle(o.value)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left transition-colors hover:bg-secondary",
                      isSelected && "bg-primary-surface",
                    )}
                  >
                    <Avatar className="h-7 w-7">
                      {o.avatarUrl && <AvatarImage src={o.avatarUrl} alt={o.label} />}
                      <AvatarFallback className="text-xs">{initials(o.label)}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{o.label}</span>
                      {o.sublabel && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {o.sublabel}
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-md border transition-colors",
                        isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border",
                      )}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
