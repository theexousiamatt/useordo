import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  type CollisionDetection,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { Plus, Loader2, MoreHorizontal, ChevronRight, GripVertical } from "lucide-react";
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
import { TASK_COLUMNS, type TaskStatus } from "@/lib/projectConstants";
import { useProjectStages, useProjectStageCommand, type StageCommand } from "@/hooks/useProjectStages";
import { stageForTaskId, stageInsertBefore, moveTaskWithinStages, stageRemovalDestination, resolveStageRemovalDestination, hasStageTasks } from "@/lib/legacyStageBoard";
import { OrdoTaskCard, COLUMN_THEME, type TaskLabelChip } from "@/components/ordo/OrdoTaskCard";
import {
  OrdoCardContextMenu,
  OrdoCardOverflowMenu,
  OrdoColumnContextMenu,
  OrdoColumnOverflowMenu,
  OrdoBulkActionMenu,
  InlineTaskTitle,
  InlineLabelPicker,
  InlineMemberPicker,
  InlineDatePicker,
  type TaskMenuHandlers,
  type TaskMoveTarget,
  type ColumnMenuHandlers,
  type BulkActionHandlers,
} from "@/components/ordo";
import type { LabelColor } from "@/lib/labelColors";
import {
  useProjectLabels,
  useTaskLabelMap,
  useSetTaskLabels,
  useCreateLabel,
  useUpdateLabel,
  useDeleteLabel,
  type ProjectLabel,
} from "@/hooks/useLabels";
import { TaskDetailDrawer } from "@/components/projects/TaskDetailDrawer";
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
  useTaskAssignees,
  useSetTaskAssignees,
  type TaskRow,
} from "@/hooks/useProjectData";
import type { ProjectMemberProfile } from "@/hooks/useProjects";
import { useProjects } from "@/hooks/useProjects";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { sendAppEmail } from "@/lib/email";
import { projectUrl } from "@/lib/appUrl";
import { dateShort } from "@/lib/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  projectId: string;
  workspaceId: string;
  tasks: TaskRow[];
  members: ProjectMemberProfile[];
  /** When set (e.g. from a ?task= deep link), open this task's drawer on mount. */
  initialTaskId?: string | null;
  canConfigureStages?: boolean;
}

type PendingDelete = { type: "single"; task: TaskRow } | { type: "bulk"; ids: string[] } | null;

type InlineMode = "rename" | "labels" | "members" | "due";

/** Shared inline-editing context threaded down to each card. */
interface BoardInlineCtx {
  members: ProjectMemberProfile[];
  projectLabels: ProjectLabel[];
  labelChipsFor: (taskId: string) => TaskLabelChip[];
  labelIdsFor: (taskId: string) => string[];
  toggleLabel: (taskId: string, labelId: string) => void;
  createLabel: (name: string, color: LabelColor) => void;
  renameLabel: (labelId: string, name: string) => void;
  recolorLabel: (labelId: string, color: LabelColor) => void;
  deleteLabel: (labelId: string) => void;
  moveTargets: TaskMoveTarget[];
  stages: {id:string;name:string;category:TaskStatus;position:number}[];
  inline: { id: string; mode: InlineMode } | null;
  setInline: (v: { id: string; mode: InlineMode } | null) => void;
  patchTask: (id: string, patch: Partial<TaskRow>) => void;
  assigneesFor: (task: TaskRow) => ProjectMemberProfile[];
  setTaskAssignees: (taskId: string, userIds: string[]) => void;
}

const stageCollision: CollisionDetection = (args) => {
  const movingStage=String(args.active.id).startsWith("stage:");
  return closestCorners({...args,droppableContainers:args.droppableContainers.filter(item =>
    String(item.id).startsWith("stage:")===movingStage
  )});
};

