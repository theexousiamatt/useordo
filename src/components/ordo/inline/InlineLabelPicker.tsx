import { useMemo, useRef, useState } from "react";
import { Check, Pencil, Plus, Search, Tag, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { LabelBadge } from "@/components/ordo/LabelBadge";
import { LABEL_COLORS, type LabelColor } from "@/lib/labelColors";
import type { ProjectLabel } from "@/hooks/useLabels";

interface InlineLabelPickerProps {
  /** All labels defined in the active project. */
  labels: ProjectLabel[];
  /** Ids of labels currently assigned to the task. */
  value: string[];
  onToggle: (labelId: string) => void;
  onCreate: (name: string, color: LabelColor) => void;
  onRename: (labelId: string, name: string) => void;
  onRecolor: (labelId: string, color: LabelColor) => void;
  onDelete: (labelId: string) => void;
}

/**
 * InlineLabelPicker — THE single label management surface, reused on the board
 * popover and anywhere labels are edited. Search, toggle assignment, create,
 * rename, recolor and delete — all scoped to the active project. Stays open so
 * several labels can be toggled in one pass.
 */
export function InlineLabelPicker({
  labels,
  value,
  onToggle,
  onCreate,
  onRename,
  onRecolor,
  onDelete,
}: InlineLabelPickerProps) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...labels]
      .filter((l) => l.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const aSel = value.includes(a.id) ? 0 : 1;
        const bSel = value.includes(b.id) ? 0 : 1;
        if (aSel !== bSel) return aSel - bSel;
        return a.position - b.position || a.name.localeCompare(b.name);
      });
  }, [labels, query, value]);

  const exactExists = labels.some((l) => l.name.toLowerCase() === query.trim().toLowerCase());

  const create = () => {
    const name = query.trim();
    if (!name || exactExists) return;
    onCreate(name, "gray");
    setQuery("");
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
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

      <div className="max-h-72 overflow-y-auto p-1.5">
        {filtered.map((label) =>
          editing === label.id ? (
            <LabelEditRow
              key={label.id}
              label={label}
              onRename={(name) => onRename(label.id, name)}
              onRecolor={(color) => onRecolor(label.id, color)}
              onDelete={() => {
                onDelete(label.id);
                setEditing(null);
              }}
              onDone={() => setEditing(null)}
            />
          ) : (
            <div
              key={label.id}
              className="group/row flex items-center gap-1 rounded-small hover:bg-secondary"
            >
              <button
                type="button"
                onClick={() => onToggle(label.id)}
                className="flex min-w-0 flex-1 items-center justify-between gap-2 px-2.5 py-1.5 text-left"
              >
                <LabelBadge name={label.name} color={label.color} />
                {value.includes(label.id) && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </button>
              <button
                type="button"
                onClick={() => setEditing(label.id)}
                aria-label={`Edit ${label.name}`}
                className="mr-1 shrink-0 rounded-small p-1 text-muted-foreground opacity-100 transition-opacity hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:opacity-0 sm:group-hover/row:opacity-100 sm:focus:opacity-100"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          ),
        )}

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

        {labels.length === 0 && !query.trim() && (
          <p className="flex items-center justify-center gap-1.5 px-2.5 py-4 text-center text-xs text-muted-foreground">
            <Tag className="h-3.5 w-3.5" />
            No labels yet. Type to create one.
          </p>
        )}

        {labels.length > 0 && filtered.length === 0 && query.trim() && exactExists && (
          <p className="px-2.5 py-3 text-center text-xs text-muted-foreground">No labels found.</p>
        )}
      </div>
    </div>
  );
}

function LabelEditRow({
  label,
  onRename,
  onRecolor,
  onDelete,
  onDone,
}: {
  label: ProjectLabel;
  onRename: (name: string) => void;
  onRecolor: (color: LabelColor) => void;
  onDelete: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(label.name);
  const initial = useRef(label.name);

  const commitName = () => {
    const next = name.trim();
    if (next && next !== initial.current) {
      onRename(next);
      initial.current = next;
    }
  };

  return (
    <div className="rounded-small bg-secondary/60 p-2">
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitName();
              onDone();
            }
            if (e.key === "Escape") onDone();
          }}
          className="w-full rounded-small border border-border bg-card px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${label.name}`}
          className="shrink-0 rounded-small p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 px-0.5">
        {LABEL_COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            aria-label={c.label}
            onClick={() => onRecolor(c.value)}
            className={cn(
              "h-5 w-5 rounded-full ring-offset-1 transition-transform hover:scale-110",
              c.swatch,
              label.color === c.value && cn("ring-2", c.ring),
            )}
          />
        ))}
      </div>
    </div>
  );
}
