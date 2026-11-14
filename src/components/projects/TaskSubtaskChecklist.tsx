import { useMemo, useState, type FormEvent } from "react";
import { CheckSquare, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useProjectSubtasks, useSubtaskActions } from "@/hooks/useSubtasks";

/** Checklist in task details. The board consumes the same query to derive card progress. */
export function TaskSubtaskChecklist({ projectId, taskId }: { projectId: string; taskId: string }) {
  const [title, setTitle] = useState("");
  const query = useProjectSubtasks(projectId);
  const action = useSubtaskActions(projectId);
  const items = useMemo(
    () => (query.data ?? []).filter(item => item.task_id === taskId),
    [query.data, taskId],
  );
  const done = items.filter(item => item.completed).length;

  const create = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const clean = title.trim();
    if (!clean || action.isPending) return;
    const position = items.reduce((max, item) => Math.max(max, item.position), -1) + 1;
    void action.mutateAsync({ type: "create", taskId, title: clean, position })
      .then(() => setTitle(""))
      .catch(() => { /* mutation displays the failure */ });
  };

  return (
    <section aria-label="Subtasks" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <CheckSquare className="h-4 w-4" />
          Subtasks
        </h3>
        {items.length > 0 && (
          <span className="text-xs tabular-nums text-muted-foreground">{done} of {items.length} complete</span>
        )}
      </div>
      {query.isError && (
        <div role="alert" className="flex items-center justify-between gap-2 text-sm text-destructive">
          Could not load subtasks.
          <Button type="button" size="sm" variant="outline" onClick={() => void query.refetch()}>Retry</Button>
        </div>
      )}
      {query.isLoading && <p role="status" className="text-xs text-muted-foreground">Loading subtasks…</p>}
      {query.isSuccess && items.length === 0 && (
        <p className="text-xs text-muted-foreground">Add a subtask to break this work into smaller steps.</p>
      )}
      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map(item => (
            <div key={item.id} className="group/subtask flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/40">
              <Checkbox checked={item.completed} disabled={action.isPending}
                aria-label={`Mark ${item.title} ${item.completed ? "incomplete" : "complete"}`}
                onCheckedChange={checked => action.mutate({
                  type: "toggle", id: item.id, completed: checked === true,
                })} />
              <span className={cn(
                "min-w-0 flex-1 break-words text-sm text-foreground",
                item.completed && "text-muted-foreground line-through",
              )}>
                {item.title}
              </span>
              <button type="button" disabled={action.isPending}
                onClick={() => action.mutate({ type: "delete", id: item.id })}
                aria-label={`Delete subtask ${item.title}`}
                className="rounded-md p-1 text-muted-foreground/65 transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={create} className="flex items-center gap-2">
        <Input value={title} onChange={event => setTitle(event.target.value)}
          placeholder="Add a subtask…" aria-label="New subtask title" maxLength={240}
          disabled={action.isPending || query.isError} className="h-9 flex-1 rounded-lg text-sm" />
        <Button type="submit" size="sm" variant="outline" className="h-9 shrink-0 gap-1.5"
          disabled={!title.trim() || action.isPending || query.isError}>
          {action.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Add
        </Button>
      </form>
    </section>
  );
}
