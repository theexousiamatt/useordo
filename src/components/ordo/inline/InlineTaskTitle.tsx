import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface InlineTaskTitleProps {
  value: string;
  onSave: (next: string) => void;
  onCancel: () => void;
  className?: string;
}

/**
 * InlineTaskTitle — edit a task title in place without a drawer or modal.
 * Enter saves, Escape cancels, blur saves. Auto-resizes as the user types.
 * Reusable across Board, List, Calendar and future Timeline views.
 */
export function InlineTaskTitle({ value, onSave, onCancel, className }: InlineTaskTitleProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState(value);
  const committed = useRef(false);

  const autosize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.select();
    autosize();
  }, []);

  const commit = () => {
    if (committed.current) return;
    committed.current = true;
    const next = draft.trim();
    if (next && next !== value) onSave(next);
    else onCancel();
  };

  const cancel = () => {
    if (committed.current) return;
    committed.current = true;
    onCancel();
  };

  return (
    <textarea
      ref={ref}
      rows={1}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        autosize();
      }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          cancel();
        }
      }}
      onBlur={commit}
      className={cn(
        "w-full resize-none overflow-hidden rounded-small border border-primary/40 bg-card px-2 py-1 text-sm font-semibold leading-snug text-foreground shadow-subtle outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        className,
      )}
    />
  );
}
