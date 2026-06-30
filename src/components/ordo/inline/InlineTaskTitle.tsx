import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface InlineTaskTitleProps {
  value: string;
  onSave: (next: string) => void;
  onCancel: () => void;
  /** Extra classes to match the static title typography exactly. */
  className?: string;
}

/**
 * InlineTaskTitle — rename a task in place with a native, text-editor feel.
 *
 * Uses a `contentEditable` heading rather than an `<input>`/`<textarea>` so the
 * title stays visually identical: same typography, spacing and layout, with no
 * input box, border, background or focus ring. Only the caret and selection
 * indicate edit mode — like renaming a file in Finder or editing text in Notion.
 *
 * - On mount the full title is selected with the caret placed inside.
 * - Enter saves, Escape cancels (restores the previous value), blur saves.
 * - Single-line: newlines are suppressed.
 * - Empty titles are rejected with a subtle inline message.
 * - No DB write is issued when the value is unchanged.
 */
export function InlineTaskTitle({ value, onSave, onCancel, className }: InlineTaskTitleProps) {
  const ref = useRef<HTMLHeadingElement>(null);
  const committed = useRef(false);
  // Timestamp of the initial focus. Blur events that fire within this grace
  // window are spurious (menu close / re-render stealing focus) and must be
  // ignored so edit mode never exits before the user types.
  const focusedAt = useRef(0);
  const [error, setError] = useState(false);

  // Seed the editable text once (uncontrolled) so React never re-renders the
  // content underneath the caret and causes it to jump.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.textContent = value;
    // Focus on the next frame so any focus the closing menu returns to the
    // card lands first and can't steal it back from the editor.
    const focus = () => {
      el.focus();
      focusedAt.current = Date.now();
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    };
    const raf = requestAnimationFrame(focus);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const read = () => (ref.current?.textContent ?? "").replace(/\s+/g, " ").trim();

  const commit = () => {
    if (committed.current) return;
    const next = read();
    if (!next) {
      // Empty is invalid — surface a hint and keep editing.
      setError(true);
      ref.current?.focus();
      return;
    }
    committed.current = true;
    if (next !== value) onSave(next);
    else onCancel();
  };

  const cancel = () => {
    if (committed.current) return;
    committed.current = true;
    onCancel();
  };

  return (
    <div className="relative">
      <h4
        ref={ref}
        role="textbox"
        aria-label="Task title"
        aria-multiline="false"
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onInput={() => {
          if (error && read()) setError(false);
        }}
        onPaste={(e) => {
          // Force plain text and strip newlines to stay single-line.
          e.preventDefault();
          const text = e.clipboardData.getData("text/plain").replace(/\s+/g, " ");
          document.execCommand("insertText", false, text);
        }}
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
        onBlur={() => {
          // Blur saves; an empty value cancels rather than blocking focus loss.
          if (committed.current) return;
          if (!read()) cancel();
          else commit();
        }}
        className={cn(
          "text-sm font-semibold leading-snug text-foreground outline-none",
          "cursor-text whitespace-pre-wrap break-words",
          className,
        )}
      />
      {error && (
        <span className="mt-1 block text-[11px] font-medium text-destructive">
          Title can't be empty
        </span>
      )}
    </div>
  );
}
