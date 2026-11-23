import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, CheckSquare2, ChevronDown, ChevronRight, FolderPlus, Loader2, Plus, X } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useCreateProject, useProjects, useWorkspaceMembers } from "@/hooks/useProjects";
import { useAssignableMembers } from "@/hooks/useProjectData";
import { useProjectStages } from "@/hooks/useProjectStages";
import type { TaskStatus } from "@/lib/projectConstants";
import "@/styles/jenri-create-flow.css";

type View = "closed" | "menu" | "project" | "task";
type Priority = "" | "low" | "medium" | "high";
type Workflow = "template" | "blank";

const templateStages: { name: string; category: TaskStatus }[] = [
  { name: "Planning", category: "backlog" },
  { name: "In progress", category: "in_progress" },
  { name: "Review", category: "review" },
  { name: "Done", category: "done" },
];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="jcf-field"><span className="jcf-label">{label}</span>{children}</label>;
}

function SelectField({ value, onChange, children, placeholder, required = false }: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  placeholder: string;
  required?: boolean;
}) {
  return <span className="jcf-select-wrap"><select
    className="jcf-input"
    value={value}
    onChange={(event) => onChange(event.target.value)}
    required={required}
  ><option value="" disabled>{placeholder}</option>{children}</select><ChevronDown size={18} aria-hidden="true" /></span>;
}

function DateField({ label, value, onChange, min }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
}) {
  return <Field label={label}><span className="jcf-date-wrap"><CalendarDays size={17} aria-hidden="true" /><input
    type="date" className="jcf-input" aria-label={label} value={value}
    min={min} onChange={(event) => onChange(event.target.value)}
  /></span></Field>;
}

function CreateHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return <header className="jcf-form-header">
    <button type="button" onClick={onBack} className="jcf-back" aria-label="Back to create menu"><ArrowLeft size={20} /></button>
    <span>{title}</span>
  </header>;
}

/**
 * Workspace-scoped, mobile-first Jerin creation entry.
 * Mobile projects pages can invoke it with window.dispatchEvent(new Event("jerin:open-create")).
 * It uses the existing Supabase RLS queries/mutations, not mock data.
 */
