import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { Plus, Loader2, MoreHorizontal, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { TASK_COLUMNS, type TaskStatus, type TaskPriority, PRIORITIES } from "@/lib/projectConstants";
import { OrdoTaskCard, COLUMN_THEME } from "@/components/ordo/OrdoTaskCard";
import {
  OrdoCardContextMenu,
  OrdoCardOverflowMenu,
  OrdoColumnContextMenu,
  OrdoColumnOverflowMenu,
  OrdoBulkActionMenu,
  OrdoQuickEditPanel,
  InlineTaskTitle,
  InlineLabelEditor,
  InlineMemberPicker,
  InlineDatePicker,
  type TaskMenuHandlers,
  type TaskMoveTarget,
  type ColumnMenuHandlers,
  type BulkActionHandlers,
  type QuickEditPatch,
} from "@/components/ordo";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import {
  useCreateTask,
  useReorderTasks,
  useUpdateTask,
  useDeleteTask,
  useDuplicateTask,
  useArchiveTask,
  useBulkUpdateTasks,
  useBulkDeleteTasks,
  type TaskRow,
} from "@/hooks/useProjectData";
import type { ProjectMemberProfile } from "@/hooks/useProjects";
import { useProjects } from "@/hooks/useProjects";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  projectId: string;
  workspaceId: string;
  tasks: TaskRow[];
  members: ProjectMemberProfile[];
}

type PendingDelete = { type: "single"; task: TaskRow } | { type: "bulk"; ids: string[] } | null;

const STATUS_ORDER = TASK_COLUMNS.map((c) => c.id);
const PRIORITY_ORDER = PRIORITIES.map((p) => p.value);

