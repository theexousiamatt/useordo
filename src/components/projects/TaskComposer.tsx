import { useState, type FormEvent, type KeyboardEvent, type PointerEvent, type MouseEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  stageName: string;
  onAdd: (title: string) => Promise<void>;
  onCancel: () => void;
  disabled?: boolean;
}

/**
 * Task creation lives OUTSIDE the board's drag/drop and sortable card surface.
 * A dedicated layer and touch-safe controls prevent cards from intercepting taps.
 */
export function TaskComposer({ stageName, onAdd, onCancel, disabled = false }: Props) {
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const busy = disabled || submitting;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = title.trim();
    if (!next || busy) return;
    setSubmitting(true);
    try {
      await onAdd(next);
      setTitle("");
      onCancel();
    } catch {
      // Keep the user's input for a retry instead of dismissing a failed draft.
      toast.error("Couldn't create this task. Your title is still here to retry.");
    } finally {
      setSubmitting(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape" && !busy) {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    }
    // Enter is handled by the form's native submit path, including mobile keyboards.
  };

  const stopPointer = (event: PointerEvent<HTMLFormElement>) => event.stopPropagation();
  const stopClick = (event: MouseEvent<HTMLFormElement>) => event.stopPropagation();

  return (
    <form
      aria-label={`New task in ${stageName}`}
      onSubmit={submit}
      onPointerDown={stopPointer}
      onClick={stopClick}
      className="relative z-20 isolate mb-3 shrink-0 rounded-card border border-border bg-card p-3 shadow-subtle pointer-events-auto"
    >
      <Input
        autoFocus
        value={title}
        onChange={event => setTitle(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Task title…"
        aria-label="Task title"
        enterKeyHint="done"
        maxLength={255}
        disabled={busy}
        className="min-h-11 touch-manipulation"
      />
      <div className="mt-3 flex items-center gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={busy || !title.trim()}
          className="min-h-11 min-w-20 touch-manipulation"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {busy ? "Adding…" : "Add"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          className="min-h-11 touch-manipulation"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