export function ProjectBoard({ projectId, workspaceId, tasks, members, initialTaskId, canConfigureStages=false }: Props) {
  const qc = useQueryClient();
  const { role, currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const createTask = useCreateTask(projectId, workspaceId);
  const reorder = useReorderTasks(projectId);
  const update = useUpdateTask(projectId);
  const del = useDeleteTask(projectId);
  const dup = useDuplicateTask(projectId, workspaceId);
  const archive = useArchiveTask(projectId);
  const bulkUpdate = useBulkUpdateTasks(projectId);
  const bulkDelete = useBulkDeleteTasks(projectId);
  const { data: assigneesMap } = useTaskAssignees(projectId);
  const setAssignees = useSetTaskAssignees(projectId);
  const stageQuery=useProjectStages(projectId);
  const stages=useMemo(()=>stageQuery.data ?? [],[stageQuery.data]);
  const stageMutation=useProjectStageCommand(projectId);
  const [stageError,setStageError]=useState("");
  const [editingStageId,setEditingStageId]=useState<string|null>(null);
  const [stageName,setStageName]=useState("");
  const [creatingStage,setCreatingStage]=useState(false);
  const [stageCategory,setStageCategory]=useState<TaskStatus>("todo");
  const [removingStageId,setRemovingStageId]=useState<string|null>(null);
  const [removeDestination,setRemoveDestination]=useState("");
  // Count all tasks including archived items hidden from the visible board.
  const removalTaskCount = useQuery({
    queryKey: ["stage-removal-task-count", projectId, removingStageId],
    enabled: Boolean(removingStageId),
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase.from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("stage_id", removingStageId!);
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 0,
    refetchOnMount: "always",
  });
  const stageRequest=useRef<{signature:string;requestId:string}|null>(null);
  const runStage=useCallback((command:Omit<StageCommand,"requestId">,onSuccess?:()=>void)=>{
    if(stageMutation.isPending)return;
    const signature=JSON.stringify(command);
    if(stageRequest.current?.signature!==signature) stageRequest.current={signature,requestId:crypto.randomUUID()};
    const requestId=stageRequest.current.requestId;
    setStageError("");
    void stageMutation.mutateAsync({...command,requestId}).then(()=>{
      stageRequest.current=null;onSuccess?.();
    }).catch((error)=>{
      setStageError(error instanceof Error?error.message:"Could not save stage. Retry the same action.");
    });
  },[stageMutation]);
  const stageForTask=useCallback((task:TaskRow)=>stageForTaskId(task,stages),[stages]);

  // ---------------- Labels ----------------
  const { data: projectLabels = [] } = useProjectLabels(projectId);
  const { data: labelMap } = useTaskLabelMap(projectId);
  const setTaskLabels = useSetTaskLabels(projectId, workspaceId);
  const createLabelMut = useCreateLabel(projectId, workspaceId);
  const updateLabelMut = useUpdateLabel(projectId);
  const deleteLabelMut = useDeleteLabel(projectId);

  const labelById = useMemo(() => {
    const m = new Map<string, ProjectLabel>();
    for (const l of projectLabels) m.set(l.id, l);
    return m;
  }, [projectLabels]);

  const labelIdsFor = useCallback(
    (taskId: string) => labelMap?.get(taskId) ?? [],
    [labelMap],
  );
  const labelChipsFor = useCallback(
    (taskId: string): TaskLabelChip[] =>
      (labelMap?.get(taskId) ?? [])
        .map((id) => labelById.get(id))
        .filter((l): l is ProjectLabel => !!l)
        .map((l) => ({ id: l.id, name: l.name, color: l.color })),
    [labelMap, labelById],
  );
  const toggleLabel = useCallback(
    (taskId: string, labelId: string) => {
      const current = labelMap?.get(taskId) ?? [];
      const next = current.includes(labelId)
        ? current.filter((id) => id !== labelId)
        : [...current, labelId];
      setTaskLabels.mutate({ taskId, labelIds: next });
    },
    [labelMap, setTaskLabels],
  );
  const createLabel = useCallback(
    (name: string, color: LabelColor) => createLabelMut.mutate({ name, color }),
    [createLabelMut],
  );
  const renameLabel = useCallback(
    (labelId: string, name: string) => updateLabelMut.mutate({ id: labelId, name }),
    [updateLabelMut],
  );
  const recolorLabel = useCallback(
    (labelId: string, color: LabelColor) => updateLabelMut.mutate({ id: labelId, color }),
    [updateLabelMut],
  );
  const deleteLabel = useCallback(
    (labelId: string) => deleteLabelMut.mutate(labelId),
    [deleteLabelMut],
  );

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
  // Inline quick-edit state — which card is being edited inline, and how.
  const [inline, setInline] = useState<{ id: string; mode: InlineMode } | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(`ordo:collapsed:${projectId}`);
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  });

  useEffect(() => setItems(tasks), [tasks]);
  useEffect(() => {
    localStorage.setItem(`ordo:collapsed:${projectId}`, JSON.stringify([...collapsed]));
  }, [collapsed, projectId]);

  // Realtime: keep the board in sync with other connected sessions.
  useEffect(() => {
    const channel = supabase
      .channel(`tasks:${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `project_id=eq.${projectId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
          qc.invalidateQueries({ queryKey: ["project-activity", projectId] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_assignees", filter: `project_id=eq.${projectId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["task-assignees", projectId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, qc]);


  const memberMap = useMemo(() => new Map(members.map((m) => [m.user_id, m])), [members]);

  // Resolve a task's assignees to member profiles. Falls back to the legacy
  // single assignee_id while the join-table cache is still loading.
  const assigneesFor = useCallback(
    (task: TaskRow): ProjectMemberProfile[] => {
      const ids = assigneesMap?.get(task.id);
      const list = ids ?? (task.assignee_id ? [task.assignee_id] : []);
      return list.map((id) => memberMap.get(id)).filter(Boolean) as ProjectMemberProfile[];
    },
    [assigneesMap, memberMap],
  );

  // Fire branded assignment emails for members newly added to a task.
  // Email failures are logged only — they never block or roll back the
  // assignment, which has already committed to the database at this point.
  const notifyAssigned = useCallback(
    (task: TaskRow, addedIds: string[]) => {
      const project = (allProjects ?? []).find((p) => p.id === projectId);
      const projectName = project?.name ?? "your project";
      const workspaceName = currentWorkspace?.name ?? "Ordo";
      const assignerName =
        members.find((m) => m.user_id === user?.id)?.full_name ?? user?.email ?? "A teammate";
      const labels = labelChipsFor(task.id).map((c) => c.name);
      const dueDate = task.due_date ? dateShort(task.due_date) : undefined;
      const description = task.description
        ? task.description.length > 240
          ? `${task.description.slice(0, 240)}…`
          : task.description
        : undefined;
      const taskUrl = projectUrl(projectId, task.id);

      for (const uid of addedIds) {
        const member = members.find((m) => m.user_id === uid);
        // Never email yourself; skip members without a resolvable email.
        if (!member?.email || uid === user?.id) continue;
        void sendAppEmail({
          template: "task-assigned",
          entityId: task.id,
          recipientId: uid,
          to: member.email,
          // Timestamped so re-assigning a previously removed member still sends.
          idempotencyKey: `task-assigned-${task.id}-${uid}-${Date.now()}`,
          data: {
            assigneeName: member.full_name ?? "there",
            workspaceName,
            projectName,
            taskTitle: task.title,
            taskDescription: description,
            dueDate,
            labels,
            assignerName,
            assignedAt: new Date().toLocaleString(),
            taskUrl,
          },
        }).catch((err) => {
          console.error("[task-assigned] email delivery failed", { taskId: task.id, uid, err });
        });
      }
    },
    [allProjects, projectId, currentWorkspace, members, user, labelChipsFor],
  );

  const setTaskAssignees = useCallback(
    (taskId: string, userIds: string[]) => {
      // Diff against the current assignees so we only email brand-new additions,
      // never removals or unchanged members.
      const prev = new Set(assigneesMap?.get(taskId) ?? []);
      const added = userIds.filter((id) => !prev.has(id));
      setAssignees.mutate(
        { taskId, userIds },
        {
          onSuccess: () => {
            if (added.length === 0) return;
            const task = items.find((t) => t.id === taskId);
            if (task) notifyAssigned(task, added);
          },
        },
      );
    },
    [setAssignees, assigneesMap, items, notifyAssigned],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const byStage = (id: string) =>
    items.filter((t) => stageForTask(t) === id).sort((a, b) => a.position - b.position);

  const activeTask = items.find((t) => t.id === activeId) ?? null;

  const openTask = useCallback((t: TaskRow) => {
    setEditTask(t);
    setEditOpen(true);
  }, []);

  // Deep-link: open the drawer for the task referenced by ?task= once loaded.
  const deepLinkedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!initialTaskId || deepLinkedRef.current === initialTaskId) return;
    const target = items.find((t) => t.id === initialTaskId);
    if (target) {
      deepLinkedRef.current = initialTaskId;
      openTask(target);
    }
  }, [initialTaskId, items, openTask]);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const patchTask = useCallback(
    (id: string, patch: Partial<TaskRow>) => {
      // Apply the change to local board state AND the query cache synchronously
      // so the new value is on screen the instant the editor closes — before
      // the mutation's async onMutate runs. This prevents a one-frame flash of
      // the stale title when exiting rename mode. The mutation then persists in
      // the background and reconciles silently on success.
      setItems((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      qc.setQueryData<TaskRow[]>(["project-tasks", projectId], (old) =>
        (old ?? []).map((t) => (t.id === id ? { ...t, ...patch } : t)),
      );
      update.mutate({ id, ...patch });
    },
    [update, qc, projectId],
  );

  const startInline = useCallback((t: TaskRow, mode: InlineMode) => setInline({ id: t.id, mode }), []);
  const closeInline = useCallback(() => setInline(null), []);

  const copyLink = useCallback(
    (t: TaskRow) => {
      navigator.clipboard?.writeText(projectUrl(projectId, t.id));
      toast.success("Task link copied");
    },
    [projectId],
  );

  // ---------------- Card actions ----------------
  const cardHandlers: TaskMenuHandlers = {
    onOpen: openTask,
    onRename: (t) => startInline(t, "rename"),
    onEditLabels: (t) => startInline(t, "labels"),
    onEditMembers: (t) => startInline(t, "members"),
    onEditDueDate: (t) => startInline(t, "due"),
    onMoveStatus: (t, status) => {
      const destination=stages.find(stage=>stage.category===status);
      if(!destination){toast.error("No stage currently uses this status.");return;}
      update.mutate({id:t.id,status,stage_id:destination.id});
    },
    onMoveStage: (task,stageId) => {
      const destination=stages.find(stage=>stage.id===stageId);
      if(destination)update.mutate({id:task.id,stage_id:destination.id,status:destination.category});
    },
    onMoveProject: (t, targetProjectId) =>
      update.mutate({ id: t.id, project_id: targetProjectId }),
    onDuplicate: (t) => dup.mutate(t),
    onCopyLink: copyLink,
    onArchive: (t) => archive.mutate(t.id),
    onDelete: (t) => setPendingDelete({ type: "single", task: t }),
  };

  // Keep the open drawer in sync with the live task list (optimistic updates).
  const liveEditTask = editTask ? items.find((t) => t.id === editTask.id) ?? editTask : null;

  const inlineCtx: BoardInlineCtx = {
    members,
    projectLabels,
    labelChipsFor,
    labelIdsFor,
    toggleLabel,
    createLabel,
    renameLabel,
    recolorLabel,
    deleteLabel,
    moveTargets,
    stages,
    inline,
    setInline,
    patchTask,
    assigneesFor,
    setTaskAssignees,
  };


  const stub = useCallback((label: string) => toast(`${label} — coming soon`), []);

  // ---------------- Column actions ----------------
  const columnHandlers: ColumnMenuHandlers = {
    onAddTask: (id) => {
      const stage=stages.find(item=>item.id===id);
      if(stage)createTask.mutate({title:"New task",status:stage.category,stage_id:stage.id});
    },
    onToggleCollapse: (id) =>
      setCollapsed((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    onAction: (id, action) => {
      if(!canConfigureStages){toast.error("You do not have permission to configure stages.");return;}
      const stage=stages.find(item=>item.id===id);
      if(!stage)return;
      if(action==="Rename column" || action==="Rename stage"){
        setCreatingStage(false);
        setCollapsed(current=>{const next=new Set(current);next.delete(id);return next;});
        setEditingStageId(id);setStageName(stage.name);
      }else if(action==="Reorder column" || action==="Reorder stage"){
        toast.info("Drag the grip beside a stage title to reorder it.");
      }else if(action==="Delete column" || action==="Remove stage"){
        const destinationId=stageRemovalDestination(stages,id);
        if(!destinationId){toast.info("Keep at least one stage in the project.");return;}
        setStageError("");
        setRemoveDestination("");
        setRemovingStageId(id);
      }else if(action==="Duplicate column" || action==="Duplicate stage"){
        runStage({action:"create",name:`${stage.name.slice(0,155)} copy`,category:stage.category});
      }else stub(action);
    },
  };

  // ---------------- Bulk actions ----------------
  const selectedIds = useMemo(() => [...selected], [selected]);
  const bulkHandlers: BulkActionHandlers = {
    onAssign: (userId) => {
      selectedIds.forEach((id) => setAssignees.mutate({ taskId: id, userIds: userId ? [userId] : [] }));
      clearSelection();
    },
    onMove: (status) => {
      const target=stages.find(stage=>stage.category===status);
      if(!target){toast.error("No stage currently uses this status.");return;}
      bulkUpdate.mutate({ ids: selectedIds, patch: { status,stage_id:target.id } });
      clearSelection();
    },
    onMoveStage: (stageId) => {
      const target=stages.find(stage=>stage.id===stageId);
      if(!target)return;
      bulkUpdate.mutate({ids:selectedIds,patch:{status:target.category,stage_id:target.id}});
      clearSelection();
    },
    onSetStatus: (status) => {
      const target=stages.find(stage=>stage.category===status);
      if(!target){toast.error("No stage currently uses this status.");return;}
      bulkUpdate.mutate({ ids: selectedIds, patch: { status,stage_id:target.id } });
      clearSelection();
    },
    onDelete: () => setPendingDelete({ type: "bulk", ids: selectedIds }),
    onAction: (action) => stub(action),
  };

  // ---------------- Selection (explicit modes only) ----------------
  // Plain clicks NEVER select — they open the task. Selection happens only via
  // Cmd/Ctrl (toggle one) or Shift (extend a range from the last anchor).
  const toggleSelect = useCallback((taskId: string) => {
    setFocusedId(taskId);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const rangeSelect = useCallback(
    (taskId: string) => {
      const order = items.map((t) => t.id);
      const anchor = focusedId ?? taskId;
      const a = order.indexOf(anchor);
      const b = order.indexOf(taskId);
      if (a === -1 || b === -1) {
        toggleSelect(taskId);
        return;
      }
      const [lo, hi] = a < b ? [a, b] : [b, a];
      setSelected((prev) => {
        const next = new Set(prev);
        for (let i = lo; i <= hi; i++) next.add(order[i]);
        return next;
      });
    },
    [items, focusedId, toggleSelect],
  );

  // Single deterministic entry point for card pointer interactions. Resolves
  // exactly one outcome per click based on the active modifier keys.
  const handleCardClick = useCallback(
    (e: React.MouseEvent, task: TaskRow) => {
      if (e.shiftKey) {
        rangeSelect(task.id);
      } else if (e.metaKey || e.ctrlKey) {
        toggleSelect(task.id);
      } else {
        // Plain click: open only. Do not touch selection.
        setFocusedId(task.id);
        openTask(task);
      }
    },
    [rangeSelect, toggleSelect, openTask],
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
        case "enter":
          e.preventDefault();
          openTask(task);
          break;
        case "e":
          e.preventDefault();
          startInline(task, "rename");
          break;
        case "l":
          e.preventDefault();
          startInline(task, "labels");
          break;
        case "a":
          e.preventDefault();
          startInline(task, "members");
          break;
        case "d":
          e.preventDefault();
          startInline(task, "due");
          break;
        case "m": {
          e.preventDefault();
          const index=stages.findIndex(stage=>stage.id===stageForTask(task));
          const next=stages[(index+1)%stages.length];
          if(next)update.mutate({id:task.id,status:next.category,stage_id:next.id});
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
  }, [items, focusedId, selected, editOpen, openTask, startInline, dup, update, clearSelection, stages, stageForTask]);

  // ---------------- Drag & drop ----------------
  const handleDragStart = (e: DragStartEvent) =>
    setActiveId(String(e.active.id).startsWith("stage:") ? null : String(e.active.id));

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const activeId=String(active.id), overId=String(over.id);

    if(activeId.startsWith("stage:")){
      if(!canConfigureStages || stageMutation.isPending || !overId.startsWith("stage:"))return;
      const stage=stages.find(item=>item.id===activeId.slice(6));
      const destination=stages.find(item=>item.id===overId.slice(6));
      if(!stage || !destination || stage.id===destination.id)return;
      const beforeId=stageInsertBefore(stages,stage.id,destination.id);
      runStage({action:"reorder",stageId:stage.id,beforeId,expectedRevision:stage.revision});
      return;
    }

    const move=moveTaskWithinStages(items,stages,activeId,overId);
    if(!move)return;
    setItems(move.next);
    qc.setQueryData(["project-tasks", projectId], move.next);
    reorder.mutate(move.updates);
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

  if(stageQuery.isPending)return <p role="status" className="py-6 text-sm text-muted-foreground">Loading project stages…</p>;
  if(stageQuery.isError)return <div role="alert" className="flex flex-wrap items-center gap-3">
    <span>Could not load project stages. Your project has not been changed.</span>
    <Button variant="outline" onClick={()=>void stageQuery.refetch()}>Try again</Button>
  </div>;
  if(!stages.length)return <div role="alert">This project has no stages. Please contact a workspace manager.</div>;

  const removableStage=stages.find(stage=>stage.id===removingStageId);
  return (
    <>
      {stageError && <p role="alert" className="mb-3 rounded-md border border-destructive/30 p-3 text-sm text-destructive">{stageError}</p>}
      <DndContext
        sensors={sensors}
        collisionDetection={stageCollision}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4" aria-label="Project stages">
          <SortableContext items={stages.map(stage=>`stage:${stage.id}`)} strategy={horizontalListSortingStrategy}>
          {stages.map((col) => (
            <Column
              key={col.id}
              id={col.id}
              title={col.name}
              category={col.category}
              draggable={canConfigureStages && !stageMutation.isPending}
              canManageStages={canConfigureStages && !stageMutation.isPending}
              canRemoveStage={stages.length > 1}
              editing={canConfigureStages && editingStageId===col.id}
              draftName={stageName}
              onDraftNameChange={setStageName}
              onSaveName={()=>{
                if(!stageName.trim())return;
                runStage({action:"rename",stageId:col.id,name:stageName.trim(),expectedRevision:col.revision},
                  ()=>setEditingStageId(null));
              }}
              onCancelName={()=>setEditingStageId(null)}
              tasks={byStage(col.id)}
              memberMap={memberMap}
              members={members}
              collapsed={collapsed.has(col.id)}
              selected={selected}
              cardHandlers={cardHandlers}
              inlineCtx={inlineCtx}
              columnHandlers={columnHandlers}
              onCardClick={handleCardClick}
              onAdd={(title) => createTask.mutate({ title, status: col.category,stage_id:col.id })}
              adding={createTask.isPending}
            />
          ))}
          </SortableContext>
          {canConfigureStages && <div className="w-72 shrink-0 rounded-card border border-border bg-card p-3">
            {creatingStage ? <form className="space-y-3" onSubmit={event=>{
              event.preventDefault();if(!stageName.trim())return;
              runStage({action:"create",name:stageName.trim(),category:stageCategory},()=>{
                setCreatingStage(false);setStageName("");
              });
            }}>
              <label htmlFor="new-project-stage" className="text-sm font-medium">Stage name</label>
              <Input id="new-project-stage" autoFocus value={stageName} onChange={event=>setStageName(event.target.value)}
                placeholder="e.g. Client feedback" maxLength={160} required disabled={stageMutation.isPending}/>
              <label htmlFor="stage-report-category" className="block text-xs text-muted-foreground">Reporting status</label>
              <select id="stage-report-category" value={stageCategory}
                onChange={event=>setStageCategory(event.target.value as TaskStatus)}
                disabled={stageMutation.isPending}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                {TASK_COLUMNS.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
              <div className="flex gap-2">
                <Button size="sm" type="submit" disabled={stageMutation.isPending||!stageName.trim()}>Save stage</Button>
                <Button size="sm" type="button" variant="ghost" disabled={stageMutation.isPending}
                  onClick={()=>{setCreatingStage(false);setStageName("");}}>Cancel</Button>
              </div>
            </form> :
            <Button type="button" variant="ghost" onClick={()=>{setCreatingStage(true);setEditingStageId(null);setStageName("");setStageCategory("todo");}}>
              <Plus className="mr-2 h-4 w-4"/>Add stage
            </Button>}
          </div>}
        </div>

        <DragOverlay>
          {activeTask && (
            <div className="w-72">
              <OrdoTaskCard
                title={activeTask.title}
                status={activeTask.status}
                description={activeTask.description}
                dueDate={activeTask.due_date}
                labels={labelChipsFor(activeTask.id)}
                assignees={assigneesFor(activeTask)}
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
        stages={stages}
        handlers={bulkHandlers}
        onClear={clearSelection}
      />

      <TaskDetailDrawer
        task={liveEditTask}
        members={members}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaveDescription={(id, description) => update.mutate({ id, description })}
      />


      <AlertDialog open={!!removableStage} onOpenChange={open=>{
        if(!open&&!stageMutation.isPending){setRemovingStageId(null);setRemoveDestination("");setStageError("");}
      }}>
        <AlertDialogContent className="client-os rounded-panel">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removableStage?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {removalTaskCount.isPending
                ? "Checking whether this stage contains tasks…"
                : hasStageTasks(removalTaskCount.data)
                  ? "Removing this stage will transfer its tasks, including archived ones. No tasks or assignments will be deleted."
                  : "This empty stage will be removed from the project. Your other stages and tasks will not be changed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {removalTaskCount.isError && (
            <div role="alert" className="text-sm text-destructive">
              Could not check whether this stage contains tasks. No changes were made.
              <Button type="button" variant="link" onClick={() => void removalTaskCount.refetch()}>
                Try again
              </Button>
            </div>
          )}
          {!removalTaskCount.isFetching && !removalTaskCount.isError &&
            hasStageTasks(removalTaskCount.data) && (
              <div className="space-y-2">
                <label htmlFor="remove-stage-destination" className="block text-sm font-medium">
                  Transfer tasks to <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <select id="remove-stage-destination" value={removeDestination}
                  disabled={stageMutation.isPending}
                  onChange={event=>setRemoveDestination(event.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                  <option value="">Automatically choose a nearby stage</option>
                  {stages.filter(item=>item.id!==removableStage?.id).map(stage=>
                    <option key={stage.id} value={stage.id}>{stage.name}</option>)}
                </select>
                <p className="text-xs text-muted-foreground">
                  {removalTaskCount.data} {removalTaskCount.data === 1 ? "task" : "tasks"} will be kept.
                  Leave this unchanged to transfer automatically, or choose another stage.
                </p>
              </div>
            )}
          {stageError && <p role="alert" className="text-sm text-destructive">{stageError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={stageMutation.isPending} onClick={()=>{setRemovingStageId(null);setRemoveDestination("");setStageError("");}}>Cancel</AlertDialogCancel>
            <Button disabled={stageMutation.isPending || stages.length<=1 ||
                removalTaskCount.isFetching || removalTaskCount.isError || removalTaskCount.data === undefined}
              onClick={()=>{
                if(!removableStage)return;
                // Keep the backend safety guarantee even when the optional selection is skipped.
                // Always send a destination to handle tasks added during the dialog.
                const destinationId = resolveStageRemovalDestination(stages, removableStage.id, removeDestination);
                if(!destinationId)return;
                const transferred = removalTaskCount.data ?? 0;
                runStage({action:"remove",stageId:removableStage.id,
                  destinationId,expectedRevision:removableStage.revision},
                  ()=>{
                    setRemovingStageId(null);
                    setRemoveDestination("");
                    toast.success(transferred > 0 ? "Stage removed. Tasks transferred safely." : "Empty stage removed.");
                  });
              }}>Remove stage</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
  category,
  draggable,
  canManageStages,
  canRemoveStage,
  editing,
  draftName,
  onDraftNameChange,
  onSaveName,
  onCancelName,
  tasks,
  memberMap,
  members,
  collapsed,
  selected,
  cardHandlers,
  inlineCtx,
  columnHandlers,
  onCardClick,
  onAdd,
  adding,
}: {
  id: string;
  title: string;
  category: TaskStatus;
  draggable: boolean;
  canManageStages: boolean;
  canRemoveStage: boolean;
  editing: boolean;
  draftName: string;
  onDraftNameChange: (name:string)=>void;
  onSaveName: ()=>void;
  onCancelName: ()=>void;
  tasks: TaskRow[];
  memberMap: Map<string, ProjectMemberProfile>;
  members: ProjectMemberProfile[];
  collapsed: boolean;
  selected: Set<string>;
  cardHandlers: TaskMenuHandlers;
  inlineCtx: BoardInlineCtx;
  columnHandlers: ColumnMenuHandlers;
  onCardClick: (e: React.MouseEvent, t: TaskRow) => void;
  onAdd: (title: string) => void;
  adding: boolean;
}) {
  const { setNodeRef:setDropRef, isOver } = useDroppable({ id });
  const {
    setNodeRef:setStageRef,setActivatorNodeRef,attributes,listeners,
    transform,transition,isDragging,
  }=useSortable({id:`stage:${id}`,disabled:!draggable});
  const stageStyle={transform:CSS.Transform.toString(transform),transition,opacity:isDragging ? 0.55 : 1};
  const [composing, setComposing] = useState(false);
  const [value, setValue] = useState("");
  const theme = COLUMN_THEME[category];

  const submit = () => {
    if (value.trim()) {
      onAdd(value.trim());
      setValue("");
      setComposing(false);
    }
  };

  if (collapsed) {
    return (
      <OrdoColumnContextMenu status={id} collapsed handlers={columnHandlers} canManageStages={canManageStages} canRemoveStage={canRemoveStage}>
        <div ref={setStageRef} style={stageStyle} className="flex w-12 shrink-0 flex-col items-center gap-3 rounded-card border border-border bg-card py-3">
          {draggable && <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners}
            className="cursor-grab touch-none text-muted-foreground" aria-label={`Drag ${title} stage`}>
            <GripVertical className="h-4 w-4"/>
          </button>}
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
    <div ref={setStageRef} style={stageStyle} className="flex w-72 shrink-0 flex-col">
      <OrdoColumnContextMenu status={id} collapsed={false} handlers={columnHandlers} canManageStages={canManageStages} canRemoveStage={canRemoveStage}>
        <div className="mb-3 flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", theme.dot)} />
            {editing ? <Input autoFocus maxLength={160} value={draftName}
              onChange={event=>onDraftNameChange(event.target.value)}
              onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();onSaveName();}
                if(event.key==="Escape")onCancelName();}}
              className="h-8 w-40 text-sm" aria-label={`Rename ${title} stage`}/> :
              <span className={cn("text-sm font-semibold", theme.header)}>{title}</span>}
            {editing && <>
              <Button type="button" variant="ghost" size="sm" onClick={onSaveName} disabled={!draftName.trim()}>Save</Button>
              <Button type="button" variant="ghost" size="sm" onClick={onCancelName}>Cancel</Button>
            </>}
            <span className="rounded-pill bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {tasks.length}
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            {draggable && <button type="button" ref={setActivatorNodeRef}
              {...attributes} {...listeners}
              className="cursor-grab touch-none rounded-md p-1 text-muted-foreground hover:bg-muted"
              aria-label={`Drag ${title} stage`}><GripVertical className="h-4 w-4" /></button>}
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
              canManageStages={canManageStages}
              canRemoveStage={canRemoveStage}
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
        ref={setDropRef}
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
              selected={selected.has(t.id)}
              handlers={cardHandlers}
              inlineCtx={inlineCtx}
              onCardClick={onCardClick}
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
  selected,
  handlers,
  inlineCtx,
  onCardClick,
}: {
  task: TaskRow;
  selected: boolean;
  handlers: TaskMenuHandlers;
  inlineCtx: BoardInlineCtx;
  onCardClick: (e: React.MouseEvent, t: TaskRow) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const {
    members,
    projectLabels,
    labelChipsFor,
    labelIdsFor,
    toggleLabel,
    createLabel,
    renameLabel,
    recolorLabel,
    deleteLabel,
    moveTargets,
    stages,
    inline,
    setInline,
    patchTask,
    assigneesFor,
    setTaskAssignees,
  } = inlineCtx;
  const assignees = assigneesFor(task);

  const mode = inline?.id === task.id ? inline.mode : null;
  const renaming = mode === "rename";
  const popoverMode = mode && mode !== "rename" ? mode : null;
  const closeInline = () => setInline(null);

  // When opened from the context menu, the menu's closing focus/pointer events
  // would otherwise immediately dismiss this popover. Ignore close requests in
  // a short grace window right after opening.
  const openedAtRef = useRef(0);
  useEffect(() => {
    if (popoverMode) openedAtRef.current = Date.now();
  }, [popoverMode]);

  return (
    <Popover
      open={!!popoverMode}
      onOpenChange={(o) => {
        if (o) return;
        if (Date.now() - openedAtRef.current < 350) return;
        closeInline();
      }}
    >
      <OrdoCardContextMenu task={task} handlers={handlers} moveTargets={moveTargets} stages={stages}>
        <PopoverAnchor asChild>
          <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            aria-label={`Task: ${task.title}`}
            onClick={(e) => {
              // Interaction precedence: rename / context menu / popover take
              // over the card entirely. Otherwise resolve exactly one outcome
              // (range-select, toggle-select, or open) from the modifier keys.
              if (renaming || popoverMode) return;
              onCardClick(e, task);
            }}
            onKeyDown={(e) => {
              if (renaming || popoverMode) return;
              if (e.key === "Enter") {
                e.preventDefault();
                onCardClick(e as unknown as React.MouseEvent, task);
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
              handlers={handlers}
              moveTargets={moveTargets}
              stages={stages}
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
              description={task.description}
              dueDate={task.due_date}
              labels={labelChipsFor(task.id)}
              assignees={assignees}
              interactive={false}
              dragHandleProps={renaming ? undefined : { ...attributes, ...listeners }}
              titleEditor={
                renaming ? (
                  <InlineTaskTitle
                    value={task.title}
                    onSave={(next) => {
                      patchTask(task.id, { title: next });
                      closeInline();
                    }}
                    onCancel={closeInline}
                  />
                ) : undefined
              }
            />
          </div>
        </PopoverAnchor>
      </OrdoCardContextMenu>



        <PopoverContent
          align="center"
          side="right"
          sideOffset={10}
          collisionPadding={16}
          avoidCollisions
          sticky="always"
          className={cn(
            "client-os z-50 overflow-hidden rounded-panel border border-border bg-card p-0 text-foreground shadow-hover",
            "origin-[var(--radix-popover-content-transform-origin)]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
            "duration-[165ms] ease-out",
            popoverMode === "due" ? "w-fit" : "w-72",
          )}
          onClick={(e) => e.stopPropagation()}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {popoverMode === "labels" && (
            <InlineLabelPicker
              labels={projectLabels}
              value={labelIdsFor(task.id)}
              onToggle={(labelId) => toggleLabel(task.id, labelId)}
              onCreate={createLabel}
              onRename={renameLabel}
              onRecolor={recolorLabel}
              onDelete={deleteLabel}
            />
          )}
          {popoverMode === "members" && (
            <InlineMemberPicker
              members={members}
              value={assignees.map((a) => a.user_id)}
              onChange={(userIds) => setTaskAssignees(task.id, userIds)}
            />
          )}
          {popoverMode === "due" && (
            <InlineDatePicker
              value={task.due_date ?? null}
              onChange={(next) => {
                patchTask(task.id, { due_date: next });
                closeInline();
              }}
            />
          )}
        </PopoverContent>

      </Popover>

  );
}

