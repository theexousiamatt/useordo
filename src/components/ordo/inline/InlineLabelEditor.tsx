import { useMemo, useState } from "react";
import { Check, Plus, Tag, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineLabelEditorProps {
  /** Labels currently on the task. */
  value: string[];
  /** All labels used across the project, for quick reuse. */
  suggestions?: string[];
  onChange: (next: string[]) => void;
}

/**
 * InlineLabelEditor — lightweight popover body to manage task labels.
 * Search, toggle, create. Changes persist instantly (no Save button).
 * Reusable across every task surface.
 */
export function InlineLabelEditor({ value, suggestions = [], onChange }: InlineLabelEditorProps) {
  const [query, setQuery] = useState("");

  const all = useMemo(() => {
    const set = new Set<string>([...value, ...suggestions]);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [value, suggestions]);

  const filtered = useMemo(
    () => all.filter((l) => l.toLowerCase().includes(query.trim().toLowerCase())),
    [all, query],
  );

  const exactExists = all.some((l) => l.toLowerCase() === query.trim().toLowerCase());

  const toggle = (label: string) => {
    onChange(value.includes(label) ? value.filter((l) => l !== label) : [...value, label]);
  };

  const create = () => {
    const next = query.trim();
    if (!next || value.includes(next)) return;
    onChange([...value, next]);
    setQuery("");
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <Tag className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && query.trim() && !exactExists) {
              e.preventDefault();
              create();
            }
          }}
          placeholder="Search or create label…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
        />
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-border px-3 py-2.5">
          {value.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => toggle(label)}
              className="group inline-flex items-center gap-1 rounded-pill bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
            >
              {label}
              <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
            </button>
          ))}
        </div>
      )}

      <div className="max-h-56 overflow-y-auto p-1.5">
        {filtered.map((label) => {
          const active = value.includes(label);
          return (
            <button
              key={label}
              type="button"
              onClick={() => toggle(label)}
              className="flex w-full items-center justify-between gap-2 rounded-small px-2.5 py-1.5 text-left text-sm hover:bg-secondary"
            >
              <span className="truncate">{label}</span>
              {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
            </button>
          );
        })}

        {query.trim() && !exactExists && (
          <button
            type="button"
            onClick={create}
            className="flex w-full items-center gap-2 rounded-small px-2.5 py-1.5 text-left text-sm text-primary hover:bg-secondary"
          >
            <Plus className="h-4 w-4 shrink-0" />
            Create “{query.trim()}”
          </button>
        )}

        {filtered.length === 0 && !query.trim() && (
          <p className={cn("px-2.5 py-3 text-center text-xs text-muted-foreground")}>
            No labels yet. Type to create one.
          </p>
        )}
      </div>
    </div>
  );
}
