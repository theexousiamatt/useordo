import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { Plus, GripVertical, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { TASK_COLUMNS, type TaskStatus } from "@/lib/projectConstants";
import { PriorityBadge } from "@/components/projects/ProjectBadges";
import {
  useCreateTask,
  useReorderTasks,
  type TaskRow,
} from "@/hooks/useProjectData";
import type { ProjectMemberProfile } from "@/hooks/useProjects";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  projectId: string;
  workspaceId: string;
  tasks: TaskRow[];
  members: ProjectMemberProfile[];
}

export function ProjectBoard({ projectId, workspaceId, tasks, members }: Props) {
  const qc = useQueryClient();
  const createTask = useCreateTask(projectId, workspaceId);
  const reorder = useReorderTasks(projectId);
  const [items, setItems] = useState<TaskRow[]>(tasks);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => setItems(tasks), [tasks]);

  const memberMap = useMemo(
    () => new Map(members.map((m) => [m.user_id, m])),
    [members],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const byStatus = (status: TaskStatus) =>
    items
      .filter((t) => t.status === status)
      .sort((a, b) => a.position - b.position);

  const activeTask = items.find((t) => t.id === activeId) ?? null;

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const activeTaskItem = items.find((t) => t.id === active.id);
    if (!activeTaskItem) return;

    // Resolve target column: dropping on a column id or on another task.
    const overId = String(over.id);
    const overTask = items.find((t) => t.id === overId);
    const targetStatus = (overTask?.status ?? overId) as TaskStatus;
    if (!TASK_COLUMNS.some((c) => c.id === targetStatus)) return;

    const next = items.map((t) => ({ ...t }));
    const moving = next.find((t) => t.id === active.id)!;
    moving.status = targetStatus;

    // Re-sequence positions within affected columns.
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

  return (
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
            onAdd={(title) => createTask.mutate({ title, status: col.id })}
            adding={createTask.isPending}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask && (
          <TaskCard task={activeTask} member={memberMap.get(activeTask.assignee_id ?? "")} overlay />
        )}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  id,
  title,
  tasks,
  memberMap,
  onAdd,
  adding,
}: {
  id: TaskStatus;
  title: string;
  tasks: TaskRow[];
  memberMap: Map<string, ProjectMemberProfile>;
  onAdd: (title: string) => void;
  adding: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const [composing, setComposing] = useState(false);
  const [value, setValue] = useState("");

  const submit = () => {
    if (value.trim()) {
      onAdd(value.trim());
      setValue("");
      setComposing(false);
    }
  };

  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{title}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {tasks.length}
          </span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setComposing(true)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-24 flex-1 flex-col gap-2 rounded-lg border border-dashed border-transparent p-1 transition-colors",
          isOver && "border-primary/40 bg-primary/5",
        )}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <SortableTask key={t.id} task={t} member={memberMap.get(t.assignee_id ?? "")} />
          ))}
        </SortableContext>

        {composing && (
          <div className="rounded-lg border border-border bg-card p-2">
            <Input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Task title…"
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
                if (e.key === "Escape") { setComposing(false); setValue(""); }
              }}
              onBlur={() => { if (!value.trim()) setComposing(false); }}
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
}: {
  task: TaskRow;
  member?: ProjectMemberProfile;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "opacity-40")}
    >
      <TaskCard task={task} member={member} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

function TaskCard({
  task,
  member,
  dragHandleProps,
  overlay,
}: {
  task: TaskRow;
  member?: ProjectMemberProfile;
  dragHandleProps?: Record<string, unknown>;
  overlay?: boolean;
}) {
  return (
    <Card className={cn("p-3", overlay && "rotate-2 shadow-lg")}>
      <div className="flex items-start gap-1.5">
        <button
          {...dragHandleProps}
          className="mt-0.5 cursor-grab touch-none text-muted-foreground/50 hover:text-muted-foreground"
          aria-label="Drag task"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <p className="flex-1 text-sm leading-snug">{task.title}</p>
      </div>
      <div className="mt-2 flex items-center justify-between pl-5">
        <PriorityBadge priority={task.priority} />
        {member && (
          <Avatar className="h-6 w-6">
            {member.avatar_url && <AvatarImage src={member.avatar_url} alt={member.full_name ?? ""} />}
            <AvatarFallback className="text-[10px]">{initials(member.full_name)}</AvatarFallback>
          </Avatar>
        )}
      </div>
    </Card>
  );
}