export function JerinCreateFlow() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { data: projects = [] } = useProjects();
  const { data: members = [] } = useWorkspaceMembers();
  const createProject = useCreateProject();

  const [view, setView] = useState<View>("closed");
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [projectDue, setProjectDue] = useState("");
  const [workflow, setWorkflow] = useState<Workflow>("template");

  const [projectId, setProjectId] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [stageId, setStageId] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");

  const { data: stages = [] } = useProjectStages(projectId);
  const { data: assignees = [] } = useAssignableMembers(projectId);
  const chosenStage = useMemo(() =>
    stages.find((stage) => stage.id === stageId) ?? stages[0],
    [stageId, stages],
  );

  useEffect(() => {
    if (!projects.some((project) => project.id === projectId)) {
      setProjectId(projects.find((project) => project.status === "active")?.id ?? projects[0]?.id ?? "");
    }
  }, [projects, projectId]);

  useEffect(() => {
    const open = () => setView("menu");
    window.addEventListener("jerin:open-create", open);
    return () => window.removeEventListener("jerin:open-create", open);
  }, []);

  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const rememberOpener = () => {
      if (document.activeElement instanceof HTMLElement) opener.current = document.activeElement;
    };
    window.addEventListener("jerin:open-create", rememberOpener);
    return () => window.removeEventListener("jerin:open-create", rememberOpener);
  }, []);

  async function saveProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || saving) return;
    if (startDate && projectDue && projectDue < startDate) {
      toast.error("The due date must be on or after the start date.");
      return;
    }
    setSaving(true);
    try {
      const created = await createProject.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        client_id: clientId || null,
        start_date: startDate || null,
        due_date: projectDue || null,
        member_ids: [],
        client_user_ids: [],
      });
      if (workflow === "template") {
        const { data: present, error: readError } = await supabase
          .from("project_stages").select("id").eq("project_id", created.id).limit(1);
        if (!readError && !present?.length) {
          try {
            for (const stage of templateStages) {
              const { error } = await supabase.rpc("create_custom_stage", {
                _project_id: created.id,
                _name: stage.name,
                _theme: "neutral",
                _category: stage.category,
                _request_id: crypto.randomUUID(),
              });
              if (error) throw error;
            }
          } catch {
            toast.warning("Project created. You can configure its workflow on the board.");
          }
        } else if (readError) {
          toast.warning("Project created, but workflow setup couldn't be verified.");
        }
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["projects"] }),
        qc.invalidateQueries({ queryKey: ["studio-dashboard"] }),
        qc.invalidateQueries({ queryKey: ["work-tasks"] }),
      ]);
      toast.success("Project created");
      setName("");
      setDescription("");
      setClientId("");
      setStartDate("");
      setProjectDue("");
      setView("closed");
      navigate("/projects/" + created.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create project.");
    } finally {
      setSaving(false);
    }
  }

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectId || !taskTitle.trim() || !user || !currentWorkspace || saving) return;
    setSaving(true);
    try {
      const stage = chosenStage;
      let position = 0;
      let positions = supabase.from("tasks").select("position")
        .eq("project_id", projectId);
      positions = stage ? positions.eq("stage_id", stage.id) : positions.is("stage_id", null);
      const { data: lastTask, error: positionError } = await positions
        .order("position", { ascending: false }).limit(1);
      if (positionError) throw positionError;
      if (lastTask?.length) position = (lastTask[0].position ?? 0) + 1;

      const { data: created, error } = await supabase.from("tasks").insert({
        workspace_id: currentWorkspace.id,
        project_id: projectId,
        title: taskTitle.trim(),
        status: stage?.category ?? "todo",
        stage_id: stage?.id ?? null,
        position,
        due_date: taskDue || null,
        assignee_id: assigneeId || null,
        created_by: user.id,
      }).select("id").single();
      if (error) throw error;
      if (!created?.id) throw new Error("Task save could not be confirmed.");

      // Priority is represented using existing project labels until a native task
      // priority column exists. Do not silently drop the user's selection.
      if (priority) {
        try {
          const title = "Priority: " + priority[0].toUpperCase() + priority.slice(1);
          const { data: labels, error: labelReadError } = await supabase
            .from("project_labels").select("id, name, position").eq("project_id", projectId);
          if (labelReadError) throw labelReadError;
          let labelId = labels?.find((label) => label.name === title)?.id;
          if (!labelId) {
            const { data: label, error: labelError } = await supabase
              .from("project_labels").insert({
                workspace_id: currentWorkspace.id,
                project_id: projectId,
                name: title,
                color: priority === "high" ? "red" : priority === "medium" ? "orange" : "gray",
                position: labels?.length ?? 0,
              }).select("id").single();
            if (labelError) throw labelError;
            labelId = label?.id;
          }
          if (!labelId) throw new Error("Priority label save could not be confirmed.");
          const { error: attachError } = await supabase.from("task_labels").insert({
            workspace_id: currentWorkspace.id,
            project_id: projectId,
            task_id: created.id,
            label_id: labelId,
          });
          if (attachError) throw attachError;
        } catch {
          toast.warning("Task created, but its priority could not be saved.");
        }
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["project-tasks", projectId] }),
        qc.invalidateQueries({ queryKey: ["task-label-map", projectId] }),
        qc.invalidateQueries({ queryKey: ["project-activity", projectId] }),
        qc.invalidateQueries({ queryKey: ["studio-dashboard"] }),
        qc.invalidateQueries({ queryKey: ["work-tasks"] }),
      ]);
      toast.success("Task created");
      setTaskTitle("");
      setTaskDue("");
      setAssigneeId("");
      setView("closed");
      navigate("/projects/" + projectId + "?task=" + created.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create task.");
    } finally {
      setSaving(false);
    }
  }

  return <Sheet open={view !== "closed"} onOpenChange={open => { if (!saving) setView(open ? "menu" : "closed"); }}>
    {pathname === "/" && (
      <SheetTrigger asChild>
        <button type="button" aria-label="Create new" title="Create new"
          className="jcf-fab"><Plus size={28} strokeWidth={1.8} /></button>
      </SheetTrigger>
    )}
    <SheetContent side="bottom" hideClose overlayClassName="z-[99]"
      className={`jenri jcf-overlay ${view === "menu" ? "jcf-sheet" : "jcf-form-page"} z-[100] w-full border-0`}
      aria-describedby={undefined}
      onEscapeKeyDown={event => { if (saving) event.preventDefault(); }}
      onInteractOutside={event => { if (saving) event.preventDefault(); }}
      onCloseAutoFocus={event => {
        if (opener.current?.isConnected) { event.preventDefault(); opener.current.focus(); }
        opener.current = null;
      }}>
      {view === "menu" ? <>
        <span className="jcf-grabber" aria-hidden="true" />
        <SheetClose className="jcf-close" aria-label="Close create menu"><X size={18} /></SheetClose>
        <SheetTitle>Create new</SheetTitle>
        <p>What would you like to work on?</p>
        <button type="button" className="jcf-action" onClick={() => setView("project")}>
          <span className="jcf-action-icon"><FolderPlus size={24} strokeWidth={1.7} /></span>
          <span className="jcf-action-copy"><strong>New project</strong><small>Start a project in this workspace</small></span>
          <ChevronRight size={19} />
        </button>
        <button type="button" className="jcf-action" onClick={() => setView("task")}>
          <span className="jcf-action-icon"><CheckSquare2 size={23} strokeWidth={1.7} /></span>
          <span className="jcf-action-copy"><strong>New task</strong><small>Add work to an existing project</small></span>
          <ChevronRight size={19} />
        </button>
      </> : <>
        <SheetTitle className="sr-only">{view === "project" ? "New project" : "New task"}</SheetTitle>
        <CreateHeader title={view === "project" ? "New project" : "New task"} onBack={() => !saving && setView("menu")} />
        {view === "project" ? <form className="jcf-form" onSubmit={saveProject}>
          <div className="jcf-intro"><h2 id="jcf-page-title">Set up your project</h2><p>The details can always be changed later.</p></div>
          <Field label="Project name *"><input className="jcf-input" required maxLength={120}
            placeholder="e.g. Ivy Website Redesign" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Client (optional)"><SelectField value={clientId} onChange={setClientId} placeholder="Select a client">
            {members.filter((member) => member.role === "client").map((member) => (
              <option key={member.user_id} value={member.user_id}>{member.full_name ?? member.email ?? "Client"}</option>
            ))}
          </SelectField></Field>
          <Field label="Description (optional)"><textarea className="jcf-input jcf-textarea"
            placeholder="What is this project about?" value={description}
            onChange={(e) => setDescription(e.target.value)} /></Field>
          <div className="jcf-two-col"><DateField label="Start date" value={startDate} onChange={setStartDate} />
            <DateField label="Due date" value={projectDue} min={startDate} onChange={setProjectDue} /></div>
          <div className="jcf-workflow"><span className="jcf-label">Workflow</span>
            <button type="button" className={"jcf-workflow-option " + (workflow === "template" ? "selected" : "")}
              aria-pressed={workflow === "template"} onClick={() => setWorkflow("template")}>
              <span className="jcf-action-icon"><FolderPlus size={19} /></span>
              <span><strong>Use a template</strong><small>Start with pre-made stages</small></span>
              <i aria-hidden="true" />
            </button>
            <button type="button" className={"jcf-workflow-option " + (workflow === "blank" ? "selected" : "")}
              aria-pressed={workflow === "blank"} onClick={() => setWorkflow("blank")}>
              <span className="jcf-action-icon"><Plus size={21} /></span>
              <span><strong>Blank project</strong><small>Build your own stages</small></span>
              <i aria-hidden="true" />
            </button>
          </div>
          <footer className="jcf-form-footer"><button type="submit" className="jcf-submit"
            disabled={saving || !name.trim()}>{saving ? <Loader2 size={21} className="animate-spin" /> : <>Create project <ChevronRight size={20} /></>}</button></footer>
        </form> : <form className="jcf-form" onSubmit={saveTask}>
          <div className="jcf-intro"><h2 id="jcf-page-title">Add a task</h2><p>Keep your team moving forward.</p></div>
          <Field label="Project *"><SelectField required value={projectId} onChange={(value) => { setProjectId(value); setStageId(""); setAssigneeId(""); }} placeholder="Select a project">
            {projects.filter((project) => project.status !== "archived" && project.status !== "completed").map((project) =>
              <option key={project.id} value={project.id}>{project.name}</option>)}
          </SelectField></Field>
          <Field label="Task name *"><input className="jcf-input" required
            placeholder="e.g. Design the hero section" value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)} maxLength={200} /></Field>
          <Field label="Stage"><SelectField value={chosenStage?.id ?? ""} onChange={setStageId} placeholder={stages.length ? "Choose stage" : "No stages yet"}>
            {stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
          </SelectField></Field>
          <div className="jcf-two-col"><DateField label="Due date" value={taskDue} onChange={setTaskDue} />
            <Field label="Assign to"><SelectField value={assigneeId} onChange={setAssigneeId} placeholder="Choose member">
              {assignees.filter((member) => member.role !== "client").map((member) =>
                <option key={member.user_id} value={member.user_id}>{member.full_name ?? member.email ?? "Team member"}</option>)}
            </SelectField></Field></div>
          <div className="jcf-priority"><span className="jcf-label">Priority (optional)</span>
            <div role="group" aria-label="Task priority">
              {(["low", "medium", "high"] as const).map((level) =>
                <button type="button" key={level} className={priority === level ? "selected" : ""}
                  aria-pressed={priority === level} onClick={() => setPriority(priority === level ? "" : level)}>
                  <span className={"jcf-dot " + level} />{level[0].toUpperCase() + level.slice(1)}
                </button>)}
            </div>
          </div>
          <footer className="jcf-form-footer"><button type="submit" className="jcf-submit"
            disabled={saving || !projectId || !taskTitle.trim()}>{saving ? <Loader2 size={21} className="animate-spin" /> : <>Create task <ChevronRight size={20} /></>}</button></footer>
        </form>}
      </>}
    </SheetContent>
  </Sheet>;
}