export function ProjectBoard({ projectId, workspaceId, tasks, members }: Props) {
  const qc = useQueryClient();
  const { role } = useWorkspace();
  const createTask = useCreateTask(projectId, workspaceId);
  const reorder = useReorderTasks(projectId);
  const update = useUpdateTask(projectId);
  const del = useDeleteTask(projectId);
  const dup = useDuplicateTask(projectId, workspaceId);
  const archive = useArchiveTask(projectId);
  const bulkUpdate = useBulkUpdateTasks(projectId);
  const bulkDelete = useBulkDeleteTasks(projectId);

  // Move-to-project targets — only for owners/managers, excluding this project.
  const canMoveProject = role === "owner" || role === "manager";
  const { data: allProjects } = useProjects();
  const moveTargets: TaskMoveTarget[] = useMemo(
    () =>
      canMoveProject
        ? (allProjects ?? [])
            .filter((p) => p.id !== projectId && !p.archived_at)
            .map((p) => ({ id: p.id, name: p.name }))
        : [],
    [allProjects, canMoveProject, projectId],
  );


  const [items, setItems] = useState<TaskRow[]>(tasks);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Interaction state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [editTask, setEditTask] = useState<TaskRow | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [collapsed, setCollapsed] = useState<Set<TaskStatus>>(() => {
    try {
      const raw = localStorage.getItem(`ordo:collapsed:${projectId}`);
      return new Set(raw ? (JSON.parse(raw) as TaskStatus[]) : []);
    } catch {
      return new Set();
    }
  });

  useEffect(() => setItems(tasks), [tasks]);
  useEffect(() => {
    localStorage.setItem(`ordo:collapsed:${projectId}`, JSON.stringify([...collapsed]));
  }, [collapsed, projectId]);

  const memberMap = useMemo(() => new Map(members.map((m) => [m.user_id, m])), [members]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const byStatus = (status: TaskStatus) =>
    items.filter((t) => t.status === status).sort((a, b) => a.position - b.position);

  const activeTask = items.find((t) => t.id === activeId) ?? null;

  const openQuickEdit = useCallback((t: TaskRow) => {
    setEditTask(t);
    setEditOpen(true);
  }, []);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const stub = useCallback((label: string) => toast(`${label} — coming soon`), []);

  // ---------------- Card actions ----------------
  const cardHandlers: TaskMenuHandlers = {
    onOpen: openQuickEdit,
    onQuickEdit: openQuickEdit,
    onRename: openQuickEdit,
    onMoveStatus: (t, status) => update.mutate({ id: t.id, status }),
    onDuplicate: (t) => dup.mutate(t),
    onMarkComplete: (t) => update.mutate({ id: t.id, status: "done" }),
    onReopen: (t) => update.mutate({ id: t.id, status: "todo" }),
    onAssign: (t, userId) => update.mutate({ id: t.id, assignee_id: userId }),
    onSetPriority: (t, priority) => update.mutate({ id: t.id, priority }),
    onCopyLink: (t) => {
      navigator.clipboard?.writeText(`${window.location.origin}/projects/${projectId}?task=${t.id}`);
      toast.success("Task link copied");
    },
    onDelete: (t) => setPendingDelete({ type: "single", task: t }),
    onAction: (_t, action) => stub(action),
  };

  const quickSave = (id: string, patch: QuickEditPatch) => update.mutate({ id, ...patch });

  // ---------------- Column actions ----------------
  const columnHandlers: ColumnMenuHandlers = {
    onAddTask: (status) => createTask.mutate({ title: "New task", status }),
    onToggleCollapse: (status) =>
      setCollapsed((prev) => {
        const next = new Set(prev);
        next.has(status) ? next.delete(status) : next.add(status);
        return next;
      }),
    onAction: (_status, action) => stub(action),
  };

  // ---------------- Bulk actions ----------------
  const selectedIds = useMemo(() => [...selected], [selected]);
  const bulkHandlers: BulkActionHandlers = {
    onAssign: (userId) => {
      bulkUpdate.mutate({ ids: selectedIds, patch: { assignee_id: userId } });
      clearSelection();
    },
    onMove: (status) => {
      bulkUpdate.mutate({ ids: selectedIds, patch: { status } });
      clearSelection();
    },
    onSetStatus: (status) => {
      bulkUpdate.mutate({ ids: selectedIds, patch: { status } });
      clearSelection();
    },
    onSetPriority: (priority) => {
      bulkUpdate.mutate({ ids: selectedIds, patch: { priority } });
      clearSelection();
    },
    onDelete: () => setPendingDelete({ type: "bulk", ids: selectedIds }),
    onAction: (action) => stub(action),
  };

  // ---------------- Selection ----------------
  const handleSelect = useCallback(
    (e: React.MouseEvent, taskId: string) => {
      setFocusedId(taskId);
      if (e.metaKey || e.ctrlKey) {
        setSelected((prev) => {
          const next = new Set(prev);
          next.has(taskId) ? next.delete(taskId) : next.add(taskId);
          return next;
        });
      } else if (e.shiftKey) {
        setSelected((prev) => new Set(prev).add(taskId));
      } else {
        setSelected(new Set([taskId]));
      }
    },
    [],
  );

  // ---------------- Keyboard shortcuts ----------------
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable)) return;
      if (editOpen) return;

      if (selected.size > 1) {
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          setPendingDelete({ type: "bulk", ids: [...selected] });
        }
        if (e.key === "Escape") clearSelection();
        return;
      }

      const id = focusedId ?? (selected.size === 1 ? [...selected][0] : null);
      const task = items.find((t) => t.id === id);
      if (e.key === "Escape") clearSelection();
      if (!task) return;

      switch (e.key.toLowerCase()) {
        case "e":
        case "enter":
          e.preventDefault();
          openQuickEdit(task);
          break;
        case "d":
          e.preventDefault();
          dup.mutate(task);
          break;
        case "m": {
          e.preventDefault();
          const idx = STATUS_ORDER.indexOf(task.status);
          update.mutate({ id: task.id, status: STATUS_ORDER[(idx + 1) % STATUS_ORDER.length] });
          break;
        }
        case "p": {
          e.preventDefault();
          const pi = PRIORITY_ORDER.indexOf(task.priority);
          update.mutate({ id: task.id, priority: PRIORITY_ORDER[(pi + 1) % PRIORITY_ORDER.length] as TaskPriority });
          break;
        }
        default:
          if (e.key === "Delete" || e.key === "Backspace") {
            e.preventDefault();
            setPendingDelete({ type: "single", task });
          }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [items, focusedId, selected, editOpen, openQuickEdit, dup, update, clearSelection]);

  // ---------------- Drag & drop ----------------
  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const activeTaskItem = items.find((t) => t.id === active.id);
    if (!activeTaskItem) return;

    const overId = String(over.id);
    const overTask = items.find((t) => t.id === overId);
    const targetStatus = (overTask?.status ?? overId) as TaskStatus;
    if (!TASK_COLUMNS.some((c) => c.id === targetStatus)) return;

    const next = items.map((t) => ({ ...t }));
    const moving = next.find((t) => t.id === active.id)!;
    moving.status = targetStatus;

    const affected = new Set<TaskStatus>([activeTaskItem.status, targetStatus]);
    const updates: { id: string; status: TaskStatus; position: number }[] = [];
    affected.forEach((status) => {
      next
        .filter((t) => t.status === status)
        .sort((a, b) => (a.id === active.id ? -0.5 : a.position) - (b.id === active.id ? -0.5 : b.position))
        .forEach((t, idx) => {
          t.position = idx;
          updates.push({ id: t.id, status, position: idx });
        });
    });

    setItems(next);
    qc.setQueryData(["project-tasks", projectId], next);
    reorder.mutate(updates);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    if (pendingDelete.type === "single") {
      del.mutate(pendingDelete.task.id);
      setSelected((prev) => {
        const n = new Set(prev);
        n.delete(pendingDelete.task.id);
        return n;
      });
    } else {
      bulkDelete.mutate(pendingDelete.ids);
      clearSelection();
    }
    setPendingDelete(null);
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {TASK_COLUMNS.map((col) => (
            <Column
              key={col.id}
              id={col.id}
              title={col.title}
              tasks={byStatus(col.id)}
              memberMap={memberMap}
              members={members}
              collapsed={collapsed.has(col.id)}
              selected={selected}
              cardHandlers={cardHandlers}
              columnHandlers={columnHandlers}
              onSelectCard={handleSelect}
              onOpenCard={openQuickEdit}
              onAdd={(title) => createTask.mutate({ title, status: col.id })}
              adding={createTask.isPending}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask && (
            <div className="w-72">
              <OrdoTaskCard
                title={activeTask.title}
                status={activeTask.status}
                priority={activeTask.priority}
                description={activeTask.description}
                dueDate={activeTask.due_date}
                assignees={memberMap.get(activeTask.assignee_id ?? "") ? [memberMap.get(activeTask.assignee_id ?? "")!] : []}
                interactive={false}
                overlay
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <OrdoBulkActionMenu
        count={selected.size}
        members={members}
        handlers={bulkHandlers}
        onClear={clearSelection}
      />

      <OrdoQuickEditPanel
        task={editTask}
        members={members}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={quickSave}
        saving={update.isPending}
      />

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent className="client-os rounded-panel">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDelete?.type === "bulk"
                ? `Delete ${pendingDelete.ids.length} tasks?`
                : "Delete task?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The selected work will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Column({
  id,
  title,
  tasks,
  memberMap,
  members,
  collapsed,
  selected,
  cardHandlers,
  columnHandlers,
  onSelectCard,
  onOpenCard,
  onAdd,
  adding,
}: {
  id: TaskStatus;
  title: string;
  tasks: TaskRow[];
  memberMap: Map<string, ProjectMemberProfile>;
  members: ProjectMemberProfile[];
  collapsed: boolean;
  selected: Set<string>;
  cardHandlers: TaskMenuHandlers;
  columnHandlers: ColumnMenuHandlers;
  onSelectCard: (e: React.MouseEvent, id: string) => void;
  onOpenCard: (t: TaskRow) => void;
  onAdd: (title: string) => void;
  adding: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const [composing, setComposing] = useState(false);
  const [value, setValue] = useState("");
  const theme = COLUMN_THEME[id];

  const submit = () => {
    if (value.trim()) {
      onAdd(value.trim());
      setValue("");
      setComposing(false);
    }
  };

  if (collapsed) {
    return (
      <OrdoColumnContextMenu status={id} collapsed handlers={columnHandlers}>
        <div className="flex w-12 shrink-0 flex-col items-center gap-3 rounded-card border border-border bg-card py-3">
          <button
            onClick={() => columnHandlers.onToggleCollapse(id)}
            className="text-muted-foreground hover:text-foreground"
            aria-label={`Expand ${title}`}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className={cn("h-2 w-2 rounded-full", theme.dot)} />
          <span
            className={cn("text-sm font-semibold [writing-mode:vertical-rl]", theme.header)}
          >
            {title} · {tasks.length}
          </span>
        </div>
      </OrdoColumnContextMenu>
    );
  }

  return (
    <div className="flex w-72 shrink-0 flex-col">
      <OrdoColumnContextMenu status={id} collapsed={false} handlers={columnHandlers}>
        <div className="mb-3 flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", theme.dot)} />
            <span className={cn("text-sm font-semibold", theme.header)}>{title}</span>
            <span className="rounded-pill bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {tasks.length}
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setComposing(true)}
              aria-label={`Add task to ${title}`}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <OrdoColumnOverflowMenu
              status={id}
              collapsed={false}
              handlers={columnHandlers}
              trigger={
                <Button variant="ghost" size="icon" className="h-6 w-6" aria-label={`${title} column actions`}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              }
            />
          </div>
        </div>
      </OrdoColumnContextMenu>

      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-24 flex-1 flex-col gap-3 rounded-card border border-dashed border-transparent p-1.5 transition-colors",
          isOver && "border-primary/30 bg-primary/5",
        )}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <SortableTask
              key={t.id}
              task={t}
              member={memberMap.get(t.assignee_id ?? "")}
              members={members}
              selected={selected.has(t.id)}
              handlers={cardHandlers}
              onSelect={onSelectCard}
              onOpen={onOpenCard}
            />
          ))}
        </SortableContext>

        {composing && (
          <div className="rounded-card border border-border bg-card p-2">
            <Input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Task title…"
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
                if (e.key === "Escape") {
                  setComposing(false);
                  setValue("");
                }
              }}
              onBlur={() => {
                if (!value.trim()) setComposing(false);
              }}
            />
            <div className="mt-2 flex items-center gap-2">
              <Button size="sm" onClick={submit} disabled={adding}>
                {adding && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                Add
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setComposing(false); setValue(""); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SortableTask({
  task,
  member,
  members,
  selected,
  handlers,
  onSelect,
  onOpen,
}: {
  task: TaskRow;
  member?: ProjectMemberProfile;
  members: ProjectMemberProfile[];
  selected: boolean;
  handlers: TaskMenuHandlers;
  onSelect: (e: React.MouseEvent, id: string) => void;
  onOpen: (t: TaskRow) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  return (
    <OrdoCardContextMenu task={task} members={members} handlers={handlers}>
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        aria-label={`Task: ${task.title}`}
        onClick={(e) => onSelect(e, task.id)}
        onDoubleClick={() => onOpen(task)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onOpen(task);
          }
        }}
        className={cn(
          "group/card relative rounded-card outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring",
          isDragging && "opacity-40",
          selected && "ring-2 ring-[hsl(178,100%,8%)] ring-offset-2",
        )}
      >
        <OrdoCardOverflowMenu
          task={task}
          members={members}
          handlers={handlers}
          trigger={
            <button
              onClick={(e) => e.stopPropagation()}
              aria-label={`Task actions: ${task.title}`}
              className="absolute right-2 top-2 z-10 rounded-md bg-card/80 p-1 text-muted-foreground opacity-0 shadow-subtle backdrop-blur transition-opacity hover:text-foreground group-hover/card:opacity-100 focus:opacity-100"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          }
        />
        <OrdoTaskCard
          title={task.title}
          status={task.status}
          priority={task.priority}
          description={task.description}
          dueDate={task.due_date}
          assignees={member ? [member] : []}
          interactive={false}
          dragHandleProps={{ ...attributes, ...listeners }}
        />
      </div>
    </OrdoCardContextMenu>
  );
}
