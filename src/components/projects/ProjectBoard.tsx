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
  type DragOverEvent,
  type DragMoveEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { Plus, Loader2, MoreHorizontal, ChevronRight, Search, X, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useLocation, useNavigate, useNavigationType } from "react-router-dom";
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
  useBulkDeleteTasks,
  useTaskAssignees,
  useSetTaskAssignees,
  type TaskRow,
} from "@/hooks/useProjectData";
import type { ProjectMemberProfile } from "@/hooks/useProjects";
import { useProjects } from "@/hooks/useProjects";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { useLocalDateKey } from "@/hooks/useLocalDateKey";
import { sendAppEmail } from "@/lib/email";
import { projectUrl } from "@/lib/appUrl";
import { dateShort } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { boardReadingOrder, compareBoardTasks, moveBoardTask, moveBoardTasksToStatus, restoreBoardMove, type BoardMoveResult } from "@/lib/boardOrder";
import { EMPTY_BOARD_FILTERS, filterBoardTasks, hasBoardFilters, type BoardFilters } from "@/lib/boardFilters";
import { taskWeekRange } from "@/lib/taskDueDates";

interface Props {
  projectId: string;
  workspaceId: string;
  tasks: TaskRow[];
  members: ProjectMemberProfile[];
  /** When set (e.g. from a ?task= deep link), open this task's drawer on mount. */
  initialTaskId?: string | null;
  canEdit: boolean;
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
  inline: { id: string; mode: InlineMode } | null;
  setInline: (v: { id: string; mode: InlineMode } | null) => void;
  patchTask: (id: string, patch: Partial<TaskRow>) => Promise<void>;
  assigneesFor: (task: TaskRow) => ProjectMemberProfile[];
  setTaskAssignees: (taskId: string, userIds: string[]) => void;
}


