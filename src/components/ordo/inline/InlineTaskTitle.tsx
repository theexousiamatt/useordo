import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface InlineTaskTitleProps {
  value: string;
  onSave: (next: string) => void | Promise<void>;
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
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

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

  const commit = async () => {
    if (committed.current) return;
    const next = read();
    if (!next) {
      // Empty is invalid — surface a hint and keep editing.
      setError("Title cannot be empty.");
      ref.current?.focus();
      return;
    }
    committed.current = true;
    if (next === value) { onCancel(); return; }
    setPending(true);
    setError("");
    try { await onSave(next); }
    catch { committed.current = false; setError("Couldn’t save. Your title is still here; press Enter to retry."); }
    finally { setPending(false); }
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
        contentEditable={!pending}
        aria-busy={pending}
        suppressContentEditableWarning
        spellCheck={false}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onInput={() => {
          if (error && read()) setError("");
        }}
        onPaste={(e) => {
          // Force plain text and strip newlines to stay single-line.
          e.preventDefault();
          const text = e.clipboardData.getData("text/plain").replace(/\s+/g, " ");
          document.execCommand("insertText", false, text);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        onBlur={() => {
          // Ignore spurious blur right after entering edit mode (menu close /
          // re-render). Reclaim focus instead of exiting.
          if (committed.current) return;
          if (focusedAt.current === 0 || Date.now() - focusedAt.current < 250) {
            requestAnimationFrame(() => ref.current?.focus());
            return;
          }
          // Intentional blur saves; an empty value cancels.
          if (!read()) cancel();
          else void commit();
        }}
        className={cn(
          "text-sm font-semibold leading-snug text-foreground outline-hidden",
          "cursor-text whitespace-pre-wrap break-words",
          className,
        )}
      />
      {pending && <span role="status" className="block text-xs text-muted-foreground">Saving…</span>}
      {error && (
        <span role="alert" className="mt-1 block text-[11px] font-medium text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}
