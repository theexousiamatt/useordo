import { useState } from "react";
import { addDays, format, nextMonday } from "date-fns";
import { CalendarX, CalendarClock, CalendarDays, CalendarRange } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface InlineDatePickerProps {
  /** Current due date as an ISO date string (yyyy-MM-dd), or null. */
  value: string | null;
  onChange: (next: string | null) => void;
}

const toISO = (d: Date) => format(d, "yyyy-MM-dd");

/**
 * InlineDatePicker — compact due-date editor anchored to a task card.
 * Quick presets + custom calendar. Persists instantly.
 */
export function InlineDatePicker({ value, onChange }: InlineDatePickerProps) {
  const [showCalendar, setShowCalendar] = useState(false);
  const selected = value ? new Date(`${value}T00:00:00`) : undefined;

  const presets = [
    { label: "Today", icon: CalendarClock, get: () => new Date() },
    { label: "Tomorrow", icon: CalendarDays, get: () => addDays(new Date(), 1) },
    { label: "Next week", icon: CalendarRange, get: () => nextMonday(new Date()) },
  ];

  return (
    <div className="flex flex-col">
      <div className="p-1.5">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onChange(toISO(p.get()))}
            className="flex w-full items-center gap-2.5 rounded-small px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-secondary"
          >
            <p.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowCalendar((v) => !v)}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-small px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-secondary",
            showCalendar && "bg-secondary",
          )}
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
          Pick date…
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="flex w-full items-center gap-2.5 rounded-small px-2.5 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
          >
            <CalendarX className="h-4 w-4 shrink-0" />
            Remove date
          </button>
        )}
      </div>

      <div
        className={cn(
          "grid overflow-hidden transition-all duration-300 ease-out",
          showCalendar ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0">
          <div className="border-t border-border">
            <Calendar
              mode="single"
              selected={selected}
              onSelect={(d) => {
                if (d) onChange(toISO(d));
              }}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