export function ProjectBoard({ projectId, workspaceId, tasks, members, initialTaskId, canEdit }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const { role, currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const today = useLocalDateKey();
  const createTask = useCreateTask(projectId, workspaceId);
  const reorder = useReorderTasks(projectId);
  const update = useUpdateTask(projectId);
  const del = useDeleteTask(projectId);
  const dup = useDuplicateTask(projectId, workspaceId);
  const archive = useArchiveTask(projectId);
  const bulkDelete = useBulkDeleteTasks(projectId);
  const { data: assigneesMap } = useTaskAssignees(projectId);
  const setAssignees = useSetTaskAssignees(projectId);

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
  const [dropTarget, setDropTarget] = useState<{ id: string; after: boolean } | null>(null);
  const [filters, setFilters] = useState<BoardFilters>(EMPTY_BOARD_FILTERS);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [composeStatus, setComposeStatus] = useState<TaskStatus | null>(null);
  const [moveError, setMoveError] = useState("");
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => { window.removeEventListener("online", updateOnline); window.removeEventListener("offline", updateOnline); };
  }, []);
  const [announcement, setAnnouncement] = useState("");
  const moveSequence = useRef(0);
  const moveInFlight = useRef(false);
  const openTrigger = useRef<HTMLElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const unsavedDrawer = useRef({ dirty: false, pending: false });
  const acceptedTaskId = useRef<string | null>(null);
  const acceptedLocation = useRef({ search: location.search, state: location.state });
  const onDrawerUnsavedChange = useCallback((state: { dirty: boolean; pending: boolean }) => { unsavedDrawer.current = state; }, []);

  // Interaction state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [editTask, setEditTask] = useState<TaskRow | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  // Inline quick-edit state — which card is being edited inline, and how.
  const [inline, setInline] = useState<{ id: string; mode: InlineMode } | null>(null);
  const [collapsed, setCollapsed] = useState<Set<TaskStatus>>(() => {
    try {
      const raw = localStorage.getItem(`ordo:collapsed:${projectId}`);
      return new Set(raw ? (JSON.parse(raw) as TaskStatus[]) : []);
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    if (!reorder.isPending) setItems(tasks);
  }, [tasks, reorder.isPending]);
  useEffect(() => {
    try { localStorage.setItem(`ordo:collapsed:${projectId}`, JSON.stringify([...collapsed])); } catch { /* Collapsing still works without storage. */ }
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
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const filtering = hasBoardFilters(filters);
  const dueRangeInvalid = filters.due === "custom" && !!filters.dueFrom && !!filters.dueTo && filters.dueFrom > filters.dueTo;
  const visible = useMemo(() => filterBoardTasks(items, filters, assigneesMap, labelMap, today), [items, filters, assigneesMap, labelMap, today]);
  const visibleOrder = useMemo(() => boardReadingOrder(visible), [visible]);
  useEffect(() => {
    const visibleIds = new Set(visible.map((task) => task.id));
    setSelected((current) => {
      const next = new Set([...current].filter((id) => visibleIds.has(id)));
      return next.size === current.size ? current : next;
    });
    setFocusedId((current) => current && !visibleIds.has(current) ? null : current);
  }, [visible]);
  const byStatus = (status: TaskStatus) =>
    visible.filter((t) => t.status === status).sort(compareBoardTasks);

  const activeTask = items.find((t) => t.id === activeId) ?? null;

  const openTask = useCallback((t: TaskRow) => {
    setEditTask(t);
    setEditOpen(true);
    const params = new URLSearchParams(location.search);
    if (params.get("task") !== t.id) {
      params.set("task", t.id);
      navigate({ search: `?${params}` }, { state: { boardTaskOpen: true }, preventScrollReset: true });
    }
  }, [location.search, navigate]);

  // Deep-link: open the drawer for the task referenced by ?task= once loaded.
  useEffect(() => {
    const nextId = initialTaskId ?? null;
    if (acceptedTaskId.current !== nextId && acceptedTaskId.current &&
      (unsavedDrawer.current.pending || (unsavedDrawer.current.dirty && !window.confirm("Discard your unsaved task changes?")))) {
      if (unsavedDrawer.current.pending) toast.info("Wait for this task to finish saving before leaving.");
      if (navigationType === "POP") navigate(1);
      else navigate({ search: acceptedLocation.current.search }, { replace: true, state: acceptedLocation.current.state, preventScrollReset: true });
      return;
    }
    acceptedTaskId.current = nextId;
    acceptedLocation.current = { search: location.search, state: location.state };
    if (!nextId) {
      setEditOpen(false);
      setEditTask(null);
      return;
    }
    setEditTask(items.find((t) => t.id === nextId) ?? null);
    setEditOpen(true);
  }, [initialTaskId, items, location.search, location.state, navigate, navigationType]);

  const closeTask = useCallback(() => {
    unsavedDrawer.current = { dirty: false, pending: false };
    setEditOpen(false);
    if (location.state?.boardTaskOpen) navigate(-1);
    else {
      const params = new URLSearchParams(location.search);
      params.delete("task");
      navigate({ search: params.size ? `?${params}` : "" }, { replace: true, preventScrollReset: true });
    }
    requestAnimationFrame(() => openTrigger.current?.focus());
  }, [location.search, location.state, navigate]);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const patchTask = useCallback(
    (id: string, patch: Partial<TaskRow>) => {
      return update.mutateAsync({ id, ...patch });
    },
    [update],
  );

  const startInline = useCallback((t: TaskRow, mode: InlineMode) => setInline({ id: t.id, mode }), []);
  const closeInline = useCallback(() => setInline(null), []);

  const copyLink = useCallback(
    async (t: TaskRow) => {
      try { await navigator.clipboard.writeText(projectUrl(projectId, t.id)); toast.success("Task link copied"); }
      catch { toast.error("Couldn’t copy the link. Open the task and copy the page address."); }
    },
    [projectId],
  );

  const persistBoardMove = useCallback(async (result: BoardMoveResult | null, movedIds: string[]) => {
    if (!canEdit) throw new Error("You cannot edit this project.");
    if (moveInFlight.current) throw new Error("Wait for the previous move to finish saving.");
    if (!result) return;
    const before = items;
    const sequence = ++moveSequence.current;
    moveInFlight.current = true;
    setMoveError("");
    await qc.cancelQueries({ queryKey: ["project-tasks", projectId] });
    setItems(result.tasks);
    qc.setQueryData(["project-tasks", projectId], result.tasks);
    try {
      await reorder.mutateAsync(result.updates);
      const moved = result.tasks.find((task) => task.id === movedIds[0]);
      const label = movedIds.length === 1 ? moved?.title ?? "Task" : `${movedIds.length} tasks`;
      setAnnouncement(`${label} moved to ${TASK_COLUMNS.find((column) => column.id === moved?.status)?.title ?? "the column"}.`);
      toast.success(movedIds.length === 1 ? "Task moved" : "Tasks moved", {
        action: {
          label: "Undo",
          onClick: () => {
            const latest = qc.getQueryData<TaskRow[]>(["project-tasks", projectId]) ?? [];
            const reversal = restoreBoardMove(before, latest, result);
            if (moveInFlight.current || moveSequence.current !== sequence || !reversal) {
              toast.info("The board changed. Review the task before undoing this move.");
              return;
            }
            moveSequence.current++;
            moveInFlight.current = true;
            void (async () => {
              await qc.cancelQueries({ queryKey: ["project-tasks", projectId] });
              setItems(reversal.tasks);
              qc.setQueryData(["project-tasks", projectId], reversal.tasks);
              try {
                await reorder.mutateAsync(reversal.updates);
                setAnnouncement("Task move undone.");
              } catch {
                setItems(latest);
                qc.setQueryData(["project-tasks", projectId], latest);
                void qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
                setMoveError("Undo could not be saved. The previous board has been restored.");
              } finally { moveInFlight.current = false; }
            })();
          },
        },
      });
    } catch (error) {
      const current = qc.getQueryData<TaskRow[]>(["project-tasks", projectId]) ?? items;
      const affected = new Set(result.updates.map((entry) => entry.id));
      const rollback = current.map((task) => {
        const original = affected.has(task.id) ? before.find((entry) => entry.id === task.id) : null;
        return original ? { ...task, status: original.status, position: original.position } : task;
      });
      setItems(rollback);
      qc.setQueryData(["project-tasks", projectId], rollback);
      const message = error instanceof Error ? error.message : "The move could not be saved. Refresh to see the latest board.";
      setMoveError(message);
      toast.error("Task move failed. Your work is being refreshed.");
      await qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      throw error;
    } finally {
      moveInFlight.current = false;
    }
  }, [canEdit, reorder, items, qc, projectId]);

  const persistMove = useCallback(async (taskId: string, overId: string, after = false) => {
    if (filtering) return;
    await persistBoardMove(moveBoardTask(items, taskId, overId, after), [taskId]);
  }, [filtering, items, persistBoardMove]);

  const moveToStatus = useCallback(async (task: TaskRow, status: TaskStatus) => {
    // Explicit status changes append to the destination and preserve hidden
    // tasks' relative order. Manual placement remains disabled while filtering.
    await persistBoardMove(moveBoardTasksToStatus(items, [task.id], status), [task.id]);
    if (task.status !== status && filtering && !filterBoardTasks([{ ...task, status }], filters, assigneesMap, labelMap, today).length) {
      toast.success(`Moved to ${TASK_COLUMNS.find((column) => column.id === status)?.title}`, {
        action: { label: "Clear filters", onClick: () => setFilters(EMPTY_BOARD_FILTERS) },
      });
    }
  }, [filtering, filters, assigneesMap, labelMap, persistBoardMove, items, today]);

  // ---------------- Card actions ----------------
  const cardHandlers: TaskMenuHandlers = {
    onOpen: (t) => { openTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; openTask(t); },
    onRename: (t) => startInline(t, "rename"),
    onEditLabels: (t) => startInline(t, "labels"),
    onEditMembers: (t) => startInline(t, "members"),
    onEditDueDate: (t) => startInline(t, "due"),
    onMoveStatus: (t, status) => { void moveToStatus(t, status).catch(() => {}); },
    onMovePosition: (task, edge) => {
      if (filtering) { toast.info("Clear filters to change the order within a column."); return; }
      const column = items.filter((item) => item.status === task.status).sort(compareBoardTasks);
      const target = edge === "top" ? column[0] : column[column.length - 1];
      if (!target || target.id === task.id) { toast.info(`This task is already at the ${edge}.`); return; }
      void persistMove(task.id, target.id, edge === "bottom").catch(() => {});
    },
    onMoveProject: (t, targetProjectId) =>
      update.mutate({ id: t.id, project_id: targetProjectId }),
    onDuplicate: (t) => dup.mutate(t),
    onCopyLink: copyLink,
    onArchive: (t) => archive.mutate(t.id, {
      onSuccess: (archived) => toast.success("Task archived", {
        action: { label: "Undo", onClick: () => {
          void (async () => {
            const { data, error } = await supabase.from("tasks").update({ archived_at: null })
              .eq("id", t.id).eq("archived_at", archived.archived_at).eq("updated_at", archived.updated_at)
              .select("id");
            if (error || !data?.length) toast.info("This task changed. Open the project to review its current state.");
            else void qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
          })();
        } },
      }),
      onError: () => toast.error("Task could not be archived."),
    }),
    onDelete: (t) => setPendingDelete({ type: "single", task: t }),
  };

  // Keep the open drawer in sync with the live task list (optimistic updates).
  const liveEditTask = editTask ? items.find((t) => t.id === editTask.id) ?? null : null;

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
    inline,
    setInline,
    patchTask,
    assigneesFor,
    setTaskAssignees,
  };


  // ---------------- Column actions ----------------
  const columnHandlers: ColumnMenuHandlers = {
    onAddTask: setComposeStatus,
    onToggleCollapse: (status) =>
      setCollapsed((prev) => {
        const next = new Set(prev);
        next.has(status) ? next.delete(status) : next.add(status);
        return next;
      }),
  };

  // ---------------- Bulk actions ----------------
  const selectedIds = useMemo(() => [...selected], [selected]);
  const bulkHandlers: BulkActionHandlers = {
    onAssign: (userId) => {
      selectedIds.forEach((id) => setAssignees.mutate({ taskId: id, userIds: userId ? [userId] : [] }));
      clearSelection();
    },
    onMove: (status) => {
      void persistBoardMove(moveBoardTasksToStatus(items, selectedIds, status), selectedIds)
        .then(clearSelection).catch(() => {});
    },
    onDelete: () => setPendingDelete({ type: "bulk", ids: selectedIds }),
  };

  // ---------------- Selection (explicit modes only) ----------------
  // Plain clicks NEVER select — they open the task. Selection happens only via
  // Cmd/Ctrl (toggle one) or Shift (extend a range from the last anchor).
  const toggleSelect = useCallback((taskId: string) => {
    setFocusedId(taskId);
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(taskId) ? next.delete(taskId) : next.add(taskId);
      return next;
    });
  }, []);

  const rangeSelect = useCallback(
    (taskId: string) => {
      const order = visibleOrder.map((t) => t.id);
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
    [visibleOrder, focusedId, toggleSelect],
  );

  // Single deterministic entry point for card pointer interactions. Resolves
  // exactly one outcome per click based on the active modifier keys.
  const handleCardClick = useCallback(
    (e: React.MouseEvent, task: TaskRow) => {
      if (!canEdit) { openTrigger.current = e.currentTarget as HTMLElement; openTask(task); return; }
      if (e.shiftKey) {
        rangeSelect(task.id);
      } else if (e.metaKey || e.ctrlKey) {
        toggleSelect(task.id);
      } else {
        // Plain click: open only. Do not touch selection.
        setFocusedId(task.id);
        openTrigger.current = e.currentTarget as HTMLElement;
        openTask(task);
      }
    },
    [canEdit, rangeSelect, toggleSelect, openTask],
  );

  // ---------------- Keyboard shortcuts ----------------
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (!canEdit || !tgt || !boardRef.current?.contains(tgt)) return;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable)) return;
      if (editOpen || activeId) return;
      if (tgt.closest("button") && !tgt.closest("button[data-task-open]")) return;

      if (selected.size > 1) {
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          setPendingDelete({ type: "bulk", ids: [...selected] });
        }
        if (e.key === "Escape") clearSelection();
        return;
      }

      const id = tgt.closest("[data-task-id]")?.getAttribute("data-task-id") ?? focusedId ?? (selected.size === 1 ? [...selected][0] : null);
      const task = items.find((t) => t.id === id);
      if (e.key === "Escape") clearSelection();
      if (!task) return;

      switch (e.key.toLowerCase()) {
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
        default:
          if (e.key === "Delete" || e.key === "Backspace") {
            e.preventDefault();
            setPendingDelete({ type: "single", task });
          }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [canEdit, items, focusedId, selected, editOpen, activeId, openTask, startInline, moveToStatus, clearSelection]);

  // ---------------- Drag & drop ----------------
  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const handleDragOver = (e: DragOverEvent | DragMoveEvent) => {
    if (!e.over) return setDropTarget(null);
    const overId = String(e.over.id);
    const movingCenter = (e.active.rect.current.translated?.top ?? 0) + (e.active.rect.current.initial?.height ?? 0) / 2;
    setDropTarget({ id: overId, after: movingCenter > e.over.rect.top + e.over.rect.height / 2 });
  };
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    setDropTarget(null);
    const { active, over } = e;
    if (!over) return;
    const movingCenter = (active.rect.current.translated?.top ?? active.rect.current.initial?.top ?? 0) + (active.rect.current.initial?.height ?? 0) / 2;
    void persistMove(String(active.id), String(over.id), movingCenter > over.rect.top + over.rect.height / 2).catch(() => {});
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    if (pendingDelete.type === "single") {
      del.mutate(pendingDelete.task.id, { onError: () => toast.error("This task could not be deleted. It is still on the board; try again.") });
      setSelected((prev) => {
        const n = new Set(prev);
        n.delete(pendingDelete.task.id);
        return n;
      });
    } else {
      bulkDelete.mutate(pendingDelete.ids, { onError: () => toast.error("The selected tasks could not be deleted. Refresh and try again.") });
      clearSelection();
    }
    setPendingDelete(null);
  };

  return (
    <>
      <section className="mb-4 space-y-3" aria-label="Board controls">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:min-w-[180px] sm:max-w-xs">
            <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search tasks" value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
              placeholder="Search tasks" className="h-10 rounded-small border-[hsl(var(--board-border))] bg-card pl-9" />
          </div>
          <Button variant="outline" className="h-10 w-10 shrink-0 p-0 sm:hidden" aria-label="Show task filters" aria-expanded={filtersExpanded} aria-controls="board-filter-options" onClick={() => setFiltersExpanded((value) => !value)}><SlidersHorizontal className="h-4 w-4" /></Button>
          {canEdit && <Button className="h-10 shrink-0 rounded-small sm:order-last" onClick={() => setComposeStatus("todo")}><Plus className="mr-1.5 h-4 w-4" /><span className="sm:hidden">Task</span><span className="hidden sm:inline">New task</span></Button>}
          <div id="board-filter-options" className={cn("w-full flex-wrap items-center gap-2 sm:contents", filtersExpanded ? "flex" : "hidden")}>
          <Button type="button" variant={filters.assignee === user?.id ? "default" : "outline"} size="sm"
            className="h-10 rounded-small" onClick={() => setFilters((current) => ({ ...current, assignee: current.assignee === user?.id ? "all" : user?.id ?? "all" }))}>
            Assigned to me
          </Button>
          <label className="sr-only" htmlFor="board-status-filter">Filter by status</label>
          <select id="board-status-filter" className="h-10 min-w-28 rounded-small border border-[hsl(var(--board-border))] bg-card px-3 text-sm text-foreground"
            value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as BoardFilters["status"] }))}>
            <option value="all">All statuses</option>{TASK_COLUMNS.map((column) => <option key={column.id} value={column.id}>{column.title}</option>)}
          </select>
          <label className="sr-only" htmlFor="board-person-filter">Filter by assignee</label>
          <select id="board-person-filter" className="h-10 min-w-28 max-w-44 rounded-small border border-[hsl(var(--board-border))] bg-card px-3 text-sm text-foreground"
            value={filters.assignee} onChange={(event) => setFilters((current) => ({ ...current, assignee: event.target.value }))}>
            <option value="all">Everyone</option><option value="unassigned">Unassigned</option>
            {members.map((member) => <option key={member.user_id} value={member.user_id}>{member.full_name ?? member.email ?? "Member"}</option>)}
          </select>
          <label className="sr-only" htmlFor="board-due-filter">Filter by due date</label>
          <select id="board-due-filter" className="h-10 min-w-28 rounded-small border border-[hsl(var(--board-border))] bg-card px-3 text-sm text-foreground"
            value={filters.due} onChange={(event) => setFilters((current) => ({ ...current, due: event.target.value as BoardFilters["due"] }))}>
            <option value="all">Any due date</option><option value="overdue">Overdue</option><option value="today">Due today</option><option value="this-week">Due this week</option><option value="upcoming">Upcoming</option><option value="none">No due date</option><option value="custom">Custom range</option>
          </select>
          {projectLabels.length > 0 && <><label className="sr-only" htmlFor="board-label-filter">Filter by label</label>
            <select id="board-label-filter" className="h-10 min-w-28 max-w-40 rounded-small border border-[hsl(var(--board-border))] bg-card px-3 text-sm text-foreground"
              value={filters.label} onChange={(event) => setFilters((current) => ({ ...current, label: event.target.value }))}>
              <option value="all">All labels</option>{projectLabels.map((label) => <option key={label.id} value={label.id}>{label.name}</option>)}
            </select></>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Quick due date filters">
          <Button type="button" variant={filters.due === "today" ? "default" : "outline"} size="sm"
            className="h-10 rounded-small" aria-pressed={filters.due === "today"}
            onClick={() => setFilters((current) => ({ ...current, due: current.due === "today" ? "all" : "today" }))}>
            Due today
          </Button>
          <Button type="button" variant={filters.due === "this-week" ? "default" : "outline"} size="sm"
            className="h-10 rounded-small" aria-pressed={filters.due === "this-week"}
            onClick={() => setFilters((current) => ({ ...current, due: current.due === "this-week" ? "all" : "this-week" }))}>
            Due this week
          </Button>
          {filters.due === "this-week" && <span className="text-xs text-muted-foreground">
            {dateShort(taskWeekRange(today).from)} – {dateShort(taskWeekRange(today).to)} · Monday–Sunday
          </span>}
        </div>
        {filters.due === "custom" && <div className="space-y-2" role="group" aria-label="Custom due date range">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 space-y-1">
              <label htmlFor="board-due-from" className="block text-xs font-medium text-foreground">From</label>
              <Input id="board-due-from" type="date" value={filters.dueFrom} max={filters.dueTo || undefined}
                aria-invalid={dueRangeInvalid} aria-describedby={dueRangeInvalid ? "board-due-range-error" : undefined}
                className="h-10 w-40 max-w-full rounded-small border-[hsl(var(--board-border))] bg-card"
                onChange={(event) => setFilters((current) => ({ ...current, dueFrom: event.target.value }))} />
            </div>
            <div className="min-w-0 space-y-1">
              <label htmlFor="board-due-to" className="block text-xs font-medium text-foreground">To</label>
              <Input id="board-due-to" type="date" value={filters.dueTo} min={filters.dueFrom || undefined}
                aria-invalid={dueRangeInvalid} aria-describedby={dueRangeInvalid ? "board-due-range-error" : undefined}
                className="h-10 w-40 max-w-full rounded-small border-[hsl(var(--board-border))] bg-card"
                onChange={(event) => setFilters((current) => ({ ...current, dueTo: event.target.value }))} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Both dates included. Leave either date blank for an open range.</p>
          {dueRangeInvalid && <p id="board-due-range-error" role="alert" className="text-sm text-destructive">From date must be on or before the to date.</p>}
        </div>}
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span aria-live="polite">{filtering ? `${visible.length} of ${items.length} tasks shown` : `${items.length} ${items.length === 1 ? "task" : "tasks"}`}</span>
          {filtering && <><span>Manual drag ordering is paused while filters are active.</span>
            <button type="button" className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline focus-visible:underline" onClick={() => setFilters(EMPTY_BOARD_FILTERS)}>
              <X className="h-3.5 w-3.5" /> Clear filters
            </button></>}
        </div>
        {!online && <p role="status" className="rounded-small border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">You’re offline. Keep this page open to preserve drafts, then reconnect before saving.</p>}
        {moveError && <div role="alert" className="flex items-center gap-3 rounded-small border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {moveError}<Button variant="outline" size="sm" onClick={() => { setMoveError(""); void qc.invalidateQueries({ queryKey: ["project-tasks", projectId] }); }}><RotateCcw className="mr-1 h-3.5 w-3.5" />Refresh</Button>
        </div>}
        {items.length === 0 && <div className="rounded-[var(--board-column-radius)] border border-[hsl(var(--board-border))] bg-card px-5 py-4 text-sm">
          <p className="font-medium">Start with the first task</p><p className="mt-1 text-muted-foreground">Add a title in any column. Assign someone or set a date when you need to.</p>
        </div>}
        {items.length > 0 && visible.length === 0 && <div className="rounded-[var(--board-column-radius)] border border-[hsl(var(--board-border))] bg-card px-5 py-4 text-sm">
          <p className="font-medium">No tasks match these filters</p><p className="mt-1 text-muted-foreground">Clear the filters to see the whole board.</p>
        </div>}
      </section>
      {!canEdit && <p className="mb-3 text-xs text-muted-foreground">Read-only project. You can browse tasks and review their details.</p>}
      <p className="sr-only" aria-live="polite">{announcement}</p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragMove={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => { setActiveId(null); setDropTarget(null); }}
      >
        <div ref={boardRef} className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-4 sm:gap-4" aria-label="Task columns">
          {TASK_COLUMNS.map((col) => (
            <Column
              key={col.id}
              id={col.id}
              title={col.title}
              tasks={byStatus(col.id)}
              totalCount={items.filter((task) => task.status === col.id).length}
              memberMap={memberMap}
              members={members}
              collapsed={collapsed.has(col.id)}
              selected={selected}
              cardHandlers={cardHandlers}
              inlineCtx={inlineCtx}
              columnHandlers={columnHandlers}
              onCardClick={handleCardClick}
              onAdd={(title) => createTask.mutateAsync({ title, status: col.id })}
              adding={createTask.isPending}
              canEdit={canEdit}
              dragDisabled={filtering || reorder.isPending}
              composeRequested={composeStatus === col.id}
              onComposeHandled={() => setComposeStatus(null)}
              dropTarget={dropTarget}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask && (
            <div style={{ width: boardRef.current?.querySelector(`[data-task-id="${activeTask.id}"]`)?.getBoundingClientRect().width ?? 280 }}>
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
        count={canEdit ? selected.size : 0}
        members={members}
        handlers={bulkHandlers}
        onClear={clearSelection}
      />

      <TaskDetailDrawer
        task={liveEditTask}
        members={members}
        open={editOpen}
        onOpenChange={(open) => { if (!open) closeTask(); }}
        onPatch={(id, patch) => update.mutateAsync({ id, ...patch })}
        onSetAssignees={setTaskAssignees}
        onMoveStatus={moveToStatus}
        onUnsavedChange={onDrawerUnsavedChange}
        canEdit={canEdit}
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
  totalCount,
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
  canEdit,
  dragDisabled,
  composeRequested,
  onComposeHandled,
  dropTarget,
}: {
  id: TaskStatus;
  title: string;
  tasks: TaskRow[];
  totalCount: number;
  memberMap: Map<string, ProjectMemberProfile>;
  members: ProjectMemberProfile[];
  collapsed: boolean;
  selected: Set<string>;
  cardHandlers: TaskMenuHandlers;
  inlineCtx: BoardInlineCtx;
  columnHandlers: ColumnMenuHandlers;
  onCardClick: (e: React.MouseEvent, t: TaskRow) => void;
  onAdd: (title: string) => Promise<unknown>;
  adding: boolean;
  canEdit: boolean;
  dragDisabled: boolean;
  composeRequested: boolean;
  onComposeHandled: () => void;
  dropTarget: { id: string; after: boolean } | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const [composing, setComposing] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const theme = COLUMN_THEME[id];

  useEffect(() => {
    if (composeRequested) { setComposing(true); onComposeHandled(); }
  }, [composeRequested, onComposeHandled]);

  const submit = async () => {
    if (!canEdit || submitting.current || !value.trim()) return;
    submitting.current = true;
    setError("");
    try {
      await onAdd(value.trim());
      setValue("");
    } catch {
      setError("Task could not be saved. Your title is still here; try again.");
    } finally {
      submitting.current = false;
    }
  };

  if (collapsed) {
    return (
      <OrdoColumnContextMenu status={id} collapsed handlers={columnHandlers} disabled={!canEdit}>
        <div className="flex w-14 shrink-0 snap-start flex-col items-center gap-3 rounded-[var(--board-column-radius)] border border-[hsl(var(--board-border))] bg-[hsl(var(--board-column))] py-3">
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
    <div className="flex w-[min(84vw,320px)] shrink-0 snap-start flex-col rounded-[var(--board-column-radius)] border border-[hsl(var(--board-border))] bg-[hsl(var(--board-column))] p-2.5 sm:w-[300px]">
      <OrdoColumnContextMenu status={id} collapsed={false} handlers={columnHandlers} disabled={!canEdit}>
        <div className="mb-2 flex items-center justify-between px-1 py-1">
          <div className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", theme.dot)} />
            <span className={cn("text-sm font-semibold", theme.header)}>{title}</span>
            <span className="rounded-pill bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {tasks.length === totalCount ? totalCount : `${tasks.length}/${totalCount}`}
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            {canEdit && <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setComposing(true)}
              aria-label={`Add task to ${title}`}
            >
              <Plus className="h-4 w-4" />
            </Button>}
            {canEdit && <OrdoColumnOverflowMenu
              status={id}
              collapsed={false}
              handlers={columnHandlers}
              trigger={
                <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={`${title} column actions`}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              }
            />}
          </div>
        </div>
      </OrdoColumnContextMenu>

      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-32 max-h-[min(72vh,850px)] flex-1 flex-col gap-2 overflow-y-auto rounded-[12px] border border-transparent p-0.5 transition-colors",
          isOver && "border-primary/40 bg-primary/5",
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
              canEdit={canEdit}
              dragDisabled={dragDisabled}
              dropPosition={dropTarget?.id === t.id ? dropTarget.after ? "after" : "before" : null}
            />

          ))}
        </SortableContext>

        {canEdit && composing && (
          <div className="rounded-[var(--board-card-radius)] border border-primary/40 bg-card p-2.5 shadow-[var(--board-card-shadow)]">
            <Input
              key={adding ? "saving" : "ready"}
              autoFocus
              aria-label={`New task title in ${title}`}
              disabled={adding}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="What needs doing?"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(); }
                if (e.key === "Escape" && !adding) {
                  setComposing(false);
                }
              }}
            />
            {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
            <div className="mt-2 flex items-center gap-2">
              <Button size="sm" onClick={() => void submit()} disabled={adding || !value.trim()}>
                {adding && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                Add task
              </Button>
              <Button size="sm" variant="ghost" disabled={adding} onClick={() => { setComposing(false); setValue(""); setError(""); }}>
                Discard
              </Button>
            </div>
          </div>
        )}
        {canEdit && !composing && <button type="button" onClick={() => setComposing(true)} className="flex min-h-10 items-center gap-2 rounded-small px-3 text-left text-sm text-muted-foreground hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
          <Plus className="h-4 w-4" />{value ? "Continue draft" : "Add task"}
        </button>}
        {tasks.length === 0 && !composing && <p className="px-3 pb-2 text-xs text-muted-foreground">No tasks here yet</p>}
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
  canEdit,
  dragDisabled,
  dropPosition,
}: {
  task: TaskRow;
  selected: boolean;
  handlers: TaskMenuHandlers;
  inlineCtx: BoardInlineCtx;
  onCardClick: (e: React.MouseEvent, t: TaskRow) => void;
  canEdit: boolean;
  dragDisabled: boolean;
  dropPosition: "before" | "after" | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled: dragDisabled || !canEdit });
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
      <OrdoCardContextMenu task={task} handlers={handlers} moveTargets={moveTargets} disabled={!canEdit}>
        <PopoverAnchor asChild>
          <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            role="group"
            data-task-id={task.id}
            aria-label={`Task: ${task.title}`}
            onClick={(e) => {
              // Portalled menus remain React descendants, but their clicks
              // must not also activate the card underneath them.
              if (!e.currentTarget.contains(e.target as Node)) return;
              // Interaction precedence: rename / context menu / popover take
              // over the card entirely. Otherwise resolve exactly one outcome
              // (range-select, toggle-select, or open) from the modifier keys.
              if (renaming || popoverMode) return;
              onCardClick(e, task);
            }}
            className={cn(
              "group/card relative rounded-card outline-hidden transition-shadow focus-visible:ring-2 focus-visible:ring-ring",
              isDragging && "opacity-40",
              selected && "ring-2 ring-primary ring-offset-2",
              dropPosition === "before" && "before:absolute before:-top-1 before:inset-x-2 before:h-0.5 before:rounded-full before:bg-primary",
              dropPosition === "after" && "after:absolute after:-bottom-1 after:inset-x-2 after:h-0.5 after:rounded-full after:bg-primary",
            )}
          >
            <OrdoTaskCard
              actions={canEdit ? (<OrdoCardOverflowMenu
              task={task}
              handlers={handlers}
              moveTargets={moveTargets}
              trigger={
                <button
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Task actions: ${task.title}`}
                  className="flex h-9 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              }
            />) : undefined}
              titleButtonProps={{ "data-task-open": true, "aria-label": `Open task: ${task.title}`, "aria-pressed": selected, onClick: (event) => { event.stopPropagation(); onCardClick(event, task); } }}
              title={task.title}
              status={task.status}
              description={task.description}
              dueDate={task.due_date}
              labels={labelChipsFor(task.id)}
              assignees={assignees}
              interactive={false}
              dragHandleProps={renaming || dragDisabled || !canEdit ? undefined : { ...attributes, ...listeners }}
              titleEditor={
                renaming ? (
                  <InlineTaskTitle
                    value={task.title}
                    onSave={async (next) => {
                      await patchTask(task.id, { title: next });
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
                void patchTask(task.id, { due_date: next }).catch(() => {});
                closeInline();
              }}
            />
          )}
        </PopoverContent>

      </Popover>

  );
}

