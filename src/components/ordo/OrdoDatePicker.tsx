import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface OrdoDatePickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: (date: Date) => boolean;
}

/**
 * OrdoDatePicker — canonical date selector for Ordo forms (timelines, due
 * dates). Soft surface, large radius, brand-tinted selected day.
 */
export function OrdoDatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
  disabled,
}: OrdoDatePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-11 w-full items-center gap-2.5 rounded-small border border-border bg-card px-3.5 text-left text-sm shadow-subtle transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 data-[state=open]:border-primary/40",
            !value && "text-muted-foreground/70",
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          {value ? format(value, "PPP") : <span>{placeholder}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto rounded-small border-border bg-popover p-0 shadow-panel"
      >
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          disabled={disabled}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}
