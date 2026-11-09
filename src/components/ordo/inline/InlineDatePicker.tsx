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
              classNames={{
                month_caption: "flex justify-center items-center relative pt-1 pb-2 px-9",
                caption_label: "text-sm font-semibold text-foreground",
                nav: "flex items-center",
                button_previous: "h-7 w-7 inline-flex items-center justify-center rounded-small border border-border bg-card text-muted-foreground opacity-100 shadow-subtle transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40 absolute left-1 top-0",
                button_next: "h-7 w-7 inline-flex items-center justify-center rounded-small border border-border bg-card text-muted-foreground opacity-100 shadow-subtle transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40 absolute right-1 top-0",
                weekday:
                  "text-muted-foreground rounded-md w-9 font-medium text-[0.72rem] uppercase tracking-wide",
                day: "h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
                day_button: "h-9 w-9 p-0 font-normal rounded-small inline-flex items-center justify-center transition-colors hover:bg-secondary hover:text-foreground aria-selected:opacity-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/40",
                selected:
                  "[&>button]:bg-primary [&>button]:text-primary-foreground",
                today:
                  "bg-secondary font-semibold text-foreground ring-1 ring-inset ring-primary/40",
                outside: "text-muted-foreground/50",
                disabled: "text-muted-foreground opacity-40",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

